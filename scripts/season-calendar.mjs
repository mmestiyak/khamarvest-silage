// Tells us what to publish or refresh THIS month, based on the Bangladeshi
// farming year. Run: npm run season
//
// This is the honest version of "scheduled posting". Search demand for cattle
// feed is strongly seasonal, and content has to be live and re-crawled BEFORE
// the season, not during it. A winter feeding guide published in January has
// already missed most of its traffic. So this works backwards from each season
// and says what needs attention now, rather than generating articles on a timer.
//
// Publishing stays a human decision. Google's scaled-content-abuse policy is
// aimed squarely at sites that automate that step, and this site's whole
// advantage is that every claim is sourced and checkable.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Eid al-Adha moves about 11 days earlier each year, so it cannot be computed
// from the Gregorian calendar. Update this yearly; the script warns when it is
// stale rather than silently planning against a date that has passed.
const QURBANI = { 2027: '2027-05-16', 2028: '2028-05-05' };

// Each entry: the months when demand peaks, and two different lead times.
//
// `lead` is when EXISTING guides should be refreshed and re-crawled: Google
// picks up an update to a known page within days.
//
// `leadNew` is when writing NEW content has to START. A new page typically
// needs two to three months to settle into rankings, so a six-week warning is
// useless for anything that does not exist yet. This distinction was missing,
// which is how winter arrived with one 681-word guide behind it.
const SEASONS = [
  { name: 'গরম ও হিট স্ট্রেস', peak: [3, 4, 5], lead: 6, leadNew: 18,
    guides: ['blog/gorome-gorur-jotno-heat-stress', 'blog/silage-songrokkhon-niyom'],
    why: 'গরমে খোলা বস্তা দ্রুত নষ্ট হয়, আর হিট স্ট্রেসে দুধ পড়ে যায়। সংরক্ষণ গাইডের মৌসুম অংশটি গরম শুরুর আগেই ক্রল হওয়া দরকার।' },
  { name: 'বর্ষা', peak: [6, 7, 8, 9], lead: 6, leadNew: 18,
    guides: ['blog/borshakale-gorur-khaddo-babosthapona', 'blog/gorur-pet-fapa-hole-koronio'],
    why: 'ভেজা ঘাসে পেট ফাঁপার ঝুঁকি বাড়ে আর মাঠ ডুবলে সবুজ খাদ্যের সংকট হয়, তখনই সাইলেজের চাহিদা ওঠে।' },
  { name: 'শীত', peak: [11, 12, 1, 2], lead: 6, leadNew: 18,
    guides: ['blog/goru-shitokale-khaddo-vyobosthapna', 'blog/shite-gorur-thanda-jhuki-o-khaddo', 'blog/bachur-jotno-o-khaddo'],
    why: 'শীতে ঘাসের বাড়ন কমে, খড়ের দাম চড়ে, আর খামারি বিকল্প খোঁজেন।' },
  { name: 'ভুট্টা কাটা ও সাইলেজ তৈরির মৌসুম', peak: [3, 4, 5], lead: 8, leadNew: 20,
    guides: ['blog/silage-ki-kivabe-toiri-upokarita', 'blog/silage-kinben-naki-nije-banaben'],
    why: 'ভুট্টা কাটার সময়েই খামারি ঠিক করেন নিজে বানাবেন না কিনবেন, তাই তৈরির পদ্ধতি ও কেনা-বানানোর হিসাব তখন সবচেয়ে বেশি খোঁজা হয়।' },
  { name: 'কোরবানি (মোটাতাজাকরণ)', peak: 'qurbani', lead: 20, leadNew: 32,
    guides: ['blog/qurbani-goru-motatajakoron-porikolpona', 'blog/goru-motatajakoron-khaddo-talika', 'blog/gorur-ojon-mapar-niyom'],
    why: 'ঈদের ৪-৫ মাস আগে গরু কেনা ও মোটাতাজাকরণের পরিকল্পনা শুরু হয়, তখনই খোঁজ সবচেয়ে বেশি।' },
];

const today = new Date();
const month = today.getMonth() + 1;
const weeksUntil = (date) => Math.round((new Date(date) - today) / (7 * 86400000));

const root = process.cwd();
async function modifiedOf(slug) {
  try {
    const html = await readFile(join(root, `${slug}.html`), 'utf8');
    return html.match(/"dateModified":\s*"(\d{4}-\d{2}-\d{2})"/)?.[1]
      || html.match(/"datePublished":\s*"(\d{4}-\d{2}-\d{2})"/)?.[1] || 'unknown';
  } catch { return 'MISSING'; }
}

const due = [];
for (const s of SEASONS) {
  let weeks;
  if (s.peak === 'qurbani') {
    const next = Object.entries(QURBANI).map(([, d]) => d).filter((d) => new Date(d) > today).sort()[0];
    if (!next) { due.push({ season: s, weeks: null, stale: true }); continue; }
    weeks = weeksUntil(next);
  } else {
    // Weeks until the first peak month begins.
    const starts = s.peak.map((m) => {
      const d = new Date(today.getFullYear(), m - 1, 1);
      if (d < today) d.setFullYear(d.getFullYear() + 1);
      return d;
    }).sort((a, b) => a - b)[0];
    weeks = weeksUntil(starts);
    if (s.peak.includes(month)) weeks = 0; // already in season
  }
  const maxLead = Math.max(s.lead, s.leadNew ?? s.lead);
  if (weeks !== null && weeks <= maxLead) due.push({ season: s, weeks });
}

const lines = [`# মৌসুমি কনটেন্ট পরিকল্পনা, ${today.toISOString().slice(0, 10)}`, ''];
if (!due.length) {
  lines.push('এই মাসে কোনো মৌসুম সামনে নেই। পরের মৌসুমের জন্য অপেক্ষা করুন।');
} else {
  for (const { season, weeks, stale } of due) {
    if (stale) {
      lines.push(`## ${season.name}`, '', `- **QURBANI তারিখ পুরোনো হয়ে গেছে।** \`scripts/season-calendar.mjs\` এর \`QURBANI\` ম্যাপে পরের বছরের তারিখ যোগ করুন।`, '');
      continue;
    }
    const stage = weeks === 0 ? 'চলছে'
      : weeks <= season.lead ? `আর ${weeks} সপ্তাহ, এখনই হালনাগাদ করার সময়`
      : `আর ${weeks} সপ্তাহ, নতুন লেখা শুরু করার সময় (নতুন পাতা র‍্যাঙ্ক করতে ২-৩ মাস লাগে)`;
    lines.push(`## ${season.name} (${stage})`, '', `${season.why}`, '');
    for (const g of season.guides) {
      const mod = await modifiedOf(g);
      const months = mod === 'MISSING' || mod === 'unknown' ? null
        : (today.getFullYear() - new Date(mod).getFullYear()) * 12 + (today.getMonth() - new Date(mod).getMonth());
      const flag = mod === 'MISSING' ? ' **(পাতাটি নেই)**' : months >= 6 ? ` **(${months} মাস ধরে অপরিবর্তিত, রিফ্রেশ করুন)**` : '';
      lines.push(`- /${g} — সর্বশেষ হালনাগাদ ${mod}${flag}`);
    }
    lines.push('');
  }
  lines.push('## করণীয়', '',
    '1. উপরের গাইডগুলো পড়ে দেখুন তথ্য এখনো ঠিক আছে কি না, দরকার হলে হালনাগাদ করুন এবং `dateModified` বাড়ান।',
    '2. `npm run verify` চালান, তারপর push করুন। IndexNow নিজে থেকেই Bing-কে জানিয়ে দেবে।',
    '3. মৌসুম শুরুর আগেই কাজটা শেষ করুন, মৌসুম চলাকালে করলে বেশিরভাগ ট্রাফিক ইতিমধ্যেই চলে গেছে।');
}
console.log(lines.join('\n'));
