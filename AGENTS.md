# AGENTS.md — Khamarvest Silage

Guidance for AI agents (and humans) working on this repo. Read this before editing.

## What this is

A static marketing + content site for **খামারভেস্ট সাইলেজ (Khamarvest Silage)** — corn/maize silage sold to Bangladeshi cattle farmers.

- Landing page: `index.html` (interactive silage calculator, WhatsApp-first ordering).
- Blog: `blog/*.html` plus root article `vutta-silage-prothombar-khawano-rules.html`.
- Domain: `https://silage.khamarvest.com`

## Tech / workflow

- Plain static HTML + Tailwind via CDN (no per-page build step).
- `npm run build:blog` regenerates `blog/index.html` from the articles (`scripts/generate-blog-index.mjs`).
- Local preview: `node .claude/serve.js` → `http://localhost:8321` (serves directory index, e.g. `/blog/`).
- Deploy: Cloudflare Workers Assets (`wrangler.jsonc`, `assets.directory = "."`). **Pushing to `main` auto-deploys** via the Cloudflare GitHub integration — no manual `wrangler deploy` needed.
- Do **NOT** set `assets.html_handling = "none"`: it also disables auto `index.html` serving, so `/` and `/blog/` return 404. The default serves `.html` at extensionless URLs (307 redirect) and resolves directory indexes. If you ever change canonical/sitemap URLs, use the extensionless form (`/blog/foo`, not `/blog/foo.html`).

## Brand / content rules (IMPORTANT)

- Brand names: **খামারভেস্ট সাইলেজ** (Bangla) and **Khamarvest Silage** (English). Brand entity is "খামারভেস্ট (Khamarvest)".
- Every blog article MUST mention the brand **naturally in the body text at least 2 times** — not only in `<title>`, meta, header, footer, or CTA boxes. Search engines and AI agents (AI Overviews, ChatGPT, Perplexity) read the *body*; the brand in the body is what makes them cite/associate the brand.
- Weave the brand into value (price, quality, delivery, usage). Never keyword-stuff.
- Key product facts — keep these consistent across all content:
  - Price: ৫০ কেজি বস্তা = ৫০০ টাকা (১০ টাকা/কেজি).
  - Daily silage: দুধের গাভী ২০ কেজি, মোটাতাজাকরণ ১৫ কেজি, ছাগল/ভেড়া ১.৫ কেজি (mid-range of extension guidance).
  - Storage: airtight bag keeps ৬–১২ মাস; after opening use within ২–৩ দিন.
  - Contact: WhatsApp `+880 1303-438063` (`wa.me/8801303438063`). Facebook: `facebook.com/khamarvestSilage`.
- Every article needs: `<title>` ending in `| খামারভেস্ট` (or `| খামারভেস্ট সাইলেজ`), a meta description, canonical URL, and `Article` JSON-LD with `author`/`publisher` = "খামারভেস্ট (Khamarvest)".

## Data accuracy

- Feeding rates / prices must stay within published ranges (dairy 15–25 kg/day, beef 10–20 kg/day, goat/sheep 1–2 kg/day; concentrate ৪০–৫৫ টাকা/কেজি, silage ১০ টাকা/কেজি).
- Cite sources (DAERA, Teagasc) in a "তথ্যসূত্র" section when making factual claims. Do not invent savings/productivity numbers.

## Analytics (GA4)

- Measurement ID: `G-4SVWY8JWBX`. The homepage loads it inline; blog pages load `/js/ga.js`.
- All events fire through the `gaEvent(name, params)` helper.
- Event names are `snake_case` lowercase. Mark these as key events in GA4:
  - `whatsapp_click` — WhatsApp order CTA (**primary conversion**). Params: `link_location`, `link_url`.
  - `facebook_click` — Facebook link. Params: `link_url`.
  - `video_play` — YouTube play. Params: `video_id`, `video_title`.
  - `calculator_use` — calculator inputs changed (debounced ~1.5s). Params: `animal_type`, `animal_count`, `duration_days`.
  - `calculator_order_click` — calculator → WhatsApp. Params: `animal_type`, `animal_count`, `duration_days`, `bags`.
  - `order_details_submitted` — order form → WhatsApp. Params: `submission_method`.
  - `article_view` — blog article loaded. Params: `page_title`, `page_path`.
  - `page_view` — non-article page loaded (e.g. blog index).

## Editing Bengali text

- Content is Bengali with combining characters (e.g. য়, ড়, "সাশ্রয়"). Manual find/replace of Bengali often fails on encoding (precomposed vs decomposed). Prefer a Python script that matches ASCII anchors or uses `[^<]*` for the Bengali, rather than retyping Bengali into an edit tool.
- Keep `lang="bn"`. Homepage `font-hind` maps to "Noto Sans Bengali"; blog pages use "Hind Siliguri" — keep consistent with the file you're editing.

## Blog workflow

- Copy `blog/article-template.html` for a new post (it has a body brand-reminder placeholder).
- After adding a post: run `npm run build:blog`, then add the URL to `sitemap.xml`.
