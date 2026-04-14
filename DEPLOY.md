# Deployment & Infrastructure — VermontTaxAppeal.com

---

## Credentials

| Service | Detail |
|---|---|
| **Netlify site ID** | *(to be created)* |
| **Netlify project URL** | *(to be created)* |
| **GitHub repo** | *(to be created — e.g. vanvicklebros/vermonttaxappeal)* |
| **Live site** | https://vermonttaxappeal.com |
| **Domain registrar** | Namecheap |

---

## Initial Setup Steps

1. Create a new GitHub repo (e.g. `vanvicklebros/vermonttaxappeal`)
2. Push the `dist/` folder and support files to the repo
3. Create a new Netlify site connected to the GitHub repo
4. In Netlify, set build settings:
   - **Publish directory:** `dist`
   - **Build command:** (leave blank — site is pre-built)
5. Add custom domain `vermonttaxappeal.com` in Netlify
6. In Namecheap, point nameservers to Netlify DNS (Netlify will provide the NS records)
7. Wait for DNS propagation + SSL certificate provisioning

---

## How Auto-Deploy Works (once GitHub is connected)

1. Push a commit to the `main` branch on GitHub
2. Netlify detects the push via webhook
3. Netlify publishes the `dist/` folder
4. Site goes live at vermonttaxappeal.com
5. Takes ~30 seconds

---

## Manual Deploy (fallback)

```bash
NETLIFY_AUTH_TOKEN=YOUR_TOKEN \
  npx netlify deploy --prod --dir=dist --site=YOUR_SITE_ID
```

---

## DNS

- Domain registered at **Namecheap**: vermonttaxappeal.com
- Point Namecheap nameservers to **Netlify DNS** (Netlify provides NS records after adding domain)
- Netlify manages DNS zone and SSL certificate (auto-renews via Let's Encrypt)

---

## Netlify Forms

Contact form at `/contact` uses Netlify Forms (`data-netlify="true"`).
Submissions will appear at: Netlify project → Forms tab

---

## Analytics

- **Netlify Analytics:** Available in Netlify dashboard → Analytics tab
- **Google Analytics:** Not yet set up. Add GA4 Measurement ID to each page's `<head>` when ready.
