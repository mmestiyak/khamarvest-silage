// Recomputes every price-dependent figure in the pages. Run: npm run build:calc
// (part of npm run build, before build:faq so FAQ schema gets the new values).
//
// Why: set-price rewrites the price itself, but a total written on its own,
// "৩৬ বস্তা = ১৫,৩০০ টাকা", does not contain the price, so no find-and-replace
// can see it. On the 10 -> 8.50 change about forty such sums had to be found
// and recomputed by hand. Now each one carries its formula:
//
//   <!--=36*bag-->১৫,৩০০<!--/=-->
//   <!--=20*30*price-->৫,১০০<!--/=-->
//
// and every build writes the value the formula gives today. The formula is
// the source; never edit the number between the markers by hand.
//
// Names a formula may use (from scripts/product.json):
//   price  per-kg price (8.5)       bag    bag price (425)      bagKg  kg per bag (50)
//   prev   the previous per-kg price (10), for "১.৫০ টাকা কম"
// Operators: + - * / ( ) and numbers. Results are written as money: Bengali
// digits, thousands commas, two decimals only when the value is not whole
// (১২৭.৫০). Filters: `|round` rounds to whole taka (<!--=price/0.3|round-->),
// `|en` writes Latin digits for English copy (<!--=20*price|en-->).
//
// Markers cannot go inside JSON-LD. FAQ answers are fine: the visible FAQ is
// the source and build:faq copies it into the schema, numbers included.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { product, money, moneyEn } from './product.mjs';

const root = process.cwd();
const VARS = { price: product.pricePerKg, bag: product.bagPrice, bagKg: product.bagKg, prev: product.previous ? product.previous.pricePerKg : product.pricePerKg };
export const MARKER = /<!--=([^>]*?)-->([\s\S]*?)<!--\/=-->/g;

export function evaluate(expr, where = '') {
  const [formula, ...filters] = expr.split('|').map((s) => s.trim());
  if (!/^[\s\d.+\-*/()a-zA-Z]*$/.test(formula)) throw new Error(`${where}: formula "${formula}" has characters other than numbers, + - * / ( ) and names`);
  const names = formula.match(/[a-zA-Z]+/g) || [];
  for (const n of names) if (!(n in VARS)) throw new Error(`${where}: unknown name "${n}" in formula "${formula}" (use ${Object.keys(VARS).join(', ')})`);
  // eslint-disable-next-line no-new-func
  const value = Function(...Object.keys(VARS), `return (${formula});`)(...Object.values(VARS));
  if (!Number.isFinite(value)) throw new Error(`${where}: formula "${formula}" did not give a number`);
  for (const f of filters) if (!['round', 'en'].includes(f)) throw new Error(`${where}: unknown filter "${f}" (use round, en)`);
  const v = filters.includes('round') ? Math.round(value) : Math.round(value * 100) / 100;
  return filters.includes('en') ? moneyEn(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : money(v);
}

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

if (import.meta.url === `file://${process.argv[1]}`) {
  let files = 0; let figures = 0;
  for (const file of await walk('')) {
    const before = await readFile(join(root, file), 'utf8');
    const after = before.replace(MARKER, (_, expr) => { figures += 1; return `<!--=${expr}-->${evaluate(expr, file)}<!--/=-->`; });
    if (after !== before) { await writeFile(join(root, file), after); files += 1; }
  }
  console.log(`Calc: ${figures} figure(s) checked, ${files} file(s) updated.`);
}
