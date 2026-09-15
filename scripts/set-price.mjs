// Changes the silage price everywhere it appears, in one command.
// Run: node scripts/set-price.mjs --per-kg 12 --bag 600 [--dry]
//
// Why this exists: the price is written in 398 places across 72 pages, three
// calculator scripts, the JSON-LD offers, llms.txt and the page generators.
// Changing it by hand guarantees a missed spot, and a missed spot means a
// farmer reads one price and is charged another. That is worse than any
// ranking problem.
//
// Safety: every replacement is an explicit, enumerated pattern. Anything that
// looks price-shaped but does not match a known pattern is REPORTED, not
// rewritten, so an unexpected phrasing surfaces instead of being mangled.
// After running this, `npm run check` fails if any page still shows the old
// price, so a partial change cannot ship.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bn } from './product.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const DRY = args.includes('--dry');
const newPerKg = Number(flag('--per-kg'));
const newBag = Number(flag('--bag'));
if (!newPerKg || !newBag) {
  console.error('Usage: node scripts/set-price.mjs --per-kg <taka> --bag <taka> [--dry]');
  process.exit(2);
}

const root = process.cwd();
const productPath = join(root, 'scripts/product.json');
const data = JSON.parse(await readFile(productPath, 'utf8'));
const oldPerKg = data.pricePerKg;
const oldBag = data.bagPrice;
if (oldPerKg === newPerKg && oldBag === newBag) { console.log('Price is already that. Nothing to do.'); process.exit(0); }

const [oK, nK, oB, nB] = [bn(oldPerKg), bn(newPerKg), bn(oldBag), bn(newBag)];

// Every place the price is legitimately written. Bare `N টাকা` is only ever
// rewritten when it sits next to "কেজি" or "বস্তা", never on its own.
const TAGS = '(?:<[^>]*>|\\s)*';   // markup and whitespace can sit inside a phrase
// A price must not match inside a larger number: "৬০০ টাকা" is a substring of
// "৩,৬০০ টাকা", and without this guard a round trip silently rewrote a computed
// profit figure of 3,600 to 3,500.
const NOTNUM = '(?<![০-৯,])';
const RULES = [
  // Per-kg. The bare number is only ever touched when "কেজি" precedes it or
  // "কেজি" follows it, so a price is never confused with another amount.
  [new RegExp(`${NOTNUM}${oK} টাকা কেজি`, 'g'), `${nK} টাকা কেজি`],
  [new RegExp(`${NOTNUM}${oK} টাকা/কেজি`, 'g'), `${nK} টাকা/কেজি`],
  [new RegExp(`(কেজি${TAGS})${oK}( টাকা)`, 'g'), `$1${nK}$2`],
  [new RegExp(`(মাত্র${TAGS})${oK}( টাকা)`, 'g'), `$1${nK}$2`],
  [new RegExp(`${NOTNUM}${oK} টাকা দরে`, 'g'), `${nK} টাকা দরে`],
  // The bag price: verified to appear only in bag or per-kg context sitewide.
  [new RegExp(`${NOTNUM}${oB} টাকা`, 'g'), `${nB} টাকা`],
  // Structured data and calculator constants.
  [new RegExp(`"price":\\s*"${oldPerKg}"`, 'g'), `"price": "${newPerKg}"`],
  [new RegExp(`"price":\\s*"${oldBag}"`, 'g'), `"price": "${newBag}"`],
  [new RegExp(`SILAGE_PRICE = ${oldPerKg}\\b`, 'g'), `SILAGE_PRICE = ${newPerKg}`],
  [new RegExp(`\\bPRICE = ${oldPerKg}\\b`, 'g'), `PRICE = ${newPerKg}`],
];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', 'img', 'fonts', 'css'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(rel));
    else if (/\.(html|mjs|txt|js)$/.test(e.name) && e.name !== 'product.json') out.push(rel);
  }
  return out;
}

let filesChanged = 0;
let replacements = 0;
const leftovers = [];
for (const file of await walk('')) {
  if (file === 'scripts/set-price.mjs' || file === 'scripts/product.mjs') continue;
  const before = await readFile(join(root, file), 'utf8');
  let after = before;
  for (const [re, to] of RULES) {
    const hits = after.match(re);
    if (!hits) continue;
    replacements += hits.length;
    after = after.replace(re, to);
  }
  if (after !== before) {
    if (!DRY) await writeFile(join(root, file), after);
    filesChanged += 1;
  }
  // Anything still carrying the old number in a price-shaped context is a
  // phrasing the rules do not cover. Report it rather than guess.
  for (const m of after.matchAll(new RegExp(`.{0,24}(?:${oK}|${oB}) টাকা.{0,16}`, 'g'))) {
    const snippet = m[0].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (/[০-৯]-[০-৯]/.test(snippet)) continue;            // a range: another feed's price
    if (new RegExp(`(?:${nK}|${nB}) টাকা`).test(snippet)) continue; // already the new price
    leftovers.push(`${file}: ${snippet}`);
  }
}

if (!DRY) {
  data.pricePerKg = newPerKg;
  data.bagPrice = newBag;
  data.history.push({ from: new Date().toISOString().slice(0, 10), pricePerKg: newPerKg, bagPrice: newBag });
  await writeFile(productPath, `${JSON.stringify(data, null, 2)}\n`);
}

console.log(`${DRY ? '[dry run] ' : ''}${oldPerKg} -> ${newPerKg} tk/kg, ${oldBag} -> ${newBag} tk/bag`);
console.log(`${replacements} replacement(s) across ${filesChanged} file(s).`);
if (leftovers.length) {
  console.log(`\n${leftovers.length} place(s) still mention the old price and need a human look:`);
  [...new Set(leftovers)].slice(0, 30).forEach((l) => console.log(`  - ${l}`));
} else {
  console.log('No unhandled occurrences left.');
}
console.log(`\nNext:`);
console.log(`  1. npm run verify${DRY ? '   (after running this without --dry)' : ''}`);
console.log('  2. Fix anything listed above as needing a human, especially derived sums:');
console.log('     a line like "১৫০ টাকা (১৫ কেজি × ১০ টাকা)" has a total that must be recomputed.');
console.log('  3. Update priceValidUntil in scripts/product.json and index.html if the year moved.');
console.log('  4. Consider adding one line to /blog/vutta-silage-dam-koto-kothay-kinben saying what');
console.log('     the price was before and why it changed. A farmer who remembers the old price');
console.log('     trusts an explanation more than a silently updated number.');
