// Writes the static, crawlable data tables into tools/ration-generator.html
// between <!-- ration-tables:start --> and <!-- ration-tables:end -->, and the
// feed-data sources into <!-- ration-sources:start/end -->.
//
// Why: the calculator itself only exists once JavaScript runs, which Google
// renders late and most AI crawlers never do. The tables below are the same
// numbers the engine uses (requirements for standard animals, the feed
// nutrient database, and example rations at default prices), so the page can
// be read, indexed and cited as a data source, and the numbers cannot drift
// from the tool because they are generated from the same modules.
// Idempotent: replaces its own previous output. Run: npm run build:ration.

import { readFile, writeFile } from 'node:fs/promises';
import { FEEDS, ADDITIVES, SOURCES, ANIMALS, requirements, formulate, defaultSelection } from '../js/ration/engine.js';
import { bn } from './product.mjs';

const product = JSON.parse(await readFile(new URL('./product.json', import.meta.url), 'utf8'));
const SILAGE = product.pricePerKg;
const file = new URL('../tools/ration-generator.html', import.meta.url);

const dec = (n, d = 1) => bn(Number(n).toFixed(d)).replace(/\.০+$/, '');
const num = (n, d = 0) => bn(Number(n).toFixed(d));
const short = (s) => s.split(' (')[0];

const th = (t, right) => `<th class="px-3 py-2 ${right ? 'text-right' : 'text-left'} text-xs font-semibold text-[#54705d]">${t}</th>`;
const td = (t, right, cls = '') => `<td class="px-3 py-2 ${right ? 'text-right whitespace-nowrap' : ''} ${cls}">${t}</td>`;
const table = (caption, head, rows) => `<div class="mt-4 overflow-x-auto rounded-xl border border-[#184d32]/10 bg-white"><table class="w-full text-sm leading-6 text-[#233126]"><caption class="sr-only">${caption}</caption><thead class="bg-[#f7f8f4]"><tr>${head}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${i ? 'border-t border-[#184d32]/10' : ''}">${r}</tr>`).join('')}</tbody></table></div>`;

// 1. Requirements for the animals farmers actually ask about.
const STANDARD = [
  { type: 'dairy', weight: 300, milk: 5 }, { type: 'dairy', weight: 350, milk: 8 }, { type: 'dairy', weight: 400, milk: 10 },
  { type: 'dairy', weight: 450, milk: 15 }, { type: 'dairy', weight: 450, milk: 20 },
  { type: 'fattening', weight: 200, adg: 0.7 }, { type: 'fattening', weight: 300, adg: 0.8 }, { type: 'fattening', weight: 350, adg: 1.0 },
  { type: 'dry', weight: 350, pregnant: true }, { type: 'heifer', weight: 150, adg: 0.5 },
  { type: 'goat', weight: 25, adg: 0.05 }, { type: 'goat', weight: 30, milk: 1 },
];
const label = (a) => {
  const s = ANIMALS[a.type];
  let t = `${bn(a.weight)} কেজির ${s.short}`;
  if (a.type === 'dairy') t += `, ${bn(a.milk)} লিটার দুধ`;
  if (a.type === 'fattening' || a.type === 'heifer') t += `, দিনে ${bn(a.adg * 1000)} গ্রাম বৃদ্ধি`;
  if (a.type === 'goat') t += a.milk ? `, ${bn(a.milk)} লিটার দুধ` : `, দিনে ${bn(a.adg * 1000)} গ্রাম বৃদ্ধি`;
  if (a.pregnant) t += ', গর্ভবতী';
  return t;
};
const reqRows = STANDARD.map((a) => {
  const r = requirements(a.type, a);
  return td(label(a)) + td(`${dec(r.dmiMin)}-${dec(r.dmi)}`, true) + td(num(r.cpG), true) + td(num(r.meMJ), true) + td(num(r.caG), true) + td(num(r.pG), true);
});
const reqTable = table('পশু অনুযায়ী দৈনিক পুষ্টি চাহিদা',
  th('পশু') + th('শুষ্ক পদার্থ (কেজি)', 1) + th('প্রোটিন (গ্রাম)', 1) + th('শক্তি ME (MJ)', 1) + th('ক্যালসিয়াম (গ্রাম)', 1) + th('ফসফরাস (গ্রাম)', 1), reqRows);

// 2. The feed database, with the two derived columns a buyer needs.
const feedRows = FEEDS.map((f) => {
  const price = f.silage ? SILAGE : f.price;
  const perDM = price / (f.dm / 100);
  return td(`<strong>${f.bn}</strong>${f.silage ? ' <span class="text-xs text-[#0b5b38]">খামারভেস্ট</span>' : ''}`) + td(f.cat === 'rough' ? 'আঁশ' : 'দানাদার') + td(num(f.dm), true) + td(dec(f.cp), true) + td(dec(f.me), true) + td(dec(f.ca, 2), true) + td(dec(f.p, 2), true) + td(num(price), true) + td(num(perDM), true) + td(dec(perDM / f.me), true) + td(num(f.max * 100) + '%', true);
});
const feedTable = table('গো-খাদ্যের পুষ্টিমান তালিকা',
  th('খাদ্য') + th('ধরন') + th('শুষ্ক %', 1) + th('প্রোটিন % (শুষ্কে)', 1) + th('ME MJ/কেজি শুষ্ক', 1) + th('Ca %', 1) + th('P %', 1) + th('দাম টাকা/কেজি', 1) + th('টাকা/কেজি শুষ্ক', 1) + th('টাকা/MJ', 1) + th('সর্বোচ্চ শুষ্কের', 1), feedRows);

// 3. Example rations at default prices, so an assistant can quote a concrete
// answer and point here for the reader's own prices.
const EXAMPLES = [
  { type: 'dairy', weight: 350, milk: 8 }, { type: 'dairy', weight: 450, milk: 15 },
  { type: 'fattening', weight: 300, adg: 0.8 }, { type: 'goat', weight: 25, adg: 0.05 },
];
const exampleCards = EXAMPLES.map((a) => {
  const r = formulate({ animal: { ...a, count: 1 }, feeds: defaultSelection(SILAGE), silagePrice: SILAGE });
  if (!r.ok) throw new Error(`example ration for ${label(a)} is not feasible at default prices: ${r.reasons}`);
  const items = r.items.map((it) => `<li class="flex justify-between gap-3"><span>${short(it.feed.bn)}</span><span class="whitespace-nowrap font-semibold">${dec(it.freshKg, it.freshKg < 1 ? 2 : 1)} কেজি</span></li>`).join('');
  const adds = [`লবণ ${bn(r.additives.saltG)} গ্রাম`, r.additives.dcpG ? `ডিসিপি ${bn(r.additives.dcpG)} গ্রাম` : '', r.additives.limeG ? `ঝিনুক গুঁড়া ${bn(r.additives.limeG)} গ্রাম` : ''].filter(Boolean).join(', ');
  const extra = r.cost.perLitre != null ? `প্রতি লিটার দুধে ${dec(r.cost.perLitre)} টাকা` : r.cost.perKgGain != null ? `প্রতি কেজি বৃদ্ধিতে ${num(r.cost.perKgGain)} টাকা` : '';
  return `<div class="rounded-xl border border-[#184d32]/10 bg-white p-4"><h4 class="font-bold text-[#0b5b38]">${label(a)}</h4><ul class="mt-2 space-y-1 text-sm text-[#33483a]">${items}</ul><p class="mt-2 text-xs text-[#54705d]">${adds}</p><p class="mt-2 text-sm"><strong>${num(r.cost.perAnimal)} টাকা/দিন</strong>${extra ? ` · ${extra}` : ''} · প্রোটিন ${num(r.adequacy.cp * 100)}%, শক্তি ${num(r.adequacy.me * 100)}%</p></div>`;
});

const generated = `
      <section id="ration-data" class="mt-10 space-y-8">
        <div>
          <h2 class="text-xl font-bold text-[#123b28]">পশু অনুযায়ী দৈনিক পুষ্টি চাহিদা</h2>
          <p class="mt-2 max-w-3xl leading-7 text-[#456451]">জেনারেটর যে সূত্রে চাহিদা বের করে, তার ফল সাধারণ কয়েকটি পশুর জন্য। শুষ্ক পদার্থের ঘরটি ন্যূনতম পেট ভরা থেকে খাওয়ার ক্ষমতা পর্যন্ত; বাকিগুলো দৈনিক চাহিদা। সূত্র NRC (২০০১, ২০১৬, ২০০৭) ও Kearl (১৯৮২)।</p>
          ${reqTable}
        </div>
        <div>
          <h2 class="text-xl font-bold text-[#123b28]">বাংলাদেশের গো-খাদ্যের পুষ্টিমান ও দাম</h2>
          <p class="mt-2 max-w-3xl leading-7 text-[#456451]">জেনারেটরের ${bn(FEEDS.length)}টি খাদ্যের বই-মান, শুষ্ক পদার্থের ভিত্তিতে। "টাকা/MJ" ঘরটিই বলে দেয় কোন খাদ্য আসলে সস্তা: কেজিতে সস্তা খড় প্রতি মেগাজুল শক্তিতে অনেক ক্ষেত্রে দানাদারের কাছাকাছি পড়ে। দাম জেলা পর্যায়ের দোকানের আনুমানিক, ২০২৬ সালের সেপ্টেম্বরের; ভুট্টা সাইলেজের দাম খামারভেস্টের বিক্রয়মূল্য। নিজের দামে হিসাব করতে উপরের টুল ব্যবহার করুন।</p>
          ${feedTable}
          <p class="mt-2 text-xs leading-5 text-[#54705d]">খনিজ: ${ADDITIVES.dcp.bn} (Ca ${bn(ADDITIVES.dcp.ca)}%, P ${bn(ADDITIVES.dcp.p)}%), ${ADDITIVES.limestone.bn} (Ca ${bn(ADDITIVES.limestone.ca)}%), ${ADDITIVES.salt.bn}। "সর্বোচ্চ" মানে রেশনের মোট শুষ্ক পদার্থের কত ভাগ পর্যন্ত এই খাদ্য নিরাপদ; দুধের গাভীতে খড় ৪০%, শুকনা গাভীতে ৭০%।</p>
        </div>
        <div>
          <h2 class="text-xl font-bold text-[#123b28]">উদাহরণ: ডিফল্ট দামে সবচেয়ে সস্তা রেশন</h2>
          <p class="mt-2 max-w-3xl leading-7 text-[#456451]">উপরের দামে, সাধারণ ${bn(FEEDS.filter((f) => f.default).length)}টি খাদ্য (${FEEDS.filter((f) => f.default).map((f) => short(f.bn)).join(', ')}) খোলা রেখে জেনারেটর যা দেয়। আপনার বাজারে দাম আলাদা হলে মিশ্রণও আলাদা হবে, তাই এগুলো শুরুর ধারণা, চূড়ান্ত তালিকা নয়।</p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">${exampleCards.join('')}</div>
        </div>
      </section>
`;

let html = await readFile(file, 'utf8');
const OPEN = '<!-- ration-tables:start -->';
const CLOSE = '<!-- ration-tables:end -->';
if (!html.includes(OPEN) || !html.includes(CLOSE)) throw new Error('ration-tables markers missing from tools/ration-generator.html');
html = html.replace(new RegExp(`${OPEN}[\\s\\S]*?${CLOSE}`), `${OPEN}${generated}      ${CLOSE}`);

// Feed-data sources listed in feeds.js, so a citation added there shows up on the page.
const SOPEN = '<!-- ration-sources:start -->';
const SCLOSE = '<!-- ration-sources:end -->';
const sources = SOURCES;
if (html.includes(SOPEN) && html.includes(SCLOSE)) {
  const lis = sources.map((s) => `<li>${s.title}: <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="font-semibold text-[#0b6a3e] underline">${new URL(s.url).hostname.replace(/^www\./, '')}</a></li>`).join('\n              ');
  html = html.replace(new RegExp(`${SOPEN}[\\s\\S]*?${SCLOSE}`), `${SOPEN}\n              ${lis}\n              ${SCLOSE}`);
}

if (/[—–]/.test(generated)) throw new Error('generated ration tables contain an em or en dash');
await writeFile(file, html);
console.log(`Ration tables written: ${STANDARD.length} requirement rows, ${FEEDS.length} feeds, ${EXAMPLES.length} example rations, ${sources.length} sources.`);
