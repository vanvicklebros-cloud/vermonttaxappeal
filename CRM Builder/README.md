# Tax Appeal CRM — How It Was Built

> **Last updated:** April 2026 — Added sequences, task queue, enrollment, activity log, and manual prospect creation.

**Live URL:** https://tax-crm-production.up.railway.app/login
**Password:** TaxCRM2026!
**GitHub Repo:** https://github.com/vanvicklebros/tax-crm (vanvicklebros-cloud org)

---

## What It Does

A private lead management dashboard that automatically receives form submissions from all 4 property tax appeal websites (VT, NH, WI, TX), stores them in a database, and lets you view, filter, update status, add notes, and export to CSV.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Server | Node.js + Express |
| Database | SQLite via `better-sqlite3` (synchronous, no setup needed) |
| Auth | Session-based (single shared password) |
| Hosting | Railway.app (free tier → $5/mo hobby) |
| Persistence | Railway Volume mounted at `/data` |
| Incoming data | Netlify outgoing webhooks → `/webhook` endpoint |

---

## Files

### `server.js` — the entire backend (172 lines)

All logic lives here. Key sections:

- **Database setup** (lines 13–32): Creates `leads` table on first run with fields: id, name, email, phone, address, town, county, property_type, assessed_value, message, source, status, notes, raw_data
- **Auth** (lines 46–69): Single password check against `ADMIN_PASSWORD` env var, 8-hour session cookie
- **Dashboard** (line 71–73): Serves `public/dashboard.html` — protected by `requireAuth` middleware
- **`/api/stats`** (lines 75–83): Returns totals, new leads, today's count, weekly count, leads by site, leads by status
- **`/api/leads`** (lines 85–97): Filterable/searchable/paginated lead list (filter by source, status, search query)
- **`/api/leads/:id` PATCH** (lines 99–112): Update status or notes on a lead
- **`/api/leads/:id` DELETE** (lines 114–117): Delete a lead
- **`/api/export`** (lines 119–129): Download all leads as a CSV file
- **`/webhook` POST** (lines 131–166): Receives Netlify form submissions, auto-detects which site sent it from `site_url`, inserts into database

### `railway.json`
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": { "startCommand": "node server.js", "healthcheckPath": "/login" }
}
```

### `package.json` dependencies
- `express` — web server
- `express-session` — session auth
- `better-sqlite3` — synchronous SQLite (requires native compilation)

---

## Railway Setup

### Environment Variables
| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | `TaxCRM2026!` |
| `SESSION_SECRET` | `tax-crm-session-secret-2026-vanvickle-secure` |
| `WEBHOOK_SECRET` | `tax-crm-webhook-secret-2026` |
| `DB_PATH` | `/data/leads.db` |
| `NIXPACKS_APT_PKGS` | `python3 make g++` |

**Why `NIXPACKS_APT_PKGS`?** `better-sqlite3` compiles native C++ bindings at build time via `node-gyp`. Railway's default Nixpacks Node.js environment doesn't include `python3`, `make`, or `g++`. This env var installs them before the build runs.

### Persistent Volume
- Volume name: `tax-crm-volume`
- Mount path: `/data`
- This is what keeps `leads.db` alive across deploys and restarts. Without it, every redeploy wipes the database.

### Domain
- Auto-generated Railway domain: `tax-crm-production.up.railway.app`
- Created via Railway GraphQL API (`serviceDomainCreate` mutation) with `targetPort: 8080`
- **Note:** Railway injects `PORT=8080` by default. The domain's `targetPort` must match.

### Railway Project IDs (for reference)
| Resource | ID |
|---|---|
| Project ID | `51fc8a5b-b6fd-4c14-93ed-eecfcc4c8a89` |
| Service ID | `0c0df14d-8427-4e91-99cf-b31d2d4d2e7c` |
| Environment ID | `ad11f273-c687-41f3-aed3-1998fbfffc11` |
| Volume ID | `823ad8a9-f15b-4854-a751-e758fec05341` |
| Domain ID | `c434af15-7ccb-4229-ae9e-57f75b5204dd` |

---

## Netlify Webhook Setup

Each of the 4 sites has an outgoing webhook configured in Netlify that fires on every form submission.

**Endpoint:** `https://tax-crm-production.up.railway.app/webhook`
**Trigger:** `submission_created`

| Site | Netlify Site ID | Hook ID |
|---|---|---|
| Vermont | `d323e0b7-485b-4204-844e-c24d4a97f3e0` | `69d98fa23c3782f452751b03` |
| New Hampshire | `4fa23d66-7c93-4df4-ba78-024541502df6` | `69d98fad0069d0f6a9fcb037` |
| Wisconsin | `0a18608b-2700-4804-aa38-2eb963fb4ae5` | `69d98fae0069d0f6a9fcb038` |
| Texas | `c4795a7d-9a33-477d-b7bd-f667c7097228` | `69d98fae50f6aaee9cb5a51b` |

Webhooks were created via Netlify API:
```bash
curl -X POST "https://api.netlify.com/api/v1/hooks" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"site_id": "SITE_ID", "type": "url", "event": "submission_created", "data": {"url": "https://tax-crm-production.up.railway.app/webhook"}}'
```

---

## How a Lead Flows In

1. Visitor fills out contact form on any of the 4 sites
2. Netlify processes the form submission
3. Netlify fires the outgoing webhook → POSTs JSON to `/webhook`
4. `server.js` webhook handler reads `body.site_url` to determine which state
5. Lead inserted into SQLite with `status = 'New'`
6. Shows up instantly in the CRM dashboard

---

## Updating the Password

In Railway → tax-crm service → Variables → click `ADMIN_PASSWORD` → edit value → Railway auto-redeploys.

---

## New Features (April 2026)

### Manual Prospect Entry
- **`POST /api/leads`** — creates a lead from the dashboard without a form submission
- Accessible via the **+ Add Prospect** button in the top-right of the dashboard
- Accepted sources: `Vermont`, `New Hampshire`, `Wisconsin`, `Texas`, `Manual`, `Referral`, `Cold Outreach`, `Other`

---

## New Database Tables

### `sequences`
Stores outreach sequences (one per state/market).
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | Primary key |
| name | TEXT | e.g. "Vermont 5-Step" |
| state | TEXT | Vermont / New Hampshire / Wisconsin / Texas / All |
| description | TEXT | Optional notes |
| active | INTEGER | 1 = active, 0 = paused |

### `sequence_steps`
Each step in a sequence.
| Column | Type | Notes |
|---|---|---|
| sequence_id | INTEGER | FK → sequences |
| step_number | INTEGER | Order within sequence |
| delay_days | INTEGER | Days after previous step (0 = same day) |
| step_type | TEXT | `call` or `email` |
| title | TEXT | Task instructions |
| template_subject | TEXT | Email subject (supports merge tags) |
| template_body | TEXT | Email body / call script (supports merge tags) |

**Merge tags:** `{{name}}` `{{email}}` `{{phone}}` `{{address}}` `{{town}}` `{{county}}` `{{assessed_value}}` `{{state}}`

### `sequence_enrollments`
Tracks which lead is in which sequence.
| Column | Type | Notes |
|---|---|---|
| lead_id | INTEGER | FK → leads |
| sequence_id | INTEGER | FK → sequences |
| status | TEXT | `active` / `paused` / `cancelled` / `completed` |
| current_step | INTEGER | Which step they're on |

### `tasks`
Individual to-do items generated from sequence steps.
| Column | Type | Notes |
|---|---|---|
| lead_id | INTEGER | FK → leads |
| enrollment_id | INTEGER | FK → sequence_enrollments |
| due_date | TEXT | ISO date string |
| type | TEXT | `call` or `email` |
| title | TEXT | Task description |
| template_subject / body | TEXT | Merge-tag-resolved at query time |
| status | TEXT | `pending` / `done` / `skipped` |

### `activity_log`
Every action taken on a lead.
| Column | Type | Notes |
|---|---|---|
| lead_id | INTEGER | FK → leads |
| type | TEXT | `call` / `email` / `note` / `enrolled` / `status_change` |
| description | TEXT | Human-readable summary |
| notes | TEXT | Optional freeform notes |

---

## New API Endpoints

### Sequences
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sequences` | List all sequences with step + enrollment counts |
| POST | `/api/sequences` | Create sequence (`name`, `state`, `description`) |
| PATCH | `/api/sequences/:id` | Update name/state/description/active |
| DELETE | `/api/sequences/:id` | Delete sequence + all steps |

### Steps
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sequences/:id/steps` | Get all steps for a sequence |
| POST | `/api/sequences/:id/steps` | Add a step |
| PATCH | `/api/steps/:id` | Update step |
| DELETE | `/api/steps/:id` | Delete step (auto-renumbers remaining) |

### Enrollment
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leads/:id/enrollments` | Get all enrollments for a lead |
| POST | `/api/leads/:id/enroll` | Enroll lead in sequence (`sequence_id`) — auto-creates first task |
| PATCH | `/api/enrollments/:id` | Update status (`active` / `paused` / `cancelled`) |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | Get tasks — filter by `status`, `window` (today/upcoming/all), `lead_id` |
| PATCH | `/api/tasks/:id` | Mark `done` or `skipped` — auto-schedules next task in sequence |

### Activity
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leads/:id/activity` | Get activity log for a lead |
| POST | `/api/leads/:id/activity` | Log manual activity (`type`, `description`, `notes`) |

---

## New Files

### `public/sequences.html`
Full sequence builder UI. Create/edit sequences, add/edit/delete steps inline, toggle sequences active/paused. Accessible at `/sequences`.

### Updated `public/dashboard.html`
- **Tasks tab** — task queue grouped by Overdue / Today / Upcoming. Click a task to see the merged template and mark done/skip.
- **Lead expand** now shows: enrollment status, Enroll in Sequence button, Log Call button, activity log
- **+ Add Prospect** button in header for manual lead creation
- Nav links to Leads and Sequences pages

---

## How Tasks Auto-Advance

1. Lead enrolled in sequence → first step's task created with `due_date = today + step.delay_days`
2. Task marked done or skipped → server finds next step in sequence
3. Next task created with `due_date = today + next_step.delay_days`
4. When last step is completed → enrollment status set to `completed`, activity logged

---

## Gmail Integration (Future)

Currently email tasks show the pre-filled template for you to copy and send manually. When Google Workspace accounts are ready (one per state), Gmail API can be wired in to:
- Auto-draft emails directly to your Drafts folder
- Log sent emails back to the activity log

---

## If the CRM Goes Down

1. Go to https://railway.com → gracious-adaptation project → tax-crm service
2. Check Deployments tab — if the latest deployment failed, click the three dots → Redeploy
3. If it's a volume issue, check that `tax-crm-volume` is still attached under the service canvas
4. If 502 error returns: verify the domain's `targetPort` matches the PORT Railway injected (currently 8080)
