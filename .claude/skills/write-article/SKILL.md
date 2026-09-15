---
name: write-article
description: Write, publish and wire up a new Bengali guide (or a new district/tool page) for silage.khamarvest.com. Use whenever the user asks to write an article, a guide, a blog post, নতুন গাইড, নতুন আর্টিকেল, or asks what to write next. Covers picking the topic from the season calendar and real content gaps, sourcing every claim, matching the site conventions, and the five places a new page has to be registered.
---

# Writing a guide for silage.khamarvest.com

Read `AGENTS.md` first. It is the contract; this file is the procedure.

## 1. Pick the topic from evidence, never from instinct

Run these before deciding:

```bash
npm run season          # what the farming calendar says is due, and whether it is
                        # "refresh existing" or "start writing new" (new pages need 2-3 months to rank)
```

Then look for gaps the site has created for itself: terms it keeps using but never explains.

```bash
for t in দানাদার খৈল মিনারেল রুমেন মহিষ ম্যাস্টাইটিস TMR; do
  n=$(grep -rl "$t" --include="*.html" blog/ *.html 2>/dev/null | wc -l | tr -d ' ')
  g=$(grep -l "<title>[^<]*$t" blog/*.html 2>/dev/null | wc -l | tr -d ' ')
  printf "%-14s mentioned on %2s pages | dedicated guide: %s\n" "$t" "$n" "$g"
done
```

A term on 20+ pages with no guide is a stronger signal than any keyword tool.

**Check for cannibalisation before writing.** If an existing page already ranks for the
query, deepen or reposition it instead of adding a second page. The homepage owns
transactional price intent; `/blog/vutta-silage-dam-koto-kothay-kinben` owns evaluative
price intent. Two pages chasing one query split the signal, which has already happened
here once and had to be undone.

If Search Console data is available, it beats all of the above. Ask for the Performance
export (Queries + Pages, last 3 months) and work from that.

## 2. Source every claim before writing a word

Non-negotiable, and the site's whole competitive position rests on it.

- Find real sources, then **verify each URL actually resolves** before citing:
  `curl -s -o /dev/null -w "%{http_code}" -L --max-time 20 -A "Mozilla/5.0" "<url>"`
- 403/405 means bot-blocked, which is acceptable. 404 means find another source.
- Sources that have worked: FAO (`fao.org/4/x8486e/...`), MSD Veterinary Manual,
  ILRI/CGIAR on CGSpace, SDSU / Nebraska / Penn State extension, BanglaJOL for
  Bangladesh-specific research.
- Prefer a figure measured in Bangladesh or the tropics over a temperate-country one, and
  **say where the figure is from** when it is not local ("পূর্ব আফ্রিকার ৩৫০-৫০০ কেজির গাভীর জন্য").
- If a source's table is measured under different conditions than the column you are
  putting it in, say so in the cell rather than hiding it.

**Never invent a number.** No profit figures, no invented customer quotes, no nutrition
claims without a lab report. The checker catches the banned phrases but it cannot catch a
plausible invented statistic.

## 3. Write it

Copy the structure of the most recent guide, currently
`blog/shite-gorur-thanda-jhuki-o-khaddo.html`, or use `blog/article-template.html`.

Required, and mostly enforced by `npm run check`:

- `<title>` **visible span (before the `|`) must be 60 characters or fewer.** Google
  truncates around 55-60 and Bengali glyphs are wider. This has been got wrong repeatedly;
  count it before moving on.
- Title ends `| খামারভেস্ট` or `| খামারভেস্ট সাইলেজ`; meta description 70-320 chars.
- Canonical, `og:url` matching it, all four OG tags, extensionless internal links.
- JSON-LD `Article` + `BreadcrumbList` + `FAQPage`. Author and publisher are exactly
  `খামারভেস্ট (Khamarvest)`. Add `HowTo` when the guide is genuinely a process.
- Brand named naturally in the `<article>` body **at least twice**, woven into value.
- A `তথ্যসূত্র` section with the verified source links.
- No em or en dashes anywhere. Bengali digits ০-৯, never Devanagari ०-९, and no Devanagari
  letters (`टाका` once shipped undetected).
- Sidebar TOC entries must be **in document order and correctly numbered**. Inserting into
  the middle silently produced `1, 3, 4, 5, 2, 3, 4, 5` once.

## 4. Register it in all five places

Missing any of these is the most common failure. The first two throw or fail the build; the
rest are silent.

1. `scripts/related-guides.mjs` → add the slug to `TAGS` (the script throws without it)
2. `llms.txt` → add a detailed entry with the concrete figures (checker warns)
3. `scripts/social-posts.json` → add a post so it reaches Facebook and Google Posts
4. `scripts/season-calendar.mjs` → add to a season's `guides` if it is seasonal
5. `npm run build` → regenerates blog index, sitemap, feed, related blocks, images, CSS

## 5. Verify before committing

```bash
npm run verify        # build + full convention check, must be clean
npm run check:links   # no dead source links
```

Then look at it in a browser at a 375px viewport, which is how nearly every reader arrives:

- no horizontal overflow
- every sidebar anchor resolves
- the hero serves a WebP variant
- the related-guides block rendered
- tables readable

## 6. Commit

Explain **why** the topic was chosen and what the evidence was, not just what was added.
State any assumption the reader would need to check. If something was found broken along
the way, say so plainly rather than fixing it silently.
