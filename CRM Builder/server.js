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

  CREATE TABLE IF NOT EXISTS sequences (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    name        TEXT NOT NULL,
    state       TEXT NOT NULL DEFAULT 'All',
    description TEXT DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sequence_steps (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_id      INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    step_number      INTEGER NOT NULL,
    delay_days       INTEGER NOT NULL DEFAULT 0,
    step_type        TEXT NOT NULL DEFAULT 'call',
    title            TEXT NOT NULL,
    template_subject TEXT DEFAULT '',
    template_body    TEXT DEFAULT '',
    UNIQUE(sequence_id, step_number)
  );

  CREATE TABLE IF NOT EXISTS sequence_enrollments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id      INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    sequence_id  INTEGER NOT NULL REFERENCES sequences(id),
    enrolled_at  TEXT NOT NULL DEFAULT (datetime('now')),
    status       TEXT NOT NULL DEFAULT 'active',
    current_step INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    lead_id          INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    enrollment_id    INTEGER REFERENCES sequence_enrollments(id),
    step_id          INTEGER REFERENCES sequence_steps(id),
    due_date         TEXT NOT NULL,
    type             TEXT NOT NULL DEFAULT 'call',
    title            TEXT NOT NULL,
    template_subject TEXT DEFAULT '',
    template_body    TEXT DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'pending',
    completed_at     TEXT,
    notes            TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    description TEXT NOT NULL,
    notes       TEXT DEFAULT ''
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mergeTemplate(text, lead) {
  if (!text) return '';
  return text
    .replace(/\{\{name\}\}/gi,           lead.name           || '')
    .replace(/\{\{email\}\}/gi,          lead.email          || '')
    .replace(/\{\{phone\}\}/gi,          lead.phone          || '')
    .replace(/\{\{address\}\}/gi,        lead.address        || '')
    .replace(/\{\{town\}\}/gi,           lead.town           || '')
    .replace(/\{\{county\}\}/gi,         lead.county         || '')
    .replace(/\{\{assessed_value\}\}/gi, lead.assessed_value || '')
    .replace(/\{\{state\}\}/gi,          lead.source         || '');
}

function scheduleNextTask(enrollmentId) {
  const enrollment = db.prepare('SELECT * FROM sequence_enrollments WHERE id = ?').get(enrollmentId);
  if (!enrollment || enrollment.status !== 'active') return;

  const nextStep = db.prepare(`
    SELECT * FROM sequence_steps
    WHERE sequence_id = ? AND step_number > ?
    ORDER BY step_number ASC LIMIT 1
  `).get(enrollment.sequence_id, enrollment.current_step);

  if (!nextStep) {
    db.prepare(`UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?`).run(enrollmentId);
    db.prepare(`INSERT INTO activity_log (lead_id, type, description) VALUES (?, 'note', 'Sequence completed')`)
      .run(enrollment.lead_id);
    return;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + nextStep.delay_days);

  db.prepare(`
    INSERT INTO tasks (lead_id, enrollment_id, step_id, due_date, type, title, template_subject, template_body)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    enrollment.lead_id, enrollmentId, nextStep.id,
    dueDate.toISOString().slice(0, 10),
    nextStep.step_type, nextStep.title,
    nextStep.template_subject || '', nextStep.template_body || ''
  );

  db.prepare(`UPDATE sequence_enrollments SET current_step = ? WHERE id = ?`)
    .run(nextStep.step_number, enrollmentId);
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
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

// ─── Pages ────────────────────────────────────────────────────────────────────
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/sequences', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sequences.html'));
});

// ─── API: Stats ───────────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, (req, res) => {
  const total    = db.prepare('SELECT COUNT(*) as n FROM leads').get().n;
  const newLeads = db.prepare("SELECT COUNT(*) as n FROM leads WHERE status = 'New'").get().n;
  const today    = db.prepare("SELECT COUNT(*) as n FROM leads WHERE date(received_at) = date('now')").get().n;
  const thisWeek = db.prepare("SELECT COUNT(*) as n FROM leads WHERE received_at >= datetime('now', '-7 days')").get().n;

  const bySite   = db.prepare('SELECT source, COUNT(*) as n FROM leads GROUP BY source ORDER BY n DESC').all();
  const byStatus = db.prepare('SELECT status, COUNT(*) as n FROM leads GROUP BY status ORDER BY n DESC').all();

  const tasksDueToday    = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status='pending' AND due_date <= date('now')").get().n;
  const tasksThisWeek   = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status='pending' AND due_date <= date('now','+7 days')").get().n;

  res.json({ total, newLeads, today, thisWeek, bySite, byStatus, tasksDueToday, tasksThisWeek });
});

// ─── API: Get leads ───────────────────────────────────────────────────────────
app.get('/api/leads', requireAuth, (req, res) => {
  const { source, status, q, sort = 'newest', page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = [], params = {};

  if (source && source !== 'all') { where.push('source = :source'); params.source = source; }
  if (status && status !== 'all') { where.push('status = :status'); params.status = status; }
  if (q) {
    where.push('(name LIKE :q OR email LIKE :q OR address LIKE :q OR county LIKE :q OR town LIKE :q)');
    params.q = `%${q}%`;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderClause = sort === 'oldest' ? 'ORDER BY received_at ASC' : 'ORDER BY received_at DESC';

  const leads = db.prepare(`SELECT * FROM leads ${whereClause} ${orderClause} LIMIT ${parseInt(limit)} OFFSET ${offset}`).all(params);
  const totalCount = db.prepare(`SELECT COUNT(*) as n FROM leads ${whereClause}`).get(params).n;

  res.json({ leads, total: totalCount, page: parseInt(page), limit: parseInt(limit) });
});

// ─── API: Create lead manually ───────────────────────────────────────────────
app.post('/api/leads', requireAuth, (req, res) => {
  try {
    const b = req.body || {};
    const allowedSources  = ['Vermont','New Hampshire','Wisconsin','Texas','Manual','Referral','Cold Outreach','Other'];
    const allowedStatuses = ['New','Contacted','Qualified','Signed','Won','Lost','Not Qualified'];
    const name = (b.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const source = allowedSources.includes(b.source)  ? b.source  : 'Manual';
    const status = allowedStatuses.includes(b.status) ? b.status : 'New';

    const info = db.prepare(`
      INSERT INTO leads (received_at, name, email, phone, address, town, county, property_type, assessed_value, message, source, status, notes, raw_data)
      VALUES (datetime('now'), :name, :email, :phone, :address, :town, :county, :property_type, :assessed_value, :message, :source, :status, :notes, :raw_data)
    `).run({
      name, source, status,
      email:          (b.email          || '').trim(),
      phone:          (b.phone          || '').trim(),
      address:        (b.address        || '').trim(),
      town:           (b.town           || '').trim(),
      county:         (b.county         || '').trim(),
      property_type:  (b.property_type  || '').trim(),
      assessed_value: (b.assessed_value || '').trim(),
      message:        (b.message        || '').trim(),
      notes:          (b.notes          || '').trim(),
      raw_data:       JSON.stringify({ entered_manually: true, at: new Date().toISOString() })
    });

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
    db.prepare(`INSERT INTO activity_log (lead_id, type, description) VALUES (?, 'note', 'Lead created manually')`).run(lead.id);
    console.log(`[manual] New lead — ${name} (${b.email || 'no email'}) [${source}]`);
    res.status(201).json(lead);
  } catch (err) {
    console.error('[POST /api/leads]', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── API: Update lead ────────────────────────────────────────────────────────
app.patch('/api/leads/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const allowed = ['New','Contacted','Qualified','Signed','Won','Lost','Not Qualified'];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const fields = [], params = {};
  if (status !== undefined) { fields.push('status = :status'); params.status = status; }
  if (notes  !== undefined) { fields.push('notes = :notes');   params.notes  = notes;  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

  params.id = id;
  db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = :id`).run(params);
  if (status) {
    db.prepare(`INSERT INTO activity_log (lead_id, type, description) VALUES (?, 'status_change', ?)`)
      .run(id, `Status changed to ${status}`);
  }
  res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
});

// ─── API: Delete lead ────────────────────────────────────────────────────────
app.delete('/api/leads/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── API: Export CSV ──────────────────────────────────────────────────────────
app.get('/api/export', requireAuth, (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY received_at DESC').all();
  const headers = ['id','received_at','name','email','phone','address','town','county','property_type','assessed_value','source','status','notes','message'];
  const rows = [headers.join(',')];
  for (const l of leads) {
    rows.push(headers.map(h => `"${(l[h]||'').toString().replace(/"/g,'""')}"`).join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tax-leads-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(rows.join('\n'));
});

// ─── API: Activity log ────────────────────────────────────────────────────────
app.get('/api/leads/:id/activity', requireAuth, (req, res) => {
  const logs = db.prepare('SELECT * FROM activity_log WHERE lead_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  res.json(logs);
});

app.post('/api/leads/:id/activity', requireAuth, (req, res) => {
  const { type = 'note', description, notes = '' } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });
  const info = db.prepare(`INSERT INTO activity_log (lead_id, type, description, notes) VALUES (?, ?, ?, ?)`).run(req.params.id, type, description, notes);
  res.status(201).json(db.prepare('SELECT * FROM activity_log WHERE id = ?').get(info.lastInsertRowid));
});

// ─── API: Sequences CRUD ──────────────────────────────────────────────────────
app.get('/api/sequences', requireAuth, (req, res) => {
  const seqs = db.prepare('SELECT * FROM sequences ORDER BY created_at DESC').all();
  const withCounts = seqs.map(s => ({
    ...s,
    step_count: db.prepare('SELECT COUNT(*) as n FROM sequence_steps WHERE sequence_id = ?').get(s.id).n,
    enrolled_count: db.prepare("SELECT COUNT(*) as n FROM sequence_enrollments WHERE sequence_id = ? AND status = 'active'").get(s.id).n
  }));
  res.json(withCounts);
});

app.post('/api/sequences', requireAuth, (req, res) => {
  const { name, state = 'All', description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db.prepare('INSERT INTO sequences (name, state, description) VALUES (?, ?, ?)').run(name.trim(), state, description.trim());
  res.status(201).json(db.prepare('SELECT * FROM sequences WHERE id = ?').get(info.lastInsertRowid));
});

app.patch('/api/sequences/:id', requireAuth, (req, res) => {
  const { name, state, description, active } = req.body;
  const fields = [], params = { id: req.params.id };
  if (name        !== undefined) { fields.push('name = :name');               params.name        = name;        }
  if (state       !== undefined) { fields.push('state = :state');             params.state       = state;       }
  if (description !== undefined) { fields.push('description = :description'); params.description = description; }
  if (active      !== undefined) { fields.push('active = :active');           params.active      = active ? 1 : 0; }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE sequences SET ${fields.join(', ')} WHERE id = :id`).run(params);
  res.json(db.prepare('SELECT * FROM sequences WHERE id = ?').get(req.params.id));
});

app.delete('/api/sequences/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sequences WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── API: Sequence Steps CRUD ─────────────────────────────────────────────────
app.get('/api/sequences/:id/steps', requireAuth, (req, res) => {
  const steps = db.prepare('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC').all(req.params.id);
  res.json(steps);
});

app.post('/api/sequences/:id/steps', requireAuth, (req, res) => {
  const seqId = req.params.id;
  const { step_number, delay_days = 0, step_type = 'call', title, template_subject = '', template_body = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const maxStep = db.prepare('SELECT MAX(step_number) as m FROM sequence_steps WHERE sequence_id = ?').get(seqId).m || 0;
  const stepNum = step_number !== undefined ? step_number : maxStep + 1;

  const info = db.prepare(`
    INSERT INTO sequence_steps (sequence_id, step_number, delay_days, step_type, title, template_subject, template_body)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(seqId, stepNum, delay_days, step_type, title.trim(), template_subject.trim(), template_body.trim());
  res.status(201).json(db.prepare('SELECT * FROM sequence_steps WHERE id = ?').get(info.lastInsertRowid));
});

app.patch('/api/steps/:id', requireAuth, (req, res) => {
  const { delay_days, step_type, title, template_subject, template_body } = req.body;
  const fields = [], params = { id: req.params.id };
  if (delay_days        !== undefined) { fields.push('delay_days = :delay_days');               params.delay_days        = delay_days;        }
  if (step_type         !== undefined) { fields.push('step_type = :step_type');                 params.step_type         = step_type;         }
  if (title             !== undefined) { fields.push('title = :title');                         params.title             = title;             }
  if (template_subject  !== undefined) { fields.push('template_subject = :template_subject');   params.template_subject  = template_subject;  }
  if (template_body     !== undefined) { fields.push('template_body = :template_body');         params.template_body     = template_body;     }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE sequence_steps SET ${fields.join(', ')} WHERE id = :id`).run(params);
  res.json(db.prepare('SELECT * FROM sequence_steps WHERE id = ?').get(req.params.id));
});

app.delete('/api/steps/:id', requireAuth, (req, res) => {
  const step = db.prepare('SELECT * FROM sequence_steps WHERE id = ?').get(req.params.id);
  if (!step) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM sequence_steps WHERE id = ?').run(req.params.id);
  // Renumber remaining steps
  const remaining = db.prepare('SELECT id FROM sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC').all(step.sequence_id);
  remaining.forEach((s, i) => db.prepare('UPDATE sequence_steps SET step_number = ? WHERE id = ?').run(i + 1, s.id));
  res.json({ ok: true });
});

// ─── API: Enrollment ──────────────────────────────────────────────────────────
app.get('/api/leads/:id/enrollments', requireAuth, (req, res) => {
  const enrollments = db.prepare(`
    SELECT e.*, s.name as sequence_name, s.state as sequence_state
    FROM sequence_enrollments e
    JOIN sequences s ON s.id = e.sequence_id
    WHERE e.lead_id = ?
    ORDER BY e.enrolled_at DESC
  `).all(req.params.id);
  res.json(enrollments);
});

app.post('/api/leads/:id/enroll', requireAuth, (req, res) => {
  const leadId = req.params.id;
  const { sequence_id } = req.body;
  if (!sequence_id) return res.status(400).json({ error: 'sequence_id required' });

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const seq = db.prepare('SELECT * FROM sequences WHERE id = ?').get(sequence_id);
  if (!seq) return res.status(404).json({ error: 'Sequence not found' });

  // Cancel any existing active enrollment in the same sequence
  db.prepare(`UPDATE sequence_enrollments SET status = 'cancelled' WHERE lead_id = ? AND sequence_id = ? AND status = 'active'`)
    .run(leadId, sequence_id);

  const info = db.prepare('INSERT INTO sequence_enrollments (lead_id, sequence_id) VALUES (?, ?)').run(leadId, sequence_id);
  const enrollmentId = info.lastInsertRowid;

  // Create first task
  const firstStep = db.prepare('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_number ASC LIMIT 1').get(sequence_id);
  if (firstStep) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + firstStep.delay_days);
    db.prepare(`
      INSERT INTO tasks (lead_id, enrollment_id, step_id, due_date, type, title, template_subject, template_body)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(leadId, enrollmentId, firstStep.id, dueDate.toISOString().slice(0, 10),
           firstStep.step_type, firstStep.title, firstStep.template_subject || '', firstStep.template_body || '');
    db.prepare(`UPDATE sequence_enrollments SET current_step = ? WHERE id = ?`).run(firstStep.step_number, enrollmentId);
  }

  db.prepare(`INSERT INTO activity_log (lead_id, type, description) VALUES (?, 'enrolled', ?)`)
    .run(leadId, `Enrolled in sequence: ${seq.name}`);

  res.status(201).json(db.prepare('SELECT * FROM sequence_enrollments WHERE id = ?').get(enrollmentId));
});

app.patch('/api/enrollments/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ['active','paused','cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE sequence_enrollments SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM sequence_enrollments WHERE id = ?').get(req.params.id));
});

// ─── API: Tasks ───────────────────────────────────────────────────────────────
app.get('/api/tasks', requireAuth, (req, res) => {
  const { status = 'pending', window: win = 'all', lead_id } = req.query;
  let where = [], params = [];

  if (status !== 'all') { where.push('t.status = ?'); params.push(status); }
  if (lead_id)          { where.push('t.lead_id = ?'); params.push(lead_id); }
  if (win === 'today')    { where.push("t.due_date <= date('now')"); }
  if (win === 'upcoming') { where.push("t.due_date > date('now') AND t.due_date <= date('now','+7 days')"); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const tasks = db.prepare(`
    SELECT t.*, l.name as lead_name, l.email as lead_email, l.phone as lead_phone,
           l.address as lead_address, l.town as lead_town, l.county as lead_county,
           l.assessed_value as lead_assessed_value, l.source as lead_source,
           s.name as sequence_name
    FROM tasks t
    JOIN leads l ON l.id = t.lead_id
    LEFT JOIN sequence_enrollments e ON e.id = t.enrollment_id
    LEFT JOIN sequences s ON s.id = e.sequence_id
    ${whereClause}
    ORDER BY t.due_date ASC, t.id ASC
  `).all(...params);

  // Merge templates with lead data
  const merged = tasks.map(t => ({
    ...t,
    merged_subject: mergeTemplate(t.template_subject, { name: t.lead_name, email: t.lead_email, phone: t.lead_phone, address: t.lead_address, town: t.lead_town, county: t.lead_county, assessed_value: t.lead_assessed_value, source: t.lead_source }),
    merged_body:    mergeTemplate(t.template_body,    { name: t.lead_name, email: t.lead_email, phone: t.lead_phone, address: t.lead_address, town: t.lead_town, county: t.lead_county, assessed_value: t.lead_assessed_value, source: t.lead_source })
  }));

  res.json(merged);
});

app.patch('/api/tasks/:id', requireAuth, (req, res) => {
  const { status, notes = '' } = req.body;
  const allowed = ['done','skipped','pending'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare(`UPDATE tasks SET status = ?, notes = ?, completed_at = datetime('now') WHERE id = ?`).run(status, notes, req.params.id);

  const action = status === 'done' ? 'Completed' : 'Skipped';
  db.prepare(`INSERT INTO activity_log (lead_id, type, description, notes) VALUES (?, ?, ?, ?)`)
    .run(task.lead_id, task.type, `${action}: ${task.title}`, notes);

  if (task.enrollment_id && (status === 'done' || status === 'skipped')) {
    scheduleNextTask(task.enrollment_id);
  }

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

// ─── Webhook: Netlify form submissions ───────────────────────────────────────
app.post('/webhook', (req, res) => {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret && req.query.secret !== webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const body = req.body;
    const data = body.data || body;
    let source = data.source || '';
    if (!source && body.site_url) {
      const url = body.site_url.toLowerCase();
      if      (url.includes('vermonttaxappeal'))                                    source = 'Vermont';
      else if (url.includes('nhtaxappeal'))                                         source = 'New Hampshire';
      else if (url.includes('wisconsintaxappeal'))                                  source = 'Wisconsin';
      else if (url.includes('lowermycommercialtax') || url.includes('txappeal'))   source = 'Texas';
      else source = body.site_url;
    }
    if (!source) source = 'unknown';

    const info = db.prepare(`
      INSERT INTO leads (received_at, name, email, phone, address, town, county, property_type, assessed_value, message, source, status, raw_data)
      VALUES (datetime('now'), :name, :email, :phone, :address, :town, :county, :property_type, :assessed_value, :message, :source, 'New', :raw_data)
    `).run({
      name:           data.name             || data['full-name']        || '',
      email:          data.email            || '',
      phone:          data.phone            || data.tel                  || '',
      address:        data.address          || data['property-address'] || '',
      town:           data.town             || '',
      county:         data.county           || '',
      property_type:  data['property-type'] || data.propertyType        || '',
      assessed_value: data['assessed-value']|| data.assessedValue       || '',
      message:        data.message          || data.comments            || '',
      source,
      raw_data: JSON.stringify(body)
    });

    db.prepare(`INSERT INTO activity_log (lead_id, type, description) VALUES (?, 'note', ?)`)
      .run(info.lastInsertRowid, `Form submitted via ${source}`);

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
