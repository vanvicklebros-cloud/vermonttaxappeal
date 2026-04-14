# Tax Appeal CRM — Usage Guide

**Live URL:** https://tax-crm-production.up.railway.app/login
**Password:** TaxCRM2026!

---

## The Two Ways Leads Get In

**1. Automatic (form submissions)**
Someone fills out a form on any of your 4 sites → Netlify fires a webhook → lead appears in the CRM instantly with the correct state badge (VT / NH / WI / TX) and status = New.

**2. Manual (you add them)**
Click **+ Add Prospect** in the top-right → fill in the form → save. Use this for referrals, cold outreach, anyone you're prospecting who didn't come in through a form. Source options: Manual, Referral, Cold Outreach, or any of the 4 states.

---

## Daily Workflow

### Step 1 — Check your Task Queue
Click the **Tasks** tab at the top. Tasks are grouped into:
- **Overdue** — should have been done already, do these first
- **Today** — due today
- **Upcoming** — coming up this week

### Step 2 — Work your tasks
Click any task to expand it.

**Call task:** Shows the call script/instructions. Add notes in the box, then click **Mark Done**. The next step in the sequence auto-schedules.

**Email task:** Shows the pre-written email with the lead's info already filled in (name, address, county, etc.). Copy the subject and body, open Gmail, paste and send. Then come back and click **Mark Done**.

If you can't reach someone, click **Skip** — it still advances to the next step.

### Step 3 — Check new leads
Click the **Leads** tab. Filter by source (state) or status. Click any row to expand it and see full details.

---

## Managing Leads

### Updating a lead
Expand any lead → change the Status dropdown → add notes → click **Save**.

**Status options:**
- **New** — just came in, not contacted yet
- **Contacted** — you've reached out
- **Qualified** — they're a real prospect, property is a good candidate
- **Signed** — they've signed on as a client
- **Won** — appeal won, case closed
- **Lost** — went with someone else or dropped out
- **Not Qualified** — property doesn't qualify

### Logging a call
Expand a lead → click **📞 Log Call** → add notes. This writes to the activity log so you have a record of every interaction.

### Enrolling a lead in a sequence
Expand any lead → scroll to the **Sequences** section → click **+ Enroll in Sequence** → pick the right sequence for their state → click **Enroll**. The first task generates immediately and shows up in your Task Queue.

### Deleting a lead
Expand the lead → click **Delete** at the bottom right. Cannot be undone.

---

## Building Sequences

Go to **Sequences** in the top nav (or visit `/sequences`).

### Create a new sequence
Click **+ New Sequence** → give it a name → select the state → click **Create Sequence**.

Naming convention suggestion: `Vermont — Inbound 5-Step`, `Texas — Cold Outreach 3-Step`

### Add steps
Click a sequence to expand it → scroll to **Add New Step** at the bottom.

**Fields:**
- **Type** — Call task (you make a call) or Email task (you send an email)
- **Delay** — days after the previous step. Step 1 delay = 0 means it's due immediately on enrollment. Step 2 delay = 2 means it's due 2 days after step 1 is completed.
- **Title** — the instruction you'll see in your task queue (e.g. "Intro call — ask about assessed value and timeline")
- **Email Subject / Body** — only for email tasks. Use merge tags to auto-fill lead info.

Click **Add Step** when done. Repeat for each step.

### Merge tags (auto-fill lead info into emails)
Use these in your email subject and body — they get replaced with the actual lead's data when you view the task:

| Tag | Replaced with |
|---|---|
| `{{name}}` | Lead's full name |
| `{{email}}` | Lead's email address |
| `{{phone}}` | Lead's phone number |
| `{{address}}` | Property address |
| `{{town}}` | Town |
| `{{county}}` | County |
| `{{assessed_value}}` | Assessed value |
| `{{state}}` | Source (e.g. Vermont) |

**Example email body:**
```
Hi {{name}},

I wanted to follow up about your property at {{address}} in {{town}}.

Based on properties we've successfully appealed in {{county}} County, there's a good chance we can lower your assessed value below {{assessed_value}}.

Would you have 10 minutes this week for a quick call?

Best,
Mike
```

### Editing a step
Expand the sequence → each step has editable fields inline → make changes → click **Save Step**.

### Removing a step
Click **Remove** on any step. Remaining steps renumber automatically.

### Pausing a sequence
Use the toggle switch on the sequence card (orange = active, grey = paused). Paused sequences can't be enrolled in.

---

## Suggested Sequence Structure

### For inbound form leads (they came to you):
- **Day 0:** Call task — "Intro call — introduce yourself, ask about property and timeline"
- **Day 2:** Email task — follow-up email with what you can do for them
- **Day 5:** Call task — "Follow-up call if no response to email"
- **Day 8:** Email task — value prop email with a case study or result
- **Day 12:** Email task — breakup email ("last reach out")

### For cold outreach / manual prospects:
- **Day 0:** Call task — "Cold intro call"
- **Day 3:** Email task — intro email
- **Day 7:** Call task — "Second call attempt"
- **Day 10:** Email task — follow-up with value
- **Day 14:** Email task — final follow-up

---

## Exporting Data

Click **⬇ Export CSV** in the top-right of the dashboard. Downloads all leads as a spreadsheet with every field including status, notes, and source.

---

## Filtering Leads

- **State pills** (All / Vermont / New Hampshire / Wisconsin / Texas) — filter by which site the lead came from
- **Status dropdown** — filter by where they are in your pipeline
- **Search bar** — searches name, email, address, county, town

---

## Deploying Updates

When new code is ready in the CRM Builder folder:

```bash
cp ~/Desktop/vermonttaxappeal/CRM\ Builder/server.js ~/tax-crm/server.js
cp ~/Desktop/vermonttaxappeal/CRM\ Builder/dashboard.html ~/tax-crm/public/dashboard.html
cp ~/Desktop/vermonttaxappeal/CRM\ Builder/sequences.html ~/tax-crm/public/sequences.html
cd ~/tax-crm && git add -A && git commit -m "Update CRM" && git push
```

Railway auto-deploys in ~60 seconds after the push. The database is preserved — no data is lost on deploy.

---

## Coming Soon (when Google accounts are ready)

One Google Workspace account per state (info@vermonttaxappeal.com, etc.) will enable:
- Email tasks auto-draft directly to your Gmail Drafts folder — you just review and hit Send
- Sent emails logged automatically to the activity log
- Right account used automatically based on lead's state

---

## Troubleshooting

**CRM not loading** → go to railway.app → gracious-adaptation project → check Deployments tab

**Task not showing up after enrollment** → make sure the sequence has at least one step and is set to Active (orange toggle)

**Webhook leads not coming in** → check Netlify → site → Forms → Outgoing Notifications — verify the webhook URL is `https://tax-crm-production.up.railway.app/webhook`

**Lost your password** → Railway → tax-crm service → Variables → `ADMIN_PASSWORD`
