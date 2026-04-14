# VermontTaxAppeal.com — Vermont Site

This is the **Vermont property tax appeal website** (residential + commercial) for Mike VanVickle.
Live at: https://vermonttaxappeal.com

Built as static HTML + CSS. Hosted on Netlify. Custom domain via Namecheap → Netlify DNS.

See sub-docs for details:
- DESIGN.md — design system, CSS classes, tokens
- DEPLOY.md — deployment, credentials, Netlify, GitHub

---

## Tech Stack

| Layer | Tool |
|---|---|
| Format | Static HTML + CSS (pre-built dist) |
| Styling | Custom CSS (design tokens in BaseLayout.css) |
| Hosting | Netlify (free tier) |
| Domain | vermonttaxappeal.com (Namecheap → Netlify DNS) |
| Forms | Netlify Forms (`data-netlify="true"`) |

---

## Project Structure

```
dist/
  _astro/
    BaseLayout.css     ← All styles + design tokens
  index.html           ← Homepage
  about/index.html     ← About Mike
  contact/index.html   ← Netlify form
  how-it-works/index.html
  blog/
    index.html         ← Blog listing
    how-to-appeal-property-tax-vermont/index.html
  counties/
    index.html         ← All 14 VT counties
    chittenden-county/index.html  ← Sample county page
  favicon.svg
  robots.txt
  sitemap-index.xml
  sitemap-0.xml
netlify.toml           ← Build config, redirects, security headers
```

---

## Most Common Tasks

### Change contact info
Update phone, email, and other details across all HTML files. Search for `(555) 000-0000` and `info@vermonttaxappeal.com`.

### Add a blog post
Create a new folder in `dist/blog/your-post-slug/` with an `index.html` file following the same template as the existing blog post. Add a card linking to it in `dist/blog/index.html`.

### Add a county page
Create a new folder in `dist/counties/county-name/` with an `index.html` file following the Chittenden County template. Add a card linking to it in `dist/counties/index.html`.

### Deploy
Push the `dist/` folder to Netlify:
```bash
npx netlify deploy --prod --dir=dist --site=YOUR_SITE_ID
```
Or connect to GitHub for auto-deploys on push to `main`.

---

## Site Identity

- **Business:** VermontTaxAppeal.com
- **Owner:** Mike VanVickle
- **State:** Vermont
- **Fee model:** 30% contingency, first-year savings only
- **Target:** Residential AND commercial properties, all 14 VT counties
- **Appeal process:** Grievance → Board of Civil Authority → State Director → Superior Court
- **Deadline:** Varies by town, typically mid-May to early June

---

## Vermont-Specific Notes

- Vermont uses town **Listers** (not assessors) and **Board of Civil Authority** (not appraisal review boards)
- Grievance deadlines are set by each town, not the state
- Statutory maximum deadlines: June 19 (towns <5,000 pop) / July 9 (towns 5,000+)
- 14 days to appeal lister decision to BCA
- Vermont has dual education tax rates: homestead (lower) and nonhomestead (higher, applies to commercial/rental/vacation)
- 2025 Statewide Adjustment significantly changed how assessments are calculated
- No state licensing requirement for property tax representatives (unlike TX TDLR)
