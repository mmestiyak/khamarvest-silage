// Ensures every page declares the favicon. Run: npm run build:favicon (part of build).
//
// Why: only the homepage declared an icon, and it did so as a `data:` URI, which
// Google's favicon crawler does not accept. /favicon.ico returned 404, which is
// the "Not found (404)" Search Console was reporting. The result was a generic
// globe next to every one of our results in mobile search.
//
// Idempotent: it strips the block it previously wrote before inserting.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const OPEN = '<!-- favicon:start -->';
const CLOSE = '<!-- favicon:end -->';
const BLOCK = `${OPEN}<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/favicon-180.png">${CLOSE}`;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', 'img', 'js', 'css', 'fonts', 'scripts'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(rel));
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

let changed = 0;
for (const file of await walk('')) {
  const before = await readFile(join(root, file), 'utf8');
  // Consume the leading whitespace too, otherwise each run leaves three more
  // bytes behind than it removed and every page slowly grows.
  let html = before.replace(new RegExp(`\\s*${OPEN}[\\s\\S]*?${CLOSE}`, 'g'), '');
  // The homepage carried a data: URI icon, which Google cannot fetch.
  html = html.replace(/\s*<link rel="icon" href="data:image\/svg\+xml[^>]*>/g, '');
  // Anchor on </head>, not the stylesheet: guide-book.html and the GMB scratch
  // page do not link site.css and were being skipped.
  if (!html.includes('</head>')) continue;
  html = html.replace('</head>', `  ${BLOCK}\n</head>`);
  if (html !== before) { await writeFile(join(root, file), html); changed += 1; }
}
console.log(`Favicon links written into ${changed} page(s).`);
