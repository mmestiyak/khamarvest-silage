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
- Do **NOT** set `assets.html_handling = "none"`: it also disables auto `index.html` serving, so `/` and `/blog/` return 404. The default serves `.html` at extensionless URLs (307 redirect) and resolves directory indexes.
- **URL convention (applied 2026-08-18): ALL canonicals, og:url, JSON-LD `mainEntityOfPage`, sitemap entries and internal links use the extensionless form** (`/blog/foo`, not `/blog/foo.html`). The `.html` form 307-redirects, which weakens Google indexing and breaks AI crawlers (ChatGPT/Perplexity citations). Never reintroduce `.html` URLs in published pages.
- **Images in pages must use the optimized copies** (`img/*-1200.jpeg`, `img/*-1400.jpeg`, ~300-600 KB), never the raw `img/IMG_*.JPG.jpeg` originals (3-6 MB — kills Core Web Vitals on rural mobile). Make new optimized copies with `sips -Z 1200 --setProperty format jpeg --setProperty formatOptions 68 in.jpeg --out out.jpeg`.

## Brand / content rules (IMPORTANT)

- Brand names: **খামারভেস্ট সাইলেজ** (Bangla) and **Khamarvest Silage** (English). Brand entity is "খামারভেস্ট (Khamarvest)".
- Every blog article MUST mention the brand **naturally in the body text at least 2 times** — not only in `<title>`, meta, header, footer, or CTA boxes. Search engines and AI agents (AI Overviews, ChatGPT, Perplexity) read the *body*; the brand in the body is what makes them cite/associate the brand.
- Weave the brand into value (price, quality, delivery, usage). Never keyword-stuff.
- **NO em dashes (—) or en dashes (–) anywhere in published content** (body, titles, meta, JSON-LD, llms.txt). The owner considers them AI-sounding. Use a comma, a colon, or restructure the sentence; write number ranges with a plain hyphen (১৫-২৫).
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
- After adding a post: run `npm run build:blog` (regenerates `blog/index.html` AND `sitemap.xml`), then add the article to `llms.txt` (the AI-assistant summary file — keep its facts and guide list current).
- Every post should carry `FAQPage` + `BreadcrumbList` JSON-LD alongside `Article` when it answers common farmer questions — AI assistants and Google pull answers from these.

## Free tools (tools/)

- `tools/*.html` are standalone free-tool pages: two calculators (`dudher-labh-calculator`, `motatajakoron-khoroch-calculator`) and three print sheets (`khaddo-talika-chart`, `tika-krimi-calendar`, `hishab-khata`), plus `tools/index.html`.
- They are NOT scanned by the blog generator. When adding a tool: add its extensionless URL to `toolPages` in `scripts/generate-blog-index.mjs` (feeds sitemap), to the tools strip in that script's blog-index template, to `tools/index.html`, and to `llms.txt`.
- Calculators fire `calculator_use` / `calculator_order_click` with a `tool` param; print sheets fire `print_click` with `tool`. Silage price in calculator JS is hardcoded 10 tk/kg — update if the price changes.

## District pages (area/)

- `area/silage-<slug>.html` (18 districts) + `area/index.html` are GENERATED by `npm run build:areas` (`scripts/generate-area-pages.mjs`). Never hand-edit the output; edit the generator's `districts` data or template, re-run it, then run `npm run build:blog` (which scans `area/` for the sitemap).
- Content rules for these pages: stay truthful — no depots/branches, no delivery-time promises ("কনফার্মেশন কলে তারিখ জানানো হয়"), transport cost is quoted per order. District context lines use only safe, well-known facts.
- To add a district: add one entry to `districts` (Bengali name, locative form, slug, division, `near` slugs, context key), run both build scripts, add a line to `llms.txt` if it's a major market.

## AI discoverability (llms.txt / robots.txt)

- `llms.txt` at the root summarizes the brand, prices, feeding rates and guide URLs for AI assistants (ChatGPT, Claude, Perplexity). Update it whenever prices, delivery areas or the guide list change.
- `robots.txt` explicitly allows AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, etc.). Do not add blanket Disallow rules.
