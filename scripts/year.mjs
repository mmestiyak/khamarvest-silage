// Keeps every "this year" reference current. Run: npm run build:year (part of
// npm run build).
//
// Why: "© ২০২৬" sat in 91 footers and "দাম (২০২৬)" on 35 price boxes. On
// 1 January each of them would quietly start saying last year, which reads to
// a farmer as a shop that stopped updating, and to Google as a stale page.
//
// What it rewrites, and only these:
//   - "© YYYY" (Bengali digits), the copyright line in every footer;
//   - "দাম (YYYY)", the heading of the price boxes.
// A year inside a sentence ("২০২৬ সালে দাম ছিল ১০ টাকা") is history, not a
// label, and is never touched. Titles that carry a year (the English page)
// are an SEO decision; the watchdog flags them when the year turns.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bn } from './product.mjs';

const root = process.cwd();
// Bengali digits without the thousands comma a plain bn() would add
const year = bn(new Date().getFullYear()).replace(/,/g, '');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', 'img', 'js', 'css', 'fonts'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(rel));
    else if (e.name.endsWith('.html') || (dir === 'scripts' && e.name.endsWith('.mjs') && e.name !== 'year.mjs')) out.push(rel);
  }
  return out;
}

let changed = 0;
for (const file of await walk('')) {
  const before = await readFile(join(root, file), 'utf8');
  const after = before
    .replace(/©(\s*)[০-৯]{4}/g, `©$1${year}`)
    .replace(/দাম \([০-৯]{4}\)/g, `দাম (${year})`);
  if (after !== before) { await writeFile(join(root, file), after); changed += 1; }
}
console.log(`Year labels set to ${year} in ${changed} file(s).`);
