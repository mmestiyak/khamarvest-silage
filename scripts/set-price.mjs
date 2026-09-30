// Changes the silage price everywhere it appears, in one command.
// Run: node scripts/set-price.mjs --per-kg 12 --bag 600 [--dry]
//
// Why this exists: the price is written in 398 places across 72 pages, three
// calculator scripts, the JSON-LD offers, llms.txt, llms-full.txt and the page generators.
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
import { bn, money, moneyEn } from './product.mjs';

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

const TODAY = new Date().toISOString().slice(0, 10);
const [oK, nK, oB, nB] = [money(oldPerKg), money(newPerKg), bn(oldBag), bn(newBag)];
// English copy and JSON-LD use Latin digits, and two decimals for a non-whole price.
const [eK, eNK] = [moneyEn(oldPerKg), moneyEn(newPerKg)];
// A price like ৮.৫০ carries a dot; inside a RegExp it must be literal.
const oKr = oK.replace(/\./g, '\\.');

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
  [new RegExp(`${NOTNUM}${oKr} টাকা কেজি`, 'g'), `${nK} টাকা কেজি`],
  [new RegExp(`${NOTNUM}${oKr} টাকা/কেজি`, 'g'), `${nK} টাকা/কেজি`],
  [new RegExp(`(কেজি${TAGS})${oKr}( টাকা)`, 'g'), `$1${nK}$2`],
  [new RegExp(`(মাত্র${TAGS})${oKr}( টাকা)`, 'g'), `$1${nK}$2`],
  [new RegExp(`${NOTNUM}${oKr} টাকা দরে`, 'g'), `${nK} টাকা দরে`],
  // The bag price, only where "বস্তা" sits within the 60 characters before it.
  // Without that, the four-neighbour transport share "২,০০০ ÷ ৪ = ৫০০ টাকা"
  // was rewritten to the new bag price on the 2026-09-30 change.
  [new RegExp(`(বস্তা(?:(?!পরিবহন)[^।"]){0,60}?)${NOTNUM}${oB}( টাকা)`, 'g'), `$1${nB}$2`],
  // Structured data and calculator constants.
  [new RegExp(`"price":\\s*"${eK}"`, 'g'), `"price": "${eNK}"`],
  [new RegExp(`"price":\\s*"${oldBag}"`, 'g'), `"price": "${newBag}"`],
  [new RegExp(`SILAGE_PRICE = ${oldPerKg}\\b`, 'g'), `SILAGE_PRICE = ${newPerKg}`],
  [new RegExp(`\\bPRICE = ${oldPerKg}\\b`, 'g'), `PRICE = ${newPerKg}`],
  // The homepage calculator prices by the bag.
  [new RegExp(`\\bPRICE_PER_BAG = ${oldBag}\\b`, 'g'), `PRICE_PER_BAG = ${newBag}`],
  // English wording: corn-silage-bangladesh and the English key facts in
  // llms.txt / llms-full.txt ("BDT 10 per kg", "BDT 10/kg", "BDT 500").
  [new RegExp(`\\bBDT ${eK.replace('.', '\\.')}(/kg| per kg)`, 'g'), `BDT ${eNK}$1`],
  [new RegExp(`\\bBDT ${oldBag}(?![\\d,])`, 'g'), `BDT ${newBag}`],
  // The offers' validFrom is the day this price took effect, the same date
  // recorded in product.json > history below.
  [/"validFrom":\s*"\d{4}-\d{2}-\d{2}"/g, `"validFrom": "${TODAY}"`],
];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', '.claude', 'img', 'fonts', 'css'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(rel));
    // .txt covers llms.txt and llms-full.txt, which assistants quote verbatim.
    // .json covers scripts/social-posts.json, the Facebook posts; product.json is written below.
    else if (/\.(html|mjs|txt|js|json)$/.test(e.name) && e.name !== 'product.json' && e.name !== 'package.json' && e.name !== 'package-lock.json' && e.name !== 'competitor-snapshot.json') out.push(rel);
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
  for (const m of after.matchAll(new RegExp(`.{0,24}(?:${oKr}|${oB}) টাকা.{0,16}`, 'g'))) {
    const snippet = m[0].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (/[০-৯]-[০-৯]/.test(snippet)) continue;            // a range: another feed's price
    if (new RegExp(`(?:${nK}|${nB}) টাকা`).test(snippet)) continue; // already the new price
    leftovers.push(`${file}: ${snippet}`);
  }
  // Same for English prices. English derived sums ("BDT 200 per day" on
  // corn-silage-bangladesh) match neither rule, so they need a human look too.
  for (const m of after.matchAll(new RegExp(`.{0,24}BDT (?:${oldPerKg}|${oldBag})(?![\\d,]).{0,16}`, 'g'))) {
    leftovers.push(`${file}: ${m[0].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}`);
  }
}

if (!DRY) {
  data.pricePerKg = newPerKg;
  data.bagPrice = newBag;
  data.history.push({ from: TODAY, pricePerKg: newPerKg, bagPrice: newBag });
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
