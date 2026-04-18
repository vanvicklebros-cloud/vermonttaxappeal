const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Database ────────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'leads.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    received_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    name            TEXT,
    email           TEXT,
    phone           TEXT,
    address         TEXT,
    town            TEXT,
    county          TEXT,
    property_type   TEXT,
    assessed_value  TEXT,
    message         TEXT,
    source          TEXT    NOT NULL DEFAULT 'unknown',
    status          TEXT    NOT NULL DEFAULT 'New',
    notes           TEXT    DEFAULT '',
    raw_data        TEXT
  );
`);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}));

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}

// ─── Auth routes ──────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ─── API: Stats ───────────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, (req, res) => {
  const total      = db.prepare('SELECT COUNT(*) as n FROM leads').get().n;
  const newLeads   = db.prepare("SELECT COUNT(*) as n FROM leads WHERE status = 'New'").get().n;
  const today      = db.prepare("SELECT COUNT(*) as n FROM leads WHERE date(received_at) = date('now')").get().n;
  const thisWeek   = db.prepare("SELECT COUNT(*) as n FROM leads WHERE received_at >= datetime('now', '-7 days')").get().n;

  const bySite = db.prepare(`
    SELECT source, COUNT(*) as n FROM leads GROUP BY source ORDER BY n DESC
  `).all();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as n FROM leads GROUP BY status ORDER BY n DESC
  `).all();

  res.json({ total, newLeads, today, thisWeek, bySite, byStatus });
});

// ─── API: Get leads ───────────────────────────────────────────────────────────
app.get('/api/leads', requireAuth, (req, res) => {
  const { source, status, q, sort = 'newest', page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [];
  let params = {};

  if (source && source !== 'all') {
    where.push('source = :source');
    params.source = source;
  }
  if (status && status !== 'all') {
    where.push('status = :status');
    params.status = status;
  }
  if (q) {
    where.push('(name LIKE :q OR email LIKE :q OR address LIKE :q OR county LIKE :q OR town LIKE :q)');
    params.q = `%${q}%`;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderClause = sort === 'oldest' ? 'ORDER BY received_at ASC' : 'ORDER BY received_at DESC';

  const leads = db.prepare(`
    SELECT * FROM leads ${whereClause} ${orderClause} LIMIT ${parseInt(limit)} OFFSET ${offset}
  `).all(params);

  const totalCount = db.prepare(`SELECT COUNT(*) as n FROM leads ${whereClause}`).get(params).n;

  res.json({ leads, total: totalCount, page: parseInt(page), limit: parseInt(limit) });
});

// ─── API: Update lead ────────────────────────────────────────────────────────
app.patch('/api/leads/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const allowed = ['New', 'Contacted', 'Qualified', 'Signed', 'Won', 'Lost', 'Not Qualified'];

  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const fields = [];
  const params = {};

  if (status !== undefined) { fields.push('status = :status'); params.status = status; }
  if (notes  !== undefined) { fields.push('notes = :notes');  params.notes  = notes;  }

  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

  params.id = id;
  db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = :id`).run(params);
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  res.json(lead);
});

// ─── API: Delete lead ────────────────────────────────────────────────────────
app.delete('/api/leads/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ─── API: Export CSV ──────────────────────────────────────────────────────────
app.get('/api/export', requireAuth, (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY received_at DESC').all();
  const headers = ['id','received_at','name','email','phone','address','town','county','property_type','assessed_value','source','status','notes','message'];
  const rows = [headers.join(',')];

  for (const l of leads) {
    rows.push(headers.map(h => {
      const v = (l[h] || '').toString().replace(/"/g, '""');
      return `"${v}"`;
    }).join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tax-leads-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(rows.join('\n'));
});

// ─── Webhook: Netlify form submissions ───────────────────────────────────────
app.post('/webhook', (req, res) => {
  // Optional secret check: /webhook?secret=YOUR_SECRET
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret && req.query.secret !== webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = req.body;

    // Netlify sends form data as flat key-value in body (application/x-www-form-urlencoded)
    // or as JSON depending on webhook config
    const data = body.data || body; // handle both formats

    // Determine source: prefer explicit "source" field, fall back to site_url or form_name
    let source = data.source || data['source'] || '';
    if (!source && body.site_url) {
      const url = body.site_url.toLowerCase();
      if (url.includes('vermonttaxappeal'))        source = 'Vermont';
      else if (url.includes('nhtaxappeal'))        source = 'New Hampshire';
      else if (url.includes('wisconsintaxappeal')) source = 'Wisconsin';
      else if (url.includes('lowermycommercialtax') || url.includes('txappeal')) source = 'Texas';
      else source = body.site_url;
    }
    if (!source) source = 'unknown';

    const insert = db.prepare(`
      INSERT INTO leads
        (received_at, name, email, phone, address, town, county, property_type, assessed_value, message, source, status, raw_data)
      VALUES
        (datetime('now'), :name, :email, :phone, :address, :town, :county, :property_type, :assessed_value, :message, :source, 'New', :raw_data)
    `);

    insert.run({
      name:           data.name            || data['full-name']  || '',
      email:          data.email           || '',
      phone:          data.phone           || data.tel           || '',
      address:        data.address         || data['property-address'] || '',
      town:           data.town            || '',
      county:         data.county          || '',
      property_type:  data['property-type'] || data.propertyType || '',
      assessed_value: data['assessed-value'] || data.assessedValue || '',
      message:        data.message         || data.comments      || '',
      source:         source,
      raw_data:       JSON.stringify(body)
    });

    console.log(`[webhook] New lead from ${source} — ${data.name || 'unknown'} (${data.email || 'no email'})`);
    res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[webhook] Error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Tax Appeal CRM running on http://localhost:${PORT}`);
  console.log(`DB: ${DB_PATH}`);
});
