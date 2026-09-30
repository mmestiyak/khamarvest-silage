# Changing things on silage.khamarvest.com

Every fact that can change lives in **one place**. You change it there, run one
command, and every page, the Google schema, the calculators, the Facebook posts
and `llms.txt` follow. Then check and publish:

```bash
npm run verify     # rebuilds everything and checks all ~90 pages; must end with "OK"
git add -A && git commit -m "…" && git push   # pushing to main publishes the site
```

If `npm run verify` shows an error, it says which page and what to do. Nothing
is published until you push.

## What you can change, and where

| To change | Edit | Then run |
|---|---|---|
| **Price** (per kg and per bag) | nothing by hand | `npm run set-price -- --per-kg 9 --bag 450`, then `npm run verify` |
| **WhatsApp number** | `scripts/site.json` > `whatsapp` | `npm run verify` |
| **Call number** (sticky bar, district pages) | `scripts/site.json` > `call` | `npm run verify` |
| **Other call numbers** on the homepage footer | `scripts/site.json` > `callExtra` | `npm run verify` |
| **Facebook page / YouTube channel link** | `scripts/site.json` > `facebook`, `youtube` | `npm run verify` |
| **Google Analytics ID** | `scripts/site.json` > `ga4` | `npm run verify` |
| **"Price valid until" date** (Google shows the price until then) | `scripts/product.json` > `priceValidUntil` | `npm run verify` |
| **A district** (add or remove) | `districts` list in `scripts/generate-area-pages.mjs` | `npm run verify` |
| **An FAQ question or answer** | the visible FAQ on that page, between `<!-- faq:start -->` and `<!-- faq:end -->` | `npm run verify` (the Google schema copy is rewritten from it) |
| **A new guide** | ask Claude: `/write-article` | it follows `.claude/skills/write-article/SKILL.md` |

Write phone numbers in `site.json` the local way, `01303-438063`. The build
writes every other form itself (`wa.me/8801303438063`, `+880 1303-438063`,
`tel:+8801303438063`).

## What changes by itself

- **Totals that depend on the price** ("৩৬ বস্তা = ১৫,৩০০ টাকা", "দিনে ১৭০ টাকা").
  Each one carries its formula in the page (`<!--=36*bag-->১৫,৩০০<!--/=-->`), and every
  build recomputes it. Never type such a number by hand; copy the formula instead.
- **The year** in every footer ("© ২০২৬") and on the price boxes ("দাম (২০২৬)").
  On 1 January a GitHub Action rolls them forward and opens an issue listing the few
  titles and sentences that mention last year, for you to judge.
- **The "আগের দাম"** (old price) on the homepage follows `product.json > history`.
  If the price ever goes **up**, the check fails until the "দাম কমেছে" block is rewritten,
  because it would no longer be true.

## What still needs a person

- **Sentences that explain a number** ("কেজি ২৫ টাকার খড়ে … সাইলেজের সমান"): the
  arithmetic is recomputed, but whether the sentence still makes sense is a judgment.
  `npm run set-price` lists anything it could not handle.
- **One line of price history** in `/blog/vutta-silage-dam-koto-kothay-kinben` when the
  price changes, saying what it was and why it moved.
- **Titles with a year** (the English page's "… Price in Bangladesh 2026"). The new-year
  issue reminds you.
- **Trust rules**: no customer quotes we do not have, no profit promises, no delivery
  dates. The check enforces the wording it knows; see AGENTS.md for the full list.

## How the pieces fit (for whoever maintains it next)

`npm run build` runs, in order: `build:facts` (site.json → every page) → `build:year` →
`build:areas` (district pages) → `build:related` → `build:ration` → `build:calc`
(formulas) → `build:faq` (visible FAQ → schema) → `build:blog` (index, sitemap, feed) →
`build:images` → `build:favicon` → `build:orderbar` → `build:css`. Each step only
rewrites the part of a page between its own markers, so running the build twice changes
nothing. `npm run check` then verifies every rule in AGENTS.md.
