// Builds a month of ready-to-paste Facebook posts from the guides.
// Run: npm run social            (this month)
//      npm run social -- --weeks 8
//
// Why: this market transacts on Facebook, not on websites. Rupai Silage has
// roughly 9,900 page followers and a website that is currently in maintenance
// mode; we have 33 sourced guides and a YouTube channel with one video. The
// content advantage only becomes leads if it reaches the channel farmers
// actually use, and the bottleneck is having something worth posting on any
// given week.
//
// Each post follows the rule in DISTRIBUTION.md: lead with the useful thing,
// mention the product once at the end as a fact rather than a pitch. Groups
// delete straight sales posts and farmers scroll past them.
//
// Posts are picked season-first, so the monsoon post goes out in the monsoon,
// then evergreen posts fill the rest, rotating by week of year so the same one
// does not come round twice in a season.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
// Price from the source of truth, so a set-price run updates the posts too.
import { product } from './product.mjs';

const SITE = 'https://silage.khamarvest.com';
const args = process.argv.slice(2);
const weeks = Number(args[args.indexOf('--weeks') + 1]) || 4;
// Google Business Profile posts are a different shape: ~1,500 character limit,
// no link formatting, and one call-to-action button. They also feed local
// ranking, which matters more here than Facebook reach because the profile
// currently serves "Bogra District and nearby areas" while we publish 33
// district pages.
const GBP = args.includes('--gbp');

const { posts } = JSON.parse(await readFile(join(process.cwd(), 'scripts/social-posts.json'), 'utf8'));

// Which season a given month belongs to, matching scripts/season-calendar.mjs.
function seasonOf(month) {
  if ([6, 7, 8, 9].includes(month)) return 'monsoon';
  if ([11, 12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'summer';
  return 'evergreen';
}
// Qurbani planning content runs in the months before Eid al-Adha. Kept in step
// with QURBANI in season-calendar.mjs; both need the date updating yearly.
const QURBANI = { 2027: '2027-05-16', 2028: '2028-05-05' };

const today = new Date();
const weekOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 1)) / (7 * 86400000));

function renderGbp(p, when) {
  const url = `${SITE}/${p.slug}`;
  const body = [p.hook, '', ...p.points.map((t) => `• ${t}`), '', p.close].join('\n');
  // GBP truncates hard, so warn rather than silently publishing a cut-off post.
  const over = body.length > 1400 ? `  [!] ${body.length} chars, trim before posting` : '';
  return [
    `### ${when} · Google Post · ${p.slug}${over}`,
    '',
    body,
    '',
    `বোতাম (Learn more): ${url}`,
    '',
    '---',
    '',
  ].join('\n');
}

function render(p, when) {
  const url = `${SITE}/${p.slug}`;
  return [
    `### ${when} · ${p.slug}`,
    '',
    p.hook,
    '',
    ...p.points.map((t, i) => `${'১২৩৪৫৬৭৮৯'[i] || i + 1}. ${t}`),
    '',
    p.close,
    '',
    `বিস্তারিত লিখেছি এখানে: ${url}`,
    '',
    `আমরা খামারভেস্ট সাইলেজ সরবরাহ করি, ${product.perKgBn} টাকা কেজি, ${product.bagKgBn} কেজি এয়ারটাইট বস্তা ${product.bagPriceBn} টাকা, সারাদেশে ডেলিভারি, পণ্য হাতে পেয়ে টাকা। প্রশ্ন থাকলে কমেন্টে জিজ্ঞাসা করুন। WhatsApp: +880 1303-438063`,
    '',
    '---',
    '',
  ].join('\n');
}

const plan = [];
const used = new Set();
for (let w = 0; w < weeks; w += 1) {
  const date = new Date(today.getTime() + w * 7 * 86400000);
  const month = date.getMonth() + 1;
  const season = seasonOf(month);
  const nextEid = Object.values(QURBANI).filter((d) => new Date(d) > date).sort()[0];
  const weeksToEid = nextEid ? Math.round((new Date(nextEid) - date) / (7 * 86400000)) : null;

  // Seasonal posts are used first, in order. Only once they run out do
  // evergreen posts fill in, rotated by week of year so the sequence differs
  // between years. Indexing one combined pool by modulo looked like it
  // prioritised the season but did not: November opened with an evergreen post
  // instead of the winter one, and May never surfaced Qurbani.
  const seasonal = [
    ...posts.filter((p) => p.season === season && !used.has(p.slug)),
    ...(weeksToEid !== null && weeksToEid <= 20 && weeksToEid > 0
      ? posts.filter((p) => p.season === 'qurbani' && !used.has(p.slug)) : []),
  ];
  const evergreen = posts.filter((p) => p.season === 'evergreen' && !used.has(p.slug));
  if (!seasonal.length && !evergreen.length) { used.clear(); w -= 1; continue; }
  const pick = seasonal.length ? seasonal[0] : evergreen[(weekOfYear + w) % evergreen.length];
  used.add(pick.slug);
  plan.push((GBP ? renderGbp : render)(pick, date.toISOString().slice(0, 10)));
}

const header = GBP ? [
  `# Google Business Profile পোস্ট, ${today.toISOString().slice(0, 10)} থেকে ${weeks} সপ্তাহ`,
  '',
  'Google Business Profile > Posts এ গিয়ে পেস্ট করুন। নিয়ম:',
  '',
  '- সপ্তাহে একটি যথেষ্ট। Google Post সাধারণত ৭ দিন পর গুরুত্ব হারায়, তাই নিয়মিত পোস্টই কাজে দেয়।',
  '- প্রতিটি পোস্টে একটি ছবি দিন, ছবিসহ পোস্ট বেশি দেখানো হয়।',
  '- বোতাম হিসেবে "Learn more" বেছে নিয়ে নিচের লিংকটি বসান।',
  '',
  '---',
  '',
] : [
  `# ফেসবুক পোস্ট পরিকল্পনা, ${today.toISOString().slice(0, 10)} থেকে ${weeks} সপ্তাহ`,
  '',
  'প্রতিটি পোস্ট হুবহু কপি করে পেস্ট করা যায়। নিয়ম:',
  '',
  '- সপ্তাহে একটির বেশি নয়, আর একই লেখা একাধিক গ্রুপে একই দিনে নয়, ফেসবুক এটাকে স্প্যাম ধরে।',
  '- পোস্ট করার পর কমেন্টের উত্তর দিন। অর্ডার আসলে কমেন্ট থেকেই আসে।',
  '- ছবি যোগ করলে রিচ বাড়ে। বস্তার ছবি, খেতের ছবি বা সাইলেজের ক্লোজআপ ব্যবহার করুন।',
  '',
  '---',
  '',
];
console.log([...header, ...plan].join('\n'));
