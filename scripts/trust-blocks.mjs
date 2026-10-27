// Writes three trust blocks into the pages that need them. Run: npm run build:trust
// (part of npm run build, after the generators and before build:images, which
// wraps the <img> tags written here in <picture>).
//
// 1. photo-strip: four real photos of our own work, field to bag, on the
//    homepage, /about and every district page. Before this the site showed one
//    production photo per page, and a farmer weighing an unknown online seller
//    had no way to see that the silage, the machine and the people are real.
// 2. buy-steps: "how buying works" in three steps on the homepage, right after
//    the price. The facts (message, confirmation call with the transport cost,
//    pay on delivery) were on the page but scattered across four sections.
//    District pages already carry their own district-specific steps.
// 3. mid-guide: a "how many bags?" box with the calculator and the same three
//    steps, halfway through every guide about silage itself. On a phone the
//    only order link in a guide sat after 11-13 screens of reading. Health and
//    general guides do not get it: an order box in a mastitis guide is pushy.
//
// 4. advance-booking: the "নতুন মৌসুমের সাইলেজ: আগে থেকে জানিয়ে রাখুন" form
//    (owner decision 2026-10-27, see AGENTS.md) on the homepage after the buy
//    steps, on every district page after the FAQ, and in four harvest-season
//    guides before the FAQ. It never touches the callback form: on district
//    pages the FAQ sits between them, in guides the references do.
//
// Idempotent: each block is stripped and rewritten on every run.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { product } from './product.mjs';
import { CALL_TEL, WA_NUMBER } from './contact.mjs';

const root = process.cwd();
const block = (name, body) => `<!-- ${name}:start -->\n${body}\n<!-- ${name}:end -->`;
const strip = (html, name) => html.replace(new RegExp(`[ \\t]*<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->\\n{0,2}`, 'g'), '');
const link = 'font-semibold text-[#0b6a3e] underline underline-offset-4';

const PHOTOS = [
  ['corn-harvest-1200', 900, 1200, 'দানা-ভরা ভুট্টা কাটা হচ্ছে', '১. দানা আসার পর সঠিক সময়ে ভুট্টা কাটা'],
  ['silage-production-1400', 1400, 1050, 'মাঠে মেশিনে ভুট্টা চপ করা হচ্ছে', '২. মাঠেই মেশিনে আস্ত গাছ কুচি করা'],
  ['silage-bagging-1200', 900, 1200, 'কুচি করা ভুট্টা সাথে সাথে বস্তায় ভরা হচ্ছে', '৩. সাথে সাথে এয়ারটাইট বস্তায় ভরা'],
  ['silage-closeup-1200', 1200, 900, 'কাছ থেকে তৈরি ভুট্টা সাইলেজ, দানাসহ', '৪. যা আপনার খামারে পৌঁছায়: দানাসহ কুচি করা গাছ'],
];

const photoStrip = `      <section data-cta="photo_strip" class="mx-auto mt-9 w-full max-w-5xl">
        <h2 class="text-2xl font-bold text-[#123b28]">মাঠ থেকে বস্তা পর্যন্ত, আমাদের নিজেদের কাজ</h2>
        <p class="mt-2 text-base leading-7 text-[#456451]">এগুলো আমাদের নিজেদের মাঠ আর কাজের ছবি, কোনো স্টক ছবি নয়।</p>
        <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
${PHOTOS.map(([f, w, h, alt, cap]) => `          <figure><img src="/img/${f}.jpeg" alt="${alt}, খামারভেস্ট সাইলেজ" width="${w}" height="${h}" loading="lazy" decoding="async" class="aspect-[4/3] w-full rounded-xl object-cover shadow-sm"><figcaption class="mt-2 text-sm leading-6 text-[#33483a]">${cap}</figcaption></figure>`).join('\n')}
        </div>
        <p class="mt-3 text-base text-[#456451]"><a href="https://www.youtube.com/shorts/n8sSOV0KQ64" target="_blank" rel="noopener" class="${link}">পুরো কাজ ভিডিওতে দেখুন</a> · <a href="/about" class="${link}">আমরা কারা</a></p>
      </section>`;

const steps = [
  ['১. মেসেজ বা কল', 'নাম, ঠিকানা আর কত বস্তা লাগবে জানান। কোনো ন্যূনতম অর্ডার নেই, এক বস্তাও নেওয়া যায়।'],
  ['২. কনফার্মেশন কল', 'পরিবহনসহ মোট খরচ আর ডেলিভারির তারিখ আগেই জানানো হয়। পরে বাড়তি কিছু নেই।'],
  ['৩. বস্তা হাতে পেয়ে টাকা', 'আগে কোনো টাকা নয়। নগদে, বা শুধু খামারভেস্টের নিজের নামের ব্যাংক অ্যাকাউন্টে।'],
];

const buySteps = `  <section data-cta="buy_steps" class="bg-white px-4 pb-10">
    <div class="mx-auto max-w-[1140px]">
      <h2 class="text-center text-2xl font-bold text-[rgb(14,124,75)] md:text-4xl">কীভাবে কিনবেন, ৩ ধাপে</h2>
      <ol class="mt-6 grid gap-4 md:grid-cols-3">
${steps.map(([t, d]) => `        <li class="rounded-xl border border-[#184d32]/15 bg-[#f7f8f4] p-5 text-[17px] leading-7 text-[#33483a]"><strong class="block text-lg text-[#0b6a3e]">${t}</strong>${d}</li>`).join('\n')}
      </ol>
      <div class="mt-5 flex flex-wrap justify-center gap-3">
        <a href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener" class="inline-flex min-h-11 items-center rounded-xl bg-[#0e7c4b] px-5 py-3 text-base font-bold text-white hover:bg-[#0b6a3e]">WhatsApp-এ মেসেজ পাঠান</a>
        <a href="tel:${CALL_TEL}" class="inline-flex min-h-11 items-center rounded-xl border border-[#0b5b38]/40 bg-white px-5 py-3 text-base font-bold text-[#0b5b38] hover:bg-[#e7f3e9]">কল করুন</a>
      </div>
    </div>
  </section>`;

const midGuide = `          <aside data-cta="mid_guide" class="mt-9 rounded-2xl border border-[#0b5b38]/20 bg-[#eaf5eb] p-5 sm:p-6">
            <p class="text-xl font-bold text-[#123b28]">আপনার খামারে কত বস্তা লাগবে?</p>
            <p class="mt-2 text-base leading-7 text-[#33483a]">পশুর ধরন, সংখ্যা আর কত দিন, এই তিনটা বসালেই <a href="/tools/silage-calculator" class="${link}">সাইলেজ ক্যালকুলেটর</a> দৈনিক কেজি, মোট বস্তা আর খরচ বলে দেবে। খামারভেস্ট সাইলেজ ${product.perKgBn} টাকা কেজি, ${product.bagKgBn} কেজির বস্তা ${product.bagPriceBn} টাকা।</p>
            <p class="mt-3 text-base leading-7 text-[#33483a]"><strong>কেনার নিয়ম:</strong> মেসেজ বা কল → কনফার্মেশন কলে পরিবহনসহ মোট খরচ → বস্তা হাতে পেয়ে টাকা।</p>
            <div class="mt-4 flex flex-wrap gap-3">
              <a href="/tools/silage-calculator" class="inline-flex min-h-11 items-center rounded-xl bg-[#0b5b38] px-4 text-base font-bold text-white hover:bg-[#0e7c4b]">বস্তার হিসাব করুন</a>
              <a href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener" class="inline-flex min-h-11 items-center rounded-xl border border-[#0b5b38]/40 bg-white px-4 text-base font-bold text-[#0b5b38] hover:bg-[#e7f3e9]">WhatsApp-এ জানুন</a>
            </div>
          </aside>`;

const fieldCls = 'mt-1 block min-h-11 w-full rounded-lg border border-[#6f8f7c] bg-white px-3 py-2 text-base font-normal text-black placeholder:text-[#6b7280]';
const labelCls = 'text-base font-semibold text-[#123b28]';
const optional = ' <span class="font-normal text-[#456451]">(ঐচ্ছিক)</span>';
const advanceCard = `<section id="advance-booking" data-cta="advance_booking" class="rounded-2xl border border-[#0b5b38]/25 bg-[#eaf5eb] p-5 sm:p-6">
        <h2 class="text-xl font-bold text-[#123b28] sm:text-2xl">নতুন মৌসুমের সাইলেজ: আগে থেকে জানিয়ে রাখুন</h2>
        <p class="mt-2 text-base leading-7 text-[#33483a]">ভুট্টা কাটা আর সাইলেজ তৈরি হয় ডিসেম্বর-জানুয়ারিতে, আর সেই সাইলেজ দিয়েই সারা বছরের সরবরাহ চলে। আপনার কত লাগবে আগে জানালে আমরা পরিমাণ ঠিক করে নিতে পারি। তৈরি হলে আপনাকে আগে ফোন করব। এখন কোনো টাকা দিতে হবে না, আর সারা বছরের সরবরাহের শর্ত ফোনে দুই পক্ষের সুবিধামতো ঠিক হবে।</p>
        <p class="mt-2 text-base leading-7 text-[#33483a]">দাম <!--=price-->${product.perKgBn}<!--/=--> টাকা কেজি (লোড পয়েন্টে, পরিবহন আলাদা), সারা বছর একই, ২০২৭ সাল পর্যন্ত। এটা জানিয়ে রাখার ফর্ম, বস্তা আটকে রাখার নিশ্চয়তা নয়।</p>
        <form data-booking-form onsubmit="event.preventDefault()" class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="${labelCls}">আপনার নাম${optional}<input name="name" autocomplete="name" class="${fieldCls}" placeholder="যেমন: রহিম উদ্দিন"></label>
          <label class="${labelCls}">মোবাইল নম্বর<input name="phone" required inputmode="tel" autocomplete="tel" class="${fieldCls}" placeholder="01XXXXXXXXX"></label>
          <label class="${labelCls}">জেলা ও উপজেলা${optional}<input name="location" autocomplete="address-level2" class="${fieldCls}" placeholder="যেমন: বগুড়া, শেরপুর"></label>
          <label class="${labelCls}">গরুর সংখ্যা${optional}<input name="animals" inputmode="numeric" class="${fieldCls}" placeholder="যেমন: ১৫"></label>
          <label class="${labelCls}">মাসে আনুমানিক কত বস্তা${optional}<input name="bags" inputmode="numeric" class="${fieldCls}" placeholder="যেমন: ২০"></label>
          <label class="${labelCls}">কোন মাসগুলোতে লাগবে${optional}<input name="months" class="${fieldCls}" placeholder="যেমন: সারা বছর, বা মার্চ থেকে জুন"></label>
          <label class="flex min-h-11 items-start gap-3 text-base font-semibold text-[#123b28] sm:col-span-2"><input type="checkbox" name="yearly" class="mt-1 h-6 w-6 shrink-0 accent-[#0b5b38]"><span>সারা বছরের সাইলেজ আমার জন্য পরিকল্পনায় রাখুন</span></label>
          <label class="${labelCls} sm:col-span-2">কিছু জানাতে চান?${optional}<textarea name="note" rows="2" class="${fieldCls}"></textarea></label>
          <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden">
          <button type="submit" class="min-h-11 rounded-xl bg-[#0b5b38] px-5 py-3 text-base font-bold text-white hover:bg-[#0e7c4b] disabled:opacity-60 sm:col-span-2 sm:justify-self-start">আগে থেকে জানিয়ে রাখুন</button>
          <p class="text-sm text-[#456451] sm:col-span-2">নাম আর নম্বর শুধু এই যোগাযোগের জন্য আমাদের কাছে থাকে।</p>
          <p data-lead-status hidden role="status" class="rounded-lg bg-white p-3 font-semibold text-[#0b5b38] sm:col-span-2">পেয়েছি, ধন্যবাদ। নতুন মৌসুমের সাইলেজ তৈরি হলে আমরা আপনাকে এই নম্বরে আগে ফোন করব। এখন কোনো টাকা লাগবে না।</p>
        </form>
      </section>`;
const advanceHome = `  <div class="bg-white px-4 pb-10">
    <div class="mx-auto max-w-[1140px]">
      ${advanceCard}
    </div>
  </div>`;
const advanceGuide = advanceCard.replace('<section id="advance-booking"', '<section id="advance-booking"').replace(/^/, '          ').replace('data-cta="advance_booking" class="', 'data-cta="advance_booking" class="mt-11 ');
const ADVANCE_GUIDES = ['silage-er-jonno-vutta-chash', 'silage-kinben-naki-nije-banaben', 'shiter-jonno-silage-mojud', 'silage-ki-kivabe-toiri-upokarita'].map((s) => `blog/${s}.html`);

async function update(file, fn) {
  const path = join(root, file);
  const before = await readFile(path, 'utf8');
  const after = fn(before);
  if (after !== before) await writeFile(path, after);
  return after !== before;
}

// Insert `text` immediately before the first match of `anchor`, or throw: a
// silently missing block is exactly the failure this file exists to prevent.
function before(html, anchor, text, file) {
  const m = html.match(anchor);
  if (!m) throw new Error(`${file}: anchor not found: ${anchor}`);
  return html.slice(0, m.index) + text + '\n\n' + html.slice(m.index);
}

let changed = 0;

changed += await update('index.html', (h) => {
  h = strip(strip(strip(h, 'photo-strip'), 'buy-steps'), 'advance-booking');
  h = before(h, /[ \t]*<!-- ═+ SECTION 3 · /, block('buy-steps', buySteps) + '\n\n' + block('advance-booking', advanceHome), 'index.html');
  h = before(h, /[ \t]*<!-- ═+ DELIVERY AREAS/, block('photo-strip', `  <div class="bg-white px-4 pb-10">\n${photoStrip}\n  </div>`), 'index.html');
  return h;
});

changed += await update('about.html', (h) => before(strip(h, 'photo-strip'), /[ \t]*<h2 id="how"/, block('photo-strip', photoStrip), 'about.html'));

for (const f of (await readdir(join(root, 'area'))).filter((f) => /^silage-.+\.html$/.test(f))) {
  const file = `area/${f}`;
  changed += await update(file, (h) => {
    h = before(strip(strip(h, 'photo-strip'), 'advance-booking'), /[ \t]*<h2[^>]*>[^<]*থেকে অর্ডারের নিয়ম/, block('photo-strip', photoStrip), file);
    return before(h, /[ \t]*<section class="mt-9 rounded-2xl bg-\[#0b5b38\]/, block('advance-booking', '      ' + advanceCard), file);
  });
}

// Guides about silage itself: the slug says so. Placed before the article's
// third numbered section, which on a phone is roughly a third of the way down.
const guides = [
  ...(await readdir(join(root, 'blog'))).filter((f) => f.endsWith('.html') && f.includes('silage') && f !== 'index.html').map((f) => `blog/${f}`),
  'vutta-silage-prothombar-khawano-rules.html',
];
for (const file of guides) {
  changed += await update(file, (h) => {
    h = strip(h, 'mid-guide');
    const body = h.indexOf('<article');
    if (body < 0) return h;
    const ids = [...h.slice(body).matchAll(/[ \t]*<h2 id="/g)];
    if (ids.length < 4) return h; // too short for a mid-page box
    const at = body + ids[2].index;
    return h.slice(0, at) + block('mid-guide', midGuide) + '\n\n' + h.slice(at);
  });
}

for (const file of ADVANCE_GUIDES) {
  changed += await update(file, (h) => before(strip(h, 'advance-booking'), /[ \t]*<!-- faq:start -->/, block('advance-booking', advanceGuide), file));
}

console.log(`Trust blocks written into ${changed} page(s) (${guides.length} silage guides checked).`);
