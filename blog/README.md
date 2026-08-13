# Publishing a new article

1. Copy `article-template.html` to `blog/your-english-keyword-slug.html`.
2. Replace every `[PLACEHOLDER]`, change robots from `noindex, nofollow` to `index, follow`, and add accurate Article structured data with `datePublished`.
3. Run `node scripts/generate-blog-index.mjs` from the project root.
4. Check the new page, `/blog/`, and `sitemap.xml` before deploying.

Use one article for one real farmer question. Include the practical answer, limitations, and only claims you can support.

## Writing standard

- Write like an experienced Bangladeshi farmer or adviser speaking plainly. Use natural Bangla, short sentences, and familiar farm terms.
- Start with the farmer's actual problem. Give steps, observations, limits and what to do next. Do not pad an article with generic introductions.
- Never invent results, percentages, feeding quantities, customer stories, prices or expert claims. Say when a local veterinarian, livestock officer or nutritionist should be consulted.
- Avoid sales language, exaggerated promises and formulaic AI phrases such as “unlock”, “game changer”, “in today’s world”, or “revolutionary”.
- Do not use em dashes or en dashes. Use a full stop, comma, colon or parentheses instead.
- Read the article aloud before publishing. If it does not sound like something a real person would say to a farmer, rewrite it.
