// Makes every page agree with scripts/site.json. Run: npm run build:facts
// (the first step of npm run build).
//
// Why: the WhatsApp number was written 338 times across 92 files, the call
// number 189 times and the Facebook link 163 times, in four or five formats
// each. Changing one by hand guaranteed a missed spot, and a missed phone
// number is a farmer calling a line nobody answers.
//
// How: scripts/site.applied.json records the values the pages were last
// synced to. When scripts/site.json differs, every format of the old value is
// replaced with the same format of the new one, across pages, generators,
// scripts and llms files. Then the applied file is updated. Nothing changes
// when the two agree, so the step is safe to run on every build.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const SITE = join(root, 'scripts/site.json');
const APPLIED = join(root, 'scripts/site.applied.json');
const site = JSON.parse(await readFile(SITE, 'utf8'));
let applied;
try { applied = JSON.parse(await readFile(APPLIED, 'utf8')); } catch { applied = null; }

/** Every way a Bangladeshi mobile number is written on the site, from "01303-438063". */
export function phoneFormats(local) {
  const digits = local.replace(/\D/g, '');           // 01303438063
  if (!/^01\d{9}$/.test(digits)) throw new Error(`scripts/site.json: "${local}" is not an 11-digit Bangladeshi mobile number`);
  const rest = digits.slice(1);                       // 1303438063
  return [
    `880${rest}`,                                     // wa.me/8801303438063, tel:+8801303438063, JSON-LD
    `+880 ${rest.slice(0, 4)}-${rest.slice(4)}`,      // +880 1303-438063 (visible)
    `0${rest.slice(0, 4)}-${rest.slice(4)}`,          // 01303-438063 (visible, local)
  ];
}

function pairs(key, oldV, newV) {
  if (key === 'whatsapp' || key === 'call') {
    const o = phoneFormats(oldV); const n = phoneFormats(newV);
    return o.map((v, i) => [v, n[i]]);
  }
  if (key === 'callExtra') {
    return oldV.flatMap((v, i) => (newV[i] ? phoneFormats(v).map((f, j) => [f, phoneFormats(newV[i])[j]]) : []));
  }
  return [[oldV, newV]];
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(root, dir || '.'), { withFileTypes: true })) {
    if (['node_modules', '.git', '.wrangler', 'img', 'fonts', 'css'].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(rel));
    else if (/\.(html|mjs|js|txt|json|md)$/.test(e.name)
      && !['scripts/site.json', 'scripts/site.applied.json', 'package.json', 'package-lock.json', 'scripts/competitor-snapshot.json'].includes(rel)) out.push(rel);
  }
  return out;
}

if (!applied) {
  // First run: record the current values as what the pages already say.
  await writeFile(APPLIED, `${JSON.stringify(site, null, 2)}\n`);
  console.log('Recorded scripts/site.applied.json (first run, nothing to rewrite).');
  process.exit(0);
}

const todo = [];
for (const key of Object.keys(site)) {
  if (key.startsWith('_')) continue;
  if (JSON.stringify(site[key]) === JSON.stringify(applied[key])) continue;
  if (applied[key] === undefined) continue;          // a new key: nothing on the pages to rewrite yet
  todo.push(...pairs(key, applied[key], site[key]).filter(([o, n]) => o !== n));
}
if (!todo.length) { console.log('Facts: pages already match scripts/site.json.'); process.exit(0); }

let files = 0; let hits = 0;
for (const file of await walk('')) {
  const before = await readFile(join(root, file), 'utf8');
  let after = before;
  for (const [o, n] of todo) {
    const c = after.split(o).length - 1;
    if (c) { hits += c; after = after.split(o).join(n); }
  }
  if (after !== before) { await writeFile(join(root, file), after); files += 1; }
}
await writeFile(APPLIED, `${JSON.stringify(site, null, 2)}\n`);
console.log(`Facts: ${hits} replacement(s) in ${files} file(s):`);
for (const [o, n] of todo) console.log(`  ${o} -> ${n}`);
