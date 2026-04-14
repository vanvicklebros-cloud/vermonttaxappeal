# Design System — VermontTaxAppeal.com

Clean, professional light UI with orange accent. Matches the LowerMyCommercialTax.com TX design system. All tokens defined in `dist/_astro/BaseLayout.css`.

---

## Color Palette

| Token | Value | Usage |
|---|---|---|
| Primary | `#f97316` | CTAs, accents, highlights |
| Primary dark | `#ea580c` | Hover states |
| Accent | `#1e3a5f` | Hero gradient accent |
| Dark | `#0f172a` | Hero bg, footer bg, headings |
| Dark card | `#1e293b` | Dark section backgrounds |
| Text | `#1e293b` | Body text |
| Text light | `#64748b` | Secondary text, descriptions |
| Light | `#f8fafc` | Alt section backgrounds |
| White | `#ffffff` | Cards, page background |
| Border | `#e2e8f0` | Card borders, dividers |
| Success | `#16a34a` | Status indicators |

---

## Key CSS Classes

| Class | What it does |
|---|---|
| `.hero` | Dark gradient hero section |
| `.section` | Standard page section (64px padding) |
| `.section-alt` | Light gray background section |
| `.section-dark` | Dark background section |
| `.btn-primary` | Orange filled CTA button |
| `.btn-outline` | White outlined button (for dark backgrounds) |
| `.card` | White bordered card with hover shadow |
| `.card-grid` | Auto-fit responsive grid for cards |
| `.stats-row` | Grid of stat items |
| `.steps` | Numbered step cards with counter |
| `.faq-item` | FAQ question/answer with bottom border |
| `.trust-badge` | Semi-transparent badge pill |
| `.prose` | Typography for long-form content |

---

## Typography Scale

| Class | Usage |
|---|---|
| `clamp(2rem,5vw,3.2rem) font-weight:800` | Hero headlines |
| `clamp(1.5rem,3vw,2.2rem) font-weight:700` | Section headings |
| `1.2rem` | Card headings |
| `1.1rem` | Subtitle text |
| `0.95rem` | Card body, FAQ answers |
| `0.9rem` | Nav links, labels |
| `0.85rem` | Footer links |
| `0.8rem` | Fine print, meta |

---

## Nav & Footer

- **Nav:** Sticky white header, logo = "VT" + orange "Tax" + "Appeal" wordmark
- **Footer:** Dark navy, 4-col grid
- **Mobile:** Hamburger toggle at 768px breakpoint
