// Feed database for Bangladeshi cattle and goat rations.
//
// All nutrient figures are on a DRY MATTER basis:
//   dm    dry matter, % of fresh weight
//   cp    crude protein, % of DM
//   me    metabolisable energy, MJ per kg DM
//   ca/p  calcium / phosphorus, % of DM
//   price default market price, taka per kg FRESH (editable in the UI)
//   max   safe ceiling as a fraction of total ration DM; `maxBy` overrides it
//         per animal class (rice straw can be most of a dry cow's diet but
//         must not be most of a milking cow's)
//   maxKgPerBW  a fresh-weight cap per kg of body weight (UMS: 2 kg per 100 kg)
//   maxKgDefault  what the UI pre-fills in "সর্বোচ্চ কেজি/দিন" for feeds a farm
//         collects rather than buys (roadside grass is ~2.5 kg/head/day)
//   avoidWhen  animal states the feed is unsafe for; the engine drops it and says so
//
// Which feeds are here, and their values, follow what Bangladeshi farm surveys
// show farms actually use (SAU 2020 survey of 180 farms in four SW districts;
// BLRI Pabna; Huque & Sarker 2014) rather than a textbook list. Nutrients are
// Bangladeshi analyses where they exist (BAU, BLRI, SAU) and Feedipedia
// medians otherwise, rounded to what a farm can act on. Where market samples
// in Bangladesh test far below the book value (rice bran, oil cakes, ready
// feed) the default leans towards the market sample, and the note says so.
// Prices: district feed shops and DAM/USDA retail series, 2024-2026; they move
// with the season, which is why every price is editable. See SOURCES below.

export const CATEGORY = {
  rough: { id: 'rough', label: 'আঁশ জাতীয় (ঘাস, খড়, সাইলেজ)' },
  conc: { id: 'conc', label: 'দানাদার ও উপজাত' },
};

export const FEEDS = [
  // ---------------------------------------------------------------- roughages
  {
    id: 'silage', cat: 'rough', bn: 'ভুট্টা সাইলেজ', en: 'Maize silage',
    dm: 32, cp: 7.5, me: 10.8, ca: 0.19, p: 0.17, price: 10, max: 0.7,
    default: true, silage: true,
    note: 'বই-মান (Feedipedia, দানা-ভরা অবস্থায় কাটা ভুট্টা)। কোনো নির্দিষ্ট লটের ল্যাব রিপোর্ট নয়।',
  },
  {
    id: 'straw', cat: 'rough', bn: 'ধানের খড়', en: 'Rice straw',
    dm: 92, cp: 4.0, me: 5.8, ca: 0.25, p: 0.09, price: 20, max: 0.45,
    maxBy: { dairy: 0.4, fattening: 0.45, dry: 0.7, heifer: 0.5, goat: 0.4 },
    default: true,
    note: 'পেট ভরায়, কিন্তু প্রোটিন ৪% ও শক্তি খুব কম। দাম এলাকা ও মৌসুমভেদে মণে ৩০০ থেকে ১২০০ টাকা (কেজি প্রায় ৮-৩২), ঘাটতির সময় আর "সস্তা" নয়; নিজের এলাকার দর বসান। দুধের গাভীর রেশনে ৪০% এর বেশি নয়।',
  },
  {
    id: 'ums', cat: 'rough', bn: 'ইউএমএস (ইউরিয়া-চিটাগুড় মাখানো খড়)', en: 'Urea-molasses straw',
    dm: 73, cp: 10, me: 7.0, ca: 0.25, p: 0.09, price: 16, max: 0.5,
    maxBy: { dairy: 0.45, fattening: 0.5, dry: 0.6, heifer: 0.4, goat: 0.3 },
    maxKgPerBW: 0.02, avoidWhen: { pregnant: true },
    note: 'BLRI পদ্ধতি: ১০ কেজি খড়ে ৫ লিটার পানি, ২.৫ কেজি চিটাগুড়, ৩০০ গ্রাম ইউরিয়া (৩% এর বেশি কখনো নয়)। প্রোটিন ৪% থেকে ১০%। দিনে শরীরের ওজনের ২% এর বেশি নয়, ৬ মাসের কম বয়সে ও গর্ভাবস্থার শেষ দিকে নয়। দামটি খড় + উপকরণ ধরে।',
  },
  {
    id: 'napier', cat: 'rough', bn: 'নেপিয়ার ঘাস (কাঁচা)', en: 'Napier grass',
    dm: 18, cp: 12, me: 8.2, ca: 0.36, p: 0.29, price: 6, max: 0.6,
    note: '৬-৮ সপ্তাহে কাটা কচি ঘাসের বাংলাদেশি মান (BLRI পাবনা: প্রোটিন ১৩.৮%)। নিজের জমির হলে দাম ০ দিন, শুধু কাটার খরচ ধরুন।',
  },
  {
    id: 'green_grass', cat: 'rough', bn: 'অন্য চাষের ঘাস (জার্মান, পারা, জাম্বো)', en: 'Other cultivated grass',
    dm: 22, cp: 11, me: 8.5, ca: 0.35, p: 0.22, price: 6, max: 0.6,
    note: 'জাম্বো (সরগম) ৪৫ দিনের কম বয়সে কাটলে বিষক্রিয়ার ঝুঁকি, পুরো বাড়ার পর কাটুন।',
  },
  {
    id: 'natural_grass', cat: 'rough', bn: 'প্রাকৃতিক ঘাস (দূর্বা, মাঠের ঘাস)', en: 'Natural / roadside grass',
    dm: 30, cp: 8.5, me: 7.1, ca: 0.3, p: 0.2, price: 0, max: 0.5, maxKgDefault: 3,
    note: 'সবচেয়ে বেশি খামার এটি খাওয়ায়, কিন্তু দিনে মাথাপিছু গড়ে ২-৩ কেজির বেশি জোটে না; কত পান তা "সর্বোচ্চ" ঘরে লিখুন।',
  },
  {
    id: 'maize_fodder', cat: 'rough', bn: 'ভুট্টার কাঁচা গাছ', en: 'Green maize fodder',
    dm: 21, cp: 8.5, me: 10.0, ca: 0.21, p: 0.19, price: 6, max: 0.6,
  },
  {
    id: 'legume_fodder', cat: 'rough', bn: 'ডাল জাতীয় ঘাস (খেসারি, মাষকলাই, কাউপি, ধইঞ্চা)', en: 'Legume fodder',
    dm: 22, cp: 20, me: 9.5, ca: 1.2, p: 0.3, price: 6, max: 0.4,
    note: 'প্রোটিন ২০%, তাই খৈলের খরচ কমায়। শীতে দুধ-অঞ্চলে সহজলভ্য। হঠাৎ বেশি দিলে পেট ফাঁপে।',
  },
  {
    id: 'water_hyacinth', cat: 'rough', bn: 'কচুরিপানা', en: 'Water hyacinth',
    dm: 12, cp: 10, me: 7.3, ca: 1.29, p: 0.6, price: 0, max: 0.25, maxKgDefault: 8,
    note: 'শুকনো মৌসুমের বিনামূল্যের আঁশ। ধুয়ে, কুচি করে, আধা শুকিয়ে দিন; রেশনের ২৫% এর বেশি দিলে খাওয়া কমে যায়। পানি ৮৮%, তাই কেজিতে পুষ্টি খুব কম।',
  },
  {
    id: 'tree_leaves', cat: 'rough', bn: 'গাছের পাতা (কাঁঠাল, ইপিল-ইপিল, বাবলা)', en: 'Tree leaves',
    dm: 28, cp: 14, me: 7.5, ca: 1.5, p: 0.2, price: 0, max: 0.2, maxKgDefault: 2,
    maxBy: { goat: 0.4 },
    note: 'ছাগলের প্রধান আঁশ (৯২% খামারি খাওয়ান)। কাঁঠাল পাতা প্রোটিন ১২%, ইপিল-ইপিল ২৪%। গরুতে অল্প।',
  },
  {
    id: 'maize_stover', cat: 'rough', bn: 'ভুট্টার শুকনো গাছ / গমের খড় / আখের আগা', en: 'Maize stover, wheat straw, cane tops',
    dm: 85, cp: 5.0, me: 7.0, ca: 0.3, p: 0.1, price: 8, max: 0.4,
  },

  // ------------------------------------------------------------- concentrates
  {
    id: 'rice_bran', cat: 'conc', bn: 'চালের কুঁড়া (বাজারের সাধারণ)', en: 'Rice bran, husk-mixed',
    dm: 90, cp: 8.5, me: 9.0, ca: 0.1, p: 1.2, price: 20, max: 0.25,
    default: true,
    note: 'বাংলাদেশের সবচেয়ে বেশি ব্যবহৃত দানাদার (৯১% খামার), আর সবচেয়ে বেশি ভেজালও: চট্টগ্রামের ২০ দোকানের নমুনায় প্রোটিন ৪.৭-১৪.৯%, গড় ৮.৮%, তুষ মেশানো। সেই গড়টিই ধরা হয়েছে।',
  },
  {
    id: 'rice_polish', cat: 'conc', bn: 'অটো রাইস পলিশ (ভালো মানের)', en: 'Rice polish, auto mill',
    dm: 90, cp: 13, me: 12.0, ca: 0.07, p: 1.7, price: 38, max: 0.25,
    note: 'তুষমুক্ত, তেলযুক্ত পলিশ: প্রোটিন ১৩%, শক্তি ভুট্টার কাছাকাছি। গরমে দ্রুত বাসি হয়, ২-৩ সপ্তাহের বেশি রাখবেন না।',
  },
  {
    id: 'wheat_bran', cat: 'conc', bn: 'গমের ভুসি', en: 'Wheat bran',
    dm: 88, cp: 14.5, me: 11.0, ca: 0.14, p: 1.1, price: 42, max: 0.3,
    default: true,
    note: 'বাংলাদেশি নমুনায় প্রোটিন ১২.৬-১৫.৮% (বইয়ে ১৭%)। মোটা ও চিকন ভুসির দামে ফারাক আছে, যেটা কেনেন সেটার দাম দিন।',
  },
  {
    id: 'maize_grain', cat: 'conc', bn: 'ভুট্টা ভাঙা', en: 'Cracked maize',
    dm: 88, cp: 9.0, me: 13.6, ca: 0.05, p: 0.3, price: 37, max: 0.35,
    default: true,
    note: 'সবচেয়ে ঘন শক্তি (খুচরা ৩৭-৩৮ টাকা, ফেব্রুয়ারি ২০২৬)। হঠাৎ বেশি দিলে অ্যাসিডোসিস, তাই ৩৫% সীমা।',
  },
  {
    id: 'broken_rice', cat: 'conc', bn: 'খুদ (ভাঙা চাল)', en: 'Broken rice',
    dm: 87.5, cp: 9.0, me: 13.4, ca: 0.05, p: 0.28, price: 36, max: 0.3,
    note: 'প্রায় অর্ধেক খামার খাওয়ায়। শক্তিতে ভুট্টার সমান; ভুট্টার চেয়ে সস্তা পেলে টুল এটিই নেবে।',
  },
  {
    id: 'maize_bran', cat: 'conc', bn: 'ভুট্টার ভুসি', en: 'Maize bran',
    dm: 88.7, cp: 11.9, me: 11.0, ca: 0.47, p: 0.34, price: 32, max: 0.3,
  },
  {
    id: 'pulse_bran', cat: 'conc', bn: 'ডালের ভুসি (খেসারি, মসুর)', en: 'Pulse bran (khesari, lentil)',
    dm: 90, cp: 17, me: 10.0, ca: 0.3, p: 0.4, price: 45, max: 0.25,
    note: 'খেসারি ভুসি প্রোটিন ~২০%, মসুর কম। বুটের/অ্যাংকর ভুসি আলাদা: প্রোটিন মাত্র ৫-৮%, নিচে দেখুন।',
  },
  {
    id: 'gram_bran', cat: 'conc', bn: 'বুটের / অ্যাংকর ভুসি', en: 'Gram / anchor bran',
    dm: 90, cp: 7, me: 8.0, ca: 0.3, p: 0.3, price: 58, max: 0.2,
    note: 'দামি অথচ প্রোটিন ৫-৮% ও হজম কম। টুল সাধারণত এটি নেবে না; কেনার আগে হিসাব দেখুন।',
  },
  {
    id: 'mustard_cake', cat: 'conc', bn: 'সরিষার খৈল', en: 'Mustard oil cake',
    dm: 89, cp: 30, me: 12.0, ca: 0.6, p: 1.1, price: 50, max: 0.15,
    default: true,
    note: 'ভালো খৈলে প্রোটিন ৩০-৩৩%, কিন্তু বাজারের ভেজাল নমুনায় ১৬% পর্যন্ত নেমেছে; গন্ধ ও তেলতেলে ভাব দেখে কিনুন। ঝাঁঝের কারণে রেশনের ১৫% এর বেশি নয়।',
  },
  {
    id: 'sesame_cake', cat: 'conc', bn: 'তিলের খৈল', en: 'Sesame oil cake',
    dm: 92, cp: 38, me: 12.0, ca: 2.0, p: 1.26, price: 45, max: 0.15,
    note: 'পাবনা অঞ্চলে সাধারণ। ক্যালসিয়াম বেশি বলে ঝিনুক গুঁড়ার দরকার কমায়। বাজারের নমুনায় প্রোটিন অনেক কম পাওয়া গেছে, বিশ্বস্ত দোকান থেকে কিনুন।',
  },
  {
    id: 'soybean_meal', cat: 'conc', bn: 'সয়াবিন মিল', en: 'Soybean meal',
    dm: 89, cp: 44, me: 13.0, ca: 0.38, p: 0.71, price: 65, max: 0.2,
    note: 'সবচেয়ে ঘন প্রোটিন (বাংলাদেশি নমুনায় ৪০-৫১%)। বেশি দুধের গাভীতে দরকার হয়।',
  },
  {
    id: 'molasses', cat: 'conc', bn: 'চিটাগুড়', en: 'Molasses',
    dm: 73, cp: 5.5, me: 10.5, ca: 0.92, p: 0.07, price: 32, max: 0.1,
    default: true,
    note: 'স্বাদ বাড়ায়, খড়ের সাথে মিশিয়ে দিলে গরু বেশি খায়। ১০% এর বেশি দিলে আঁশের হজম কমে ও পাতলা পায়খানা।',
  },
  {
    id: 'ready_feed', cat: 'conc', bn: 'বাজারের রেডি ফিড (দানাদার)', en: 'Commercial ready feed',
    dm: 90, cp: 15.5, me: 11.5, ca: 1.0, p: 0.5, price: 48, max: 0.6,
    note: 'প্যাকেটে ১০-১৮% প্রোটিন লেখা থাকে, ৯ ব্র্যান্ডের ল্যাব পরীক্ষায় ৭.৫-২০.৭% পাওয়া গেছে। ১৫.৫% ধরা হয়েছে; প্যাকেটের সংখ্যা জানলে "নিজের খাদ্য" দিয়ে বসান।',
  },
];

// Fixed daily additives, priced outside the optimiser: every ration needs
// salt; DCP fills a phosphorus gap (and brings calcium with it); limestone or
// oyster-shell grit fills a calcium-only gap, which is the usual case because
// bran and oil cakes are already rich in phosphorus.
export const ADDITIVES = {
  salt: { bn: 'লবণ', price: 40 },
  dcp: { bn: 'ডিসিপি (ক্যালসিয়াম-ফসফরাস)', price: 130, ca: 23, p: 18 },
  limestone: { bn: 'ঝিনুক / চুনাপাথরের গুঁড়া', price: 15, ca: 38 },
};

// Bangladeshi evidence behind the feed list, the nutrient values and the
// prices. Rendered on the page by scripts/build-ration-tables.mjs.
export const SOURCES = [
  { title: 'Huque & Sarker (2014), Feeds and feeding of livestock in Bangladesh, Bangladesh J. Anim. Sci. 43(1): জাতীয় খাদ্য ভারসাম্য ও উপজাতের জোগান', url: 'https://www.banglajol.info/index.php/BJAS/article/view/19378' },
  { title: 'শেরেবাংলা কৃষি বিশ্ববিদ্যালয় (২০২০), চার জেলার ১৮০ খামারের খাদ্য ব্যবহার ও দামের জরিপ: কোন খাদ্য কত শতাংশ খামার খাওয়ায়', url: 'https://saulibrary.edu.bd/daatj/public/uploads/12-04795.pdf' },
  { title: 'বাজারের রাইস পলিশে ভেজাল, চট্টগ্রামের ২০ দোকানের নমুনা বিশ্লেষণ (OJAFR 2012)', url: 'https://www.ojafr.ir/main/attachments/article/87/OJAFR,%20B44,%20235-239,%202012.pdf' },
  { title: 'বাণিজ্যিক গো-খাদ্যের লেবেল বনাম ল্যাব: ৯ ব্র্যান্ডের প্রোটিন বিশ্লেষণ (SAARC J. Agric.)', url: 'https://www.banglajol.info/index.php/SJA/article/view/48393' },
  { title: 'বাকৃবি, ব্রাহমান ক্রস ষাঁড়ের রেশন ও খাদ্যের রাসায়নিক বিশ্লেষণ (LRRD 27/5)', url: 'https://lrrd.cipav.org.co/lrrd27/5/rash27100.htm' },
  { title: 'BLRI ল্যাবে ইউএমএসের পুষ্টিমান ও প্রস্তুত প্রণালি (Pak. J. Biol. Sci. 2002)', url: 'https://scialert.net/fulltext/?doi=pjbs.2002.997.999' },
  { title: 'বাংলাদেশের ৬ জাতের ধানের খড়ের পুষ্টিমান (Bangladesh J. Anim. Sci.)', url: 'https://www.banglajol.info/index.php/BJAS/article/view/9679' },
  { title: 'জার্মান ঘাসের বাংলাদেশি বিশ্লেষণ (Frontiers in Animal Science, 2024)', url: 'https://www.frontiersin.org/journals/animal-science/articles/10.3389/fanim.2024.1485887/full' },
  { title: 'USDA GAIN, Bangladesh Grain and Feed Annual 2026: ভুট্টা, গম ও ফিডের খুচরা দাম', url: 'https://www.fas.usda.gov/data/gain-report/2026/04/Grain%20and%20Feed%20Annual_Dhaka_Bangladesh_BG2026-0002.pdf' },
  { title: 'খড়ের দাম মণে ৯০০-১২০০ টাকা, ডিসেম্বর ২০২৪ (The Business Standard বাংলা)', url: 'https://www.tbsnews.net/bangla/%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%E0%A6%A6%E0%A7%87%E0%A6%B6/news-details-292741' },
  { title: 'সিলেটে বন্যার পর খড়ের দাম মণে ৩০০-৩৫০ থেকে ৮০০-১০০০ টাকা, মে ২০২৬ (The Daily Star / Asia News Network)', url: 'https://asianews.network/floods-trigger-cattle-feed-crisis-in-bangladeshs-sylhet/' },
];

export const feedById = (id) => FEEDS.find((f) => f.id === id);

export const feedMax = (feed, animalType) => (feed.maxBy && feed.maxBy[animalType]) || feed.max;
