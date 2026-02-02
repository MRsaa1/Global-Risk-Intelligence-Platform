# WordPress Pages for Google Startup/Cloud (public URLs)

## Goal
Make **all verifiable information** available on the **main domain** `saa-alliance.com` via **direct URLs** (not JS modals).

This folder contains **ready-to-paste HTML** for each required WordPress Page.

---

## Risk Analyzer page URL

The "View Details" → Risk Analyzer link points to **`/platform-risk-analyzer/`** (no slash between platform and risk-analyzer). If your WordPress page is a **top-level** page with slug `platform-risk-analyzer`, the URL is https://saa-alliance.com/platform-risk-analyzer/ — that matches. If you created it as a child of Platform with slug `risk-analyzer`, the URL would be `/platform/risk-analyzer/`; then either change the page slug/parent to get `/platform-risk-analyzer/`, or update the links in `platform/index.html` and `elementor-full.html` to `/platform/risk-analyzer/`.

---

## Create pages (WordPress Admin)
Go to **WP Admin → Pages → Add New** and create pages with these **exact slugs** (Permalink):

## Styling (corporate look)
Each template in this folder is **self-contained** and includes a scoped `<style>` block.
You can paste the page HTML directly — it will render in the **SAA corporate dark/gold style** without extra theme configuration.

If you prefer to keep CSS global and not repeat it per page, see:
`wp-pages/_shared/SAA_CORPORATE_STYLE_SNIPPET.html` (paste once into a reusable HTML block or site-wide CSS and remove duplicates later).

### Core
- `/team/` → paste `team.html`
- `/how-it-works/` → paste `how-it-works.html`
- `/platform/` → paste `platform/index.html`

### Platform module pages (children of `/platform/`)
Create these pages as **children** of the “Platform” page (so the URL becomes `/platform/<slug>/`):
- `/platform-prediction-market/` (top-level slug) → paste `platform/prediction-market.html`
- `/platform-investment-dashboard/` → paste `platform/investment-dashboard.html`
- `/platform-digital-assets-analytics/` (top-level slug) → paste `platform/digital-assets-analytics.html`
- `/platform-risk-analyzer/` (or `/platform/risk-analyzer/` if child of Platform) → paste `platform/risk-analyzer.html`
- `/platform-arin/` → paste `platform/arin.html`
- `/platform-news-analytics/` (top-level slug) → paste `platform/news-analytics.html`
- `/platform-physical-financial-risk-platform/` (top-level page with slug `platform-physical-financial-risk-platform`) → paste `platform/physical-financial-risk-platform.html`. Если создаёте как дочернюю под Platform, URL будет /platform/physical-financial-risk-platform/ — на вашем сайте такой URL может отдавать пустую страницу; используйте топ-уровень.

### Recommended (top-level)
- `/about/` → paste `about.html`
- `/contact/` → paste `contact.html`
- `/faq/` → paste `faq.html`
- `/privacy-policy/` → paste `privacy-policy.html`
- `/terms/` → paste `terms.html`

## Notes (important for reviewers)
- Ensure pages are **Public** (visibility: Public, status: Published).
- Ensure **no login** is required to view any of these URLs.
- For `/how-it-works/`, the template includes a **Live demo link**. If you have a video/screenshot assets, replace the “TODO” placeholders with real media URLs from WP Media Library.
  - Recommended: add 2 screenshots + 1 short video (or GIF) hosted via WordPress Media Library.

## What was changed in the landing HTML widget
In `saa-landing/elementor-full.html`:
- Header navigation now routes to real pages:
  - About → `/about/`
  - Team → `/team/`
  - How it works → `/how-it-works/`
  - Contact → `/contact/`
  - FAQ → `/faq/`
  - Privacy Policy → `/privacy-policy/`
  - Terms → `/terms/`
- “View Details” on service cards now routes to module pages under `/platform/.../`.

