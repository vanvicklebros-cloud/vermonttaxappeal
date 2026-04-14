# Tax Appeal CRM

Password-protected lead dashboard. Receives form submissions from all 4 property tax appeal sites via Netlify webhooks, stores them in SQLite, and shows them in a table tagged by source site.

---

## Deploy to Railway (free)

### 1. Create a GitHub repo

```bash
cd tax-crm
git init
git add .
git commit -m "Initial CRM"
git remote add origin https://github.com/YOUR_USERNAME/tax-crm.git
git push -u origin main
```

### 2. Create a Railway project

1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Select your `tax-crm` repo
3. Railway auto-detects Node.js and runs `npm start`

### 3. Add environment variables in Railway

In your project → Variables tab, add:

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | Your login password (pick something strong) |
| `SESSION_SECRET` | Any random 32+ char string |
| `WEBHOOK_SECRET` | Any random string (use in Netlify webhook URL) |
| `DB_PATH` | `/data/leads.db` |

### 4. Add a persistent volume (keeps your data after redeploys)

1. In Railway → your service → Settings → Volumes
2. Add Volume: mount path = `/data`
3. This ensures leads.db survives redeploys

### 5. Get your app URL

Railway gives you a URL like `https://tax-crm-production.up.railway.app`
You can also set a custom domain in Railway → Settings → Domains.

---

## Connect Netlify Webhooks

Do this for all 4 sites in Netlify:

1. Go to **Netlify → your site → Site configuration → Forms → Form notifications**
2. Click **Add notification → Outgoing webhook**
3. Event: **New form submission**
4. URL: `https://YOUR-RAILWAY-URL.railway.app/webhook?secret=YOUR_WEBHOOK_SECRET`
5. Save

Repeat for all 4 sites (vermonttaxappeal, nhtaxappeal, wisconsintaxappeal, lowermycommercialtax).

---

## Local dev

```bash
cp .env.example .env
# Edit .env with your values
npm install
npm run dev   # needs: npm install -D nodemon
# OR
node server.js
```

Visit http://localhost:3000 → login with your ADMIN_PASSWORD.

---

## Lead statuses

| Status | Meaning |
|---|---|
| New | Just came in, not yet contacted |
| Contacted | You've reached out |
| Qualified | Confirmed they have a case |
| Signed | Authorization form signed |
| Won | Appeal succeeded, savings achieved |
| Lost | No savings / withdrew |
| Not Qualified | Assessment is accurate, no case |

---

## Export

Hit **Export CSV** in the header to download all leads as a spreadsheet.
