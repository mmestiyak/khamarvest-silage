// Appends a "সম্পর্কিত গাইড" block to the end of every article body.
// Run: npm run build:related (part of npm run build).
//
// Why: thirty articles each linked to three or four others by hand, chosen
// while writing, so the graph is lopsided and a reader who finishes an article
// often has nowhere obvious to go next. A consistent block at the end of every
// article gives every guide inbound links, spreads crawl depth evenly, and
// keeps a farmer reading.
//
// Related guides are picked by shared topic tags below, preferring articles the
// current one does NOT already link to, so the block adds paths instead of
// repeating the ones already in the text. Tags are explicit rather than derived
// from keywords: a wrong "related" link is worse than none, and this way the
// choices are reviewable in one place.
//
// Idempotent: it strips any block it previously wrote before adding a new one.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CALL_TEL, WA_NUMBER } from './contact.mjs';
import { product } from './product.mjs';

const BUY_ROW = [
  ['/blog/silage-kothay-pawa-jay', 'সাইলেজ কোথায় পাওয়া যায়'],
  ['/blog/vutta-silage-dam-koto-kothay-kinben', 'দাম যাচাইয়ের নিয়ম'],
  ['/blog/nirapode-silage-kenar-niyom', 'নিরাপদে কেনার নিয়ম'],
  ['/tools/silage-calculator', 'কত বস্তা লাগবে: ক্যালকুলেটর'],
];

const root = process.cwd();
const MARKER_OPEN = '<!-- related-guides:start -->';
const MARKER_CLOSE = '<!-- related-guides:end -->';

// slug -> topic tags. First tag is the primary one.
const TAGS = {
  'silage-ki-kivabe-toiri-upokarita': ['silage-basics', 'feeding'],
  'silage-pushtiman-dm-cp-tdn': ['silage-basics', 'buying'],
  'vutta-silage-prothombar-khawano-rules': ['feeding', 'silage-basics'],
  'vutta-silage-khawanor-poriman-o-hishab': ['feeding', 'cost'],
  'silage-songrokkhon-niyom': ['storage', 'silage-basics'],
  'vutta-silage-noshto-chinben': ['storage', 'buying'],
  'silage-mano-jachai': ['buying', 'storage'],
  'silage-kothay-pawa-jay': ['buying', 'cost'],
  'nirapode-silage-kenar-niyom': ['buying', 'cost'],
  'vutta-silage-dam-koto-kothay-kinben': ['cost', 'buying'],
  'silage-vs-kacha-ghas-vs-khor': ['cost', 'feeding'],
  'silage-kinben-naki-nije-banaben': ['cost', 'silage-basics'],
  'silage-er-jonno-vutta-chash': ['silage-basics', 'cost', 'seasonal'],
  'nepier-ghas-vs-vutta-silage': ['feeding', 'cost'],
  'silage-niye-vul-dharona': ['silage-basics', 'feeding'],
  'mohisher-khaddo-o-silage': ['feeding', 'dairy'],
  'chagol-vera-silage-khawano-guide': ['feeding', 'silage-basics'],
  'rumen-kivabe-kaj-kore': ['feeding', 'health'],
  'go-khaddo-shobdokosh': ['feeding', 'silage-basics'],
  'khonij-lobon-mineral-mixture': ['feeding', 'health'],
  'danadar-khaddo-goru-ration': ['feeding', 'dairy'],
  'gavir-dudh-baranor-upay': ['dairy', 'feeding'],
  'gorvoboti-gavir-khaddo-dry-period': ['dairy', 'breeding'],
  'gavir-heat-o-projonon-niyom': ['breeding', 'dairy'],
  'bachur-jotno-o-khaddo': ['breeding', 'health'],
  'kom-jaiyay-gavir-palan-labh': ['dairy', 'management'],
  'goru-motatajakoron-khaddo-talika': ['beef', 'feeding'],
  'qurbani-goru-motatajakoron-porikolpona': ['beef', 'management'],
  'goru-motatajakoron-dainik-ojon-briddhi': ['beef', 'feeding'],
  'gorur-ojon-mapar-niyom': ['management', 'feeding'],
  'gorur-khamar-shuru-korar-upay': ['management', 'cost'],
  'goru-tika-o-krimi-tarik-talika': ['health', 'management'],
  'gorur-khura-rog-fmd-lokkhon-o-koronio': ['health'],
  'gorur-pet-fapa-hole-koronio': ['health', 'feeding'],
  'gorome-gorur-jotno-heat-stress': ['seasonal', 'health'],
  'shite-gorur-thanda-jhuki-o-khaddo': ['seasonal', 'health'],
  'goru-shitokale-khaddo-vyobosthapna': ['seasonal', 'feeding'],
  'shiter-jonno-silage-mojud': ['seasonal', 'storage', 'cost'],
  'silage-poribohon-khoroch': ['cost', 'buying'],
  'go-khaddo-mousumi-calendar': ['seasonal', 'feeding'],
  'borshakale-gorur-khaddo-babosthapona': ['seasonal', 'feeding'],
  'gorur-khaddo-khoroch-komanor-upay': ['cost', 'feeding', 'buying'],
  'silage-diye-tmr-mishro-khaddo': ['feeding', 'dairy'],
  'gorur-khoil-sorisha-til-soybean': ['feeding', 'cost', 'dairy'],
  'gavir-olan-fola-mastitis': ['health', 'dairy'],
  'gorur-panir-chahida': ['feeding', 'dairy', 'health'],
  'khor-urea-prokriyajat-korar-niyom': ['feeding', 'seasonal', 'cost'],
};

function slugOf(file) {
  return file.replace(/^blog\//, '').replace(/\.html$/, '');
}
function urlOf(file) {
  return `/${file.replace(/\.html$/, '')}`;
}

const files = [
  'vutta-silage-prothombar-khawano-rules.html',
  ...(await readdir(join(root, 'blog')))
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && f !== 'article-template.html')
    .map((f) => `blog/${f}`),
];

const articles = [];
for (const file of files) {
  const html = await readFile(join(root, file), 'utf8');
  const slug = slugOf(file);
  const tags = TAGS[slug];
  if (!tags) throw new Error(`scripts/related-guides.mjs: no tags for ${slug}. Add it to TAGS.`);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s*\|[^|]*$/u, '').trim();
  articles.push({ file, slug, tags, title, url: urlOf(file), html });
}

// Every district page, for the "আপনার জেলায়" strip. District pages convert
// best on the site (11.2% CTR vs 2.4% for the homepage), yet 34 of 38 articles
// linked none of them, so a reader who had just decided to try silage had no
// path to the page that answers "does it reach my district, and for how much".
// Read from the generated pages so a new district appears here automatically.
const districts = [];
for (const f of (await readdir(join(root, 'area'))).filter((f) => /^silage-.+\.html$/.test(f)).sort()) {
  const html = await readFile(join(root, 'area', f), 'utf8');
  const name = html.match(/"position":3,"name":"([^"]+)"/)?.[1];
  if (!name) throw new Error(`area/${f}: no district name in its BreadcrumbList`);
  districts.push({ name, url: `/area/${f.replace(/\.html$/, '')}` });
}
districts.sort((x, y) => x.name.localeCompare(y.name, 'bn'));
const districtLinks = districts.map((d) => `<a href="${d.url}" class="inline-flex min-h-11 items-center rounded-full border border-[#184d32]/25 bg-white px-3.5 text-sm font-medium text-[#0b6a3e] hover:border-[#0e7c4b]">${d.name}</a>`).join('\n              ');

function score(a, b) {
  let s = 0;
  b.tags.forEach((t, i) => {
    const j = a.tags.indexOf(t);
    if (j === -1) return;
    s += (a.tags.length - j) + (b.tags.length - i); // primary-to-primary scores highest
  });
  return s;
}

let updated = 0;
for (const a of articles) {
  // Strip a previously written block so re-running never stacks them.
  const base = a.html.replace(new RegExp(`\\s*${MARKER_OPEN}[\\s\\S]*?${MARKER_CLOSE}`, 'g'), '');
  const alreadyLinked = new Set([...base.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]));

  const ranked = articles
    .filter((b) => b.slug !== a.slug && score(a, b) > 0)
    .map((b) => ({ b, s: score(a, b), fresh: alreadyLinked.has(b.url) ? 0 : 1 }))
    // A guide this article does not already link to is worth more: the block
    // should open new paths, not restate links already in the prose.
    .sort((x, y) => y.fresh - x.fresh || y.s - x.s || x.b.slug.localeCompare(y.b.slug))
    .slice(0, 4)
    .map((x) => x.b);
  if (ranked.length < 3) throw new Error(`${a.slug}: only ${ranked.length} related guides found, check TAGS`);

  const cards = ranked.map((b) => `
          <a href="${b.url}" class="block rounded-xl border border-[#184d32]/10 bg-white p-4 transition hover:border-[#0e7c4b] hover:shadow-sm">
            <span class="block font-semibold leading-7 text-[#0b6a3e]">${b.title}</span>
          </a>`).join('');

  // A fixed "before you buy" row on every article. Tag matching rarely picked
  // the sourcing and price-check guides, which are the ones that turn a reader
  // into a buyer; /blog/silage-kothay-pawa-jay had 2 in-text links site-wide.
  const buyLinks = BUY_ROW
    .filter(([url]) => url !== a.url && !url.endsWith(`/${a.slug}`))
    .map(([url, label]) => `<a href="${url}" class="inline-flex min-h-11 items-center rounded-full border border-[#0b5b38]/25 bg-white px-4 py-2 text-[15px] font-semibold text-[#0b5b38] hover:border-[#0b5b38]">${label}</a>`)
    .join('\n              ');

  const block = `
          ${MARKER_OPEN}
          <section data-cta="next_step" class="mt-10 rounded-2xl border border-[#0b5b38]/20 bg-white p-5 sm:p-6">
            <h2 class="text-lg font-bold text-[#123b28]">পরের ধাপ: সাইলেজ নিতে চাইলে</h2>
            <p class="mt-1 text-[#456451]">খামারভেস্ট সাইলেজ ${product.perKgBn} টাকা কেজি, ৫০ কেজি বস্তা ${product.bagPriceBn} টাকা। আগে টাকা নয়, বস্তা হাতে পেয়ে টাকা; পরিবহন খরচ কনফার্মেশন কলে জানানো হয়।</p>
            <div class="mt-4 flex flex-wrap gap-3">
              <a href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener" class="inline-flex min-h-11 items-center rounded-xl bg-[#0b5b38] px-5 py-2.5 text-base font-bold text-white hover:bg-[#0e7c4b]">WhatsApp-এ অর্ডার</a>
              <a href="tel:${CALL_TEL}" class="inline-flex min-h-11 items-center rounded-xl border border-[#0b5b38]/40 bg-white px-5 py-2.5 text-base font-bold text-[#0b5b38] hover:bg-[#e7f3e9]">কল করুন</a>
              <a href="/area/" class="inline-flex min-h-11 items-center rounded-xl px-3 py-2.5 text-base font-semibold text-[#0b6a3e] underline underline-offset-4">আপনার জেলায় দাম ও ডেলিভারি</a>
            </div>
            <!-- Callback request, same handler as the district pages (/js/leads.js):
                 saved to the owner's lead sheet, confirmation shown in place. A
                 reader with no WhatsApp, or one who would rather be called, had
                 no path to a lead from a guide before this. -->
            <form data-lead-form onsubmit="event.preventDefault()" class="mt-5 grid gap-3 border-t border-[#184d32]/10 pt-5 sm:grid-cols-[1fr_1fr_auto]">
              <p class="text-base font-bold text-[#123b28] sm:col-span-3">WhatsApp নেই? নম্বর দিন, আমরা ফোন করে দাম ও পরিবহন খরচ জানাব</p>
              <label class="text-sm font-semibold text-[#123b28]">মোবাইল নম্বর<input name="phone" required inputmode="tel" autocomplete="tel" class="mt-1 block min-h-11 w-full rounded-lg border border-[#6f8f7c] bg-white px-3 py-2 text-base font-normal text-black placeholder:text-[#6b7280]" placeholder="01XXXXXXXXX"></label>
              <label class="text-sm font-semibold text-[#123b28]">জেলা ও উপজেলা <span class="font-normal text-[#456451]">(ঐচ্ছিক)</span><input name="upazila" autocomplete="address-level2" class="mt-1 block min-h-11 w-full rounded-lg border border-[#6f8f7c] bg-white px-3 py-2 text-base font-normal text-black placeholder:text-[#6b7280]" placeholder="যেমন: বগুড়া, শেরপুর"></label>
              <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden">
              <button type="submit" class="min-h-11 self-end rounded-xl border border-[#0b5b38]/40 bg-white px-5 py-2.5 text-base font-bold text-[#0b5b38] hover:bg-[#e7f3e9] disabled:opacity-60">ফোন করে জানান</button>
              <p class="text-sm text-[#456451] sm:col-span-3">আগে কোনো টাকা দিতে হয় না। নম্বর শুধু এই যোগাযোগের জন্য আমাদের কাছে থাকে।</p>
              <p data-lead-status hidden role="status" class="rounded-lg bg-[#eaf5eb] p-3 font-semibold text-[#0b5b38] sm:col-span-3">পেয়েছি, ধন্যবাদ। আমরা এই নম্বরে ফোন করে দাম আর ডেলিভারির খরচ জানাব।</p>
            </form>
          </section>
          <section class="mt-10 border-t border-[#184d32]/10 pt-7">
            <h2 class="text-lg font-bold text-[#123b28]">সম্পর্কিত গাইড</h2>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">${cards}
            </div>
          </section>
          <section class="mt-8">
            <h2 class="text-lg font-bold text-[#123b28]">সাইলেজ কেনার আগে</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              ${buyLinks}
            </div>
          </section>
          <section class="mt-8 rounded-2xl bg-[#eaf5eb] p-5">
            <h2 class="text-lg font-bold text-[#123b28]">আপনার জেলায় সাইলেজ: দাম ও ডেলিভারি</h2>
            <p class="mt-1 text-sm text-[#456451]">জেলা বেছে নিন, সেখানে কীভাবে অর্ডার ও ডেলিভারি হয় দেখে নিন।</p>
            <div class="mt-3 flex flex-wrap gap-2">
              ${districtLinks}
            </div>
          </section>
          ${MARKER_CLOSE}`;

  // Insert just before the article body's closing wrapper.
  const close = '\n        </div>\n      </article>';
  if (!base.includes(close)) throw new Error(`${a.slug}: could not find the article body close to insert before`);
  const out = base.replace(close, `${block}${close}`);
  if (out !== a.html) {
    await writeFile(join(root, a.file), out);
    updated += 1;
  }
}
console.log(`Related-guides block written into ${updated} of ${articles.length} article(s).`);
