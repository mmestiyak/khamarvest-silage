// Writes the mobile order bar (WhatsApp + call) into every page. Run: npm run build:orderbar
// (part of npm run build, after the generators, so area pages get it too).
//
// Why: only the homepage had a floating order button. A blog reader on a phone
// scrolled 11-13 screens before the first WhatsApp link, and /blog/ had none at
// all. The bar is mobile-only (md:hidden) and never printed, so the print
// sheets in tools/ stay clean.
//
// Idempotent: it strips the block it previously wrote before inserting.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { product } from './product.mjs';
import { CALL_TEL, WA_NUMBER } from './contact.mjs';

const root = process.cwd();
const OPEN = '<!-- order-bar:start -->';
const CLOSE = '<!-- order-bar:end -->';

// Pages that already have their own bottom bar, or are not public pages.
const SKIP = new Set([
  'index.html', // floating WhatsApp button of its own
  'tools/ration-generator.html', // mobile result bar sits in the same spot
  'gmb-cover-photo.html',
  'guide-book.html',
]);

const bar = (t) => `${OPEN}
  <div class="h-16 md:hidden print:hidden" aria-hidden="true"></div>
  <div data-cta="sticky_bar" class="fixed inset-x-0 bottom-0 z-40 border-t border-[#184d32]/15 bg-white/95 px-3 py-2 backdrop-blur md:hidden print:hidden">
    <div class="mx-auto flex max-w-lg items-center gap-2">
      <p class="min-w-0 flex-1 text-xs leading-tight text-[#456451]"><strong class="block text-sm text-[#0b5b38]">${t.price}</strong>${t.pay}</p>
      <a href="tel:${CALL_TEL}" class="rounded-xl border border-[#0b5b38]/30 px-3.5 py-2.5 text-sm font-bold text-[#0b5b38]">${t.call}</a>
      <a href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener" class="rounded-xl bg-[#0b5b38] px-4 py-2.5 text-sm font-bold text-white">${t.wa}</a>
    </div>
  </div>
  ${CLOSE}`;
const BN = bar({ price: `${product.perKgBn} টাকা কেজি`, pay: 'পণ্য হাতে পেয়ে টাকা', call: 'কল করুন', wa: 'WhatsApp-এ অর্ডার' });
// corn-silage-bangladesh is lang="en": a Bengali bar on it read as a mistake.
const EN = bar({ price: `BDT ${product.pricePerKg}/kg`, pay: 'Pay on delivery', call: 'Call', wa: 'Order on WhatsApp' });

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
  let html = before.replace(new RegExp(`\\s*${OPEN}[\\s\\S]*?${CLOSE}`, 'g'), '');
  if (!SKIP.has(file) && html.includes('</body>')) html = html.replace(/\s*<\/body>/, `\n  ${/<html lang="en"/.test(html) ? EN : BN}\n</body>`);
  if (html !== before) { await writeFile(join(root, file), html); changed += 1; }
}
console.log(`Order bar written into ${changed} page(s).`);
