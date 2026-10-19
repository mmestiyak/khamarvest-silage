// Generates area/<slug>.html district landing pages + area/index.html.
// Run: npm run build:areas (then npm run build:blog to refresh the sitemap).
// Content rules: everything must stay truthful — no depots, no delivery-time
// promises, transport cost "জানানো হয়" only. Keep facts in sync with AGENTS.md.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
// Price comes from scripts/product.json so 33 generated pages can never drift
// from it. Change it with `npm run set-price`, never by hand.
import { CALL_TEL } from './contact.mjs';
import { product } from './product.mjs';

const root = process.cwd();
const siteUrl = 'https://silage.khamarvest.com';
const areaDir = join(root, 'area');
await mkdir(areaDir, { recursive: true });

// context keys: dairy (পাবনা-সিরাজগঞ্জ belt), north (কৃষিপ্রধান উত্তর),
// urban (শহরঘেঁষা খামার), coastal, general
const CONTEXT = {
  dairy: (d) => `${d.name} অঞ্চল দুধের খামারের জন্য পরিচিত। দুধের গাভীর রেশনে আঁশ ও শক্তির জোগান সারা বছর একরকম রাখা কঠিন, বিশেষ করে যখন কাঁচা ঘাসের সংকট চলে। ভুট্টা সাইলেজ সেই ঘাটতির মাসগুলোর জন্য আগে থেকে মজুদ রাখা যায়।`,
  north: (d) => `কৃষিপ্রধান ${d.name} অঞ্চলে গরু পালন ও মোটাতাজাকরণ দুটোই জনপ্রিয়। খড় সস্তায় পেট ভরায় কিন্তু পুষ্টি সামান্য, আর ভুট্টা সাইলেজে আঁশের সাথে দানার শক্তিটাও আসে। দুটোর সৎ তুলনা দেখুন <a href="/blog/silage-vs-kacha-ghas-vs-khor#dry-matter" class="font-semibold text-[#0b6a3e] underline underline-offset-4">শুকনা পদার্থের হিসাবে</a>।`,
  urban: (d) => `${d.name} ও আশপাশের শহরঘেঁষা খামারগুলোর বড় সমস্যা ঘাসের জমি না থাকা। ভুট্টা সাইলেজ সেই সমস্যার সহজ সমাধান: জমি বা ঘাস কাটার লোক ছাড়াই সারা বছর সবুজ খাদ্য, বস্তা খুলে দিলেই হলো।`,
  coastal: (d) => `${d.name} অঞ্চলে বর্ষা ও লোনা পানির কারণে সবুজ ঘাসের জোগান বছরজুড়ে সমান থাকে না। এয়ারটাইট বস্তার ভুট্টা সাইলেজ সেই ঘাটতির জন্য আগে থেকে রাখা যায়: না-খোলা বস্তা ৬-১২ মাস ভালো থাকে।`,
  general: (d) => `${d.name} জেলার দুধের খামারি, মোটাতাজাকরণকারী কিংবা ছাগল-ভেড়ার খামারি, সবার জন্যই ভুট্টা সাইলেজ সারা বছরের সবুজ খাদ্যের সহজ সমাধান। কাঁচা ঘাসের সংকটের দিনেও সবুজ খাদ্যের জোগান থাকে।`,
};

const districts = [
  { name: 'বগুড়া', loc: 'বগুড়ায়', slug: 'bogura', en: 'Bogura', division: 'রাজশাহী', near: ['joypurhat', 'naogaon', 'gaibandha', 'sirajganj'], ctx: 'north', upazilas: 'বগুড়া সদর, শেরপুর, ধুনট, শাজাহানপুর, গাবতলী, সারিয়াকান্দি, সোনাতলা, শিবগঞ্জ, কাহালু, নন্দীগ্রাম, দুপচাঁচিয়া, আদমদীঘি' },
  { name: 'পাবনা', loc: 'পাবনায়', slug: 'pabna', en: 'Pabna', division: 'রাজশাহী', near: ['sirajganj', 'natore', 'kushtia'], ctx: 'dairy', upazilas: 'পাবনা সদর, ঈশ্বরদী, আটঘরিয়া, চাটমোহর, ভাঙ্গুড়া, ফরিদপুর, সুজানগর, বেড়া, সাঁথিয়া', localCall: '01575-805542' },
  { name: 'সিরাজগঞ্জ', loc: 'সিরাজগঞ্জে', slug: 'sirajganj', en: 'Sirajganj', division: 'রাজশাহী', near: ['pabna', 'bogura', 'tangail'], ctx: 'dairy', upazilas: 'সিরাজগঞ্জ সদর, শাহজাদপুর, উল্লাপাড়া, বেলকুচি, চৌহালি, কাজীপুর, কামারখন্দ, রায়গঞ্জ, তাড়াশ', localCall: '01575-805542' },
  { name: 'নাটোর', loc: 'নাটোরে', slug: 'natore', en: 'Natore', division: 'রাজশাহী', near: ['rajshahi', 'pabna', 'bogura', 'naogaon'], ctx: 'general', upazilas: 'নাটোর সদর, সিংড়া, বড়াইগ্রাম, গুরুদাসপুর, লালপুর, বাগাতিপাড়া, নলডাঙ্গা' },
  { name: 'রংপুর', loc: 'রংপুরে', slug: 'rangpur', en: 'Rangpur', division: 'রংপুর', near: ['gaibandha', 'nilphamari', 'kurigram', 'lalmonirhat'], ctx: 'north', upazilas: 'রংপুর সদর, বদরগঞ্জ, গঙ্গাচড়া, কাউনিয়া, মিঠাপুকুর, পীরগাছা, পীরগঞ্জ, তারাগঞ্জ' },
  { name: 'দিনাজপুর', loc: 'দিনাজপুরে', slug: 'dinajpur', en: 'Dinajpur', division: 'রংপুর', near: ['thakurgaon', 'nilphamari', 'joypurhat', 'rangpur'], ctx: 'north', upazilas: 'দিনাজপুর সদর, বিরল, বীরগঞ্জ, বিরামপুর, বোচাগঞ্জ, চিরিরবন্দর, ফুলবাড়ী, ঘোড়াঘাট, হাকিমপুর, কাহারোল, খানসামা, নবাবগঞ্জ, পার্বতীপুর' },
  { name: 'ময়মনসিংহ', loc: 'ময়মনসিংহে', slug: 'mymensingh', en: 'Mymensingh', division: 'ময়মনসিংহ', near: ['jamalpur', 'kishoreganj', 'tangail', 'gazipur'], ctx: 'general', upazilas: 'ময়মনসিংহ সদর, ভালুকা, ত্রিশাল, মুক্তাগাছা, ফুলবাড়ীয়া, গফরগাঁও, ঈশ্বরগঞ্জ, নান্দাইল, গৌরীপুর, ফুলপুর, হালুয়াঘাট, ধোবাউড়া, তারাকান্দা' },
  { name: 'টাঙ্গাইল', loc: 'টাঙ্গাইলে', slug: 'tangail', en: 'Tangail', division: 'ঢাকা', near: ['sirajganj', 'gazipur', 'mymensingh'], ctx: 'general', upazilas: 'টাঙ্গাইল সদর, বাসাইল, ভূঞাপুর, দেলদুয়ার, ধনবাড়ী, ঘাটাইল, গোপালপুর, কালিহাতী, মধুপুর, মির্জাপুর, নাগরপুর, সখিপুর' },
  { name: 'ঢাকা', loc: 'ঢাকায়', slug: 'dhaka', en: 'Dhaka', division: 'ঢাকা', near: ['gazipur', 'tangail'], ctx: 'urban', upazilas: 'সাভার, ধামরাই, কেরানীগঞ্জ, দোহার, নবাবগঞ্জ' },
  { name: 'গাজীপুর', loc: 'গাজীপুরে', slug: 'gazipur', en: 'Gazipur', division: 'ঢাকা', near: ['dhaka', 'tangail', 'mymensingh'], ctx: 'urban', upazilas: 'গাজীপুর সদর, কালিয়াকৈর, কালীগঞ্জ, কাপাসিয়া, শ্রীপুর' },
  { name: 'কুষ্টিয়া', loc: 'কুষ্টিয়ায়', slug: 'kushtia', en: 'Kushtia', division: 'খুলনা', near: ['pabna', 'natore', 'jashore'], ctx: 'general', upazilas: 'কুষ্টিয়া সদর, কুমারখালী, খোকসা, মিরপুর, ভেড়ামারা, দৌলতপুর', localCall: '01575-805542' },
  { name: 'যশোর', loc: 'যশোরে', slug: 'jashore', en: 'Jashore', division: 'খুলনা', near: ['khulna', 'satkhira', 'kushtia'], ctx: 'general', upazilas: 'যশোর সদর, অভয়নগর, বাঘারপাড়া, চৌগাছা, ঝিকরগাছা, কেশবপুর, মনিরামপুর, শার্শা' },
  { name: 'খুলনা', loc: 'খুলনায়', slug: 'khulna', en: 'Khulna', division: 'খুলনা', near: ['jashore', 'satkhira', 'barishal'], ctx: 'coastal', upazilas: 'বটিয়াঘাটা, দাকোপ, ডুমুরিয়া, দিঘলিয়া, কয়রা, পাইকগাছা, ফুলতলা, রূপসা, তেরখাদা' },
  { name: 'সাতক্ষীরা', loc: 'সাতক্ষীরায়', slug: 'satkhira', en: 'Satkhira', division: 'খুলনা', near: ['khulna', 'jashore'], ctx: 'coastal', upazilas: 'সাতক্ষীরা সদর, আশাশুনি, দেবহাটা, কলারোয়া, কালীগঞ্জ, শ্যামনগর, তালা' },
  { name: 'কুমিল্লা', loc: 'কুমিল্লায়', slug: 'cumilla', en: 'Cumilla', division: 'চট্টগ্রাম', near: ['brahmanbaria', 'noakhali', 'habiganj'], ctx: 'general', upazilas: 'কুমিল্লা সদর, সদর দক্ষিণ, লালমাই, বরুড়া, ব্রাহ্মণপাড়া, বুড়িচং, চান্দিনা, চৌদ্দগ্রাম, দাউদকান্দি, দেবিদ্বার, হোমনা, লাকসাম, মনোহরগঞ্জ, মেঘনা, মুরাদনগর, নাঙ্গলকোট, তিতাস' },
  { name: 'নোয়াখালী', loc: 'নোয়াখালীতে', slug: 'noakhali', en: 'Noakhali', division: 'চট্টগ্রাম', near: ['cumilla', 'chattogram'], ctx: 'coastal', upazilas: 'নোয়াখালী সদর, বেগমগঞ্জ, চাটখিল, কোম্পানীগঞ্জ, হাতিয়া, সেনবাগ, সোনাইমুড়ী, সুবর্ণচর, কবিরহাট' },
  { name: 'চট্টগ্রাম', loc: 'চট্টগ্রামে', slug: 'chattogram', en: 'Chattogram', division: 'চট্টগ্রাম', near: ['coxsbazar', 'noakhali'], ctx: 'urban', upazilas: 'আনোয়ারা, বাঁশখালী, বোয়ালখালী, চন্দনাইশ, ফটিকছড়ি, হাটহাজারী, লোহাগাড়া, মিরসরাই, পটিয়া, রাঙ্গুনিয়া, রাউজান, সন্দ্বীপ, সাতকানিয়া, সীতাকুণ্ড, কর্ণফুলী' },
  { name: 'কক্সবাজার', loc: 'কক্সবাজারে', slug: 'coxsbazar', en: "Cox's Bazar", division: 'চট্টগ্রাম', near: ['chattogram'], ctx: 'coastal', upazilas: 'কক্সবাজার সদর, চকরিয়া, কুতুবদিয়া, মহেশখালী, রামু, টেকনাফ, উখিয়া, পেকুয়া, ঈদগাঁও' },
  { name: 'রাজশাহী', loc: 'রাজশাহীতে', slug: 'rajshahi', en: 'Rajshahi', division: 'রাজশাহী', near: ['natore', 'naogaon', 'bogura'], ctx: 'north', upazilas: 'পবা, গোদাগাড়ী, তানোর, মোহনপুর, বাগমারা, দুর্গাপুর, পুঠিয়া, চারঘাট, বাঘা' },
  { name: 'নওগাঁ', loc: 'নওগাঁয়', slug: 'naogaon', en: 'Naogaon', division: 'রাজশাহী', near: ['bogura', 'joypurhat', 'rajshahi'], ctx: 'north', upazilas: 'নওগাঁ সদর, আত্রাই, বদলগাছী, ধামইরহাট, মান্দা, মহাদেবপুর, নিয়ামতপুর, পত্নীতলা, পোরশা, রাণীনগর, সাপাহার' },
  { name: 'জয়পুরহাট', loc: 'জয়পুরহাটে', slug: 'joypurhat', en: 'Joypurhat', division: 'রাজশাহী', near: ['bogura', 'naogaon', 'dinajpur'], ctx: 'north', upazilas: 'জয়পুরহাট সদর, আক্কেলপুর, কালাই, ক্ষেতলাল, পাঁচবিবি' },
  { name: 'গাইবান্ধা', loc: 'গাইবান্ধায়', slug: 'gaibandha', en: 'Gaibandha', division: 'রংপুর', near: ['bogura', 'rangpur', 'kurigram'], ctx: 'north', upazilas: 'গাইবান্ধা সদর, ফুলছড়ি, গোবিন্দগঞ্জ, পলাশবাড়ী, সাদুল্লাপুর, সাঘাটা, সুন্দরগঞ্জ' },
  { name: 'নীলফামারী', loc: 'নীলফামারীতে', slug: 'nilphamari', en: 'Nilphamari', division: 'রংপুর', near: ['rangpur', 'dinajpur', 'lalmonirhat'], ctx: 'north', upazilas: 'নীলফামারী সদর, ডিমলা, ডোমার, জলঢাকা, কিশোরগঞ্জ, সৈয়দপুর' },
  { name: 'কুড়িগ্রাম', loc: 'কুড়িগ্রামে', slug: 'kurigram', en: 'Kurigram', division: 'রংপুর', near: ['rangpur', 'gaibandha', 'lalmonirhat'], ctx: 'north', upazilas: 'কুড়িগ্রাম সদর, ভুরুঙ্গামারী, চর রাজিবপুর, চিলমারী, ফুলবাড়ী, নাগেশ্বরী, রাজারহাট, রৌমারী, উলিপুর' },
  { name: 'লালমনিরহাট', loc: 'লালমনিরহাটে', slug: 'lalmonirhat', en: 'Lalmonirhat', division: 'রংপুর', near: ['rangpur', 'nilphamari', 'kurigram'], ctx: 'north', upazilas: 'লালমনিরহাট সদর, আদিতমারী, হাতীবান্ধা, কালীগঞ্জ, পাটগ্রাম' },
  { name: 'ঠাকুরগাঁও', loc: 'ঠাকুরগাঁওয়ে', slug: 'thakurgaon', en: 'Thakurgaon', division: 'রংপুর', near: ['dinajpur', 'nilphamari', 'rangpur'], ctx: 'north', upazilas: 'ঠাকুরগাঁও সদর, বালিয়াডাঙ্গী, হরিপুর, পীরগঞ্জ, রাণীশংকৈল' },
  { name: 'জামালপুর', loc: 'জামালপুরে', slug: 'jamalpur', en: 'Jamalpur', division: 'ময়মনসিংহ', near: ['mymensingh', 'tangail', 'sirajganj'], ctx: 'general', upazilas: 'জামালপুর সদর, বকশীগঞ্জ, দেওয়ানগঞ্জ, ইসলামপুর, মাদারগঞ্জ, মেলান্দহ, সরিষাবাড়ী' },
  { name: 'কিশোরগঞ্জ', loc: 'কিশোরগঞ্জে', slug: 'kishoreganj', en: 'Kishoreganj', division: 'ঢাকা', near: ['mymensingh', 'brahmanbaria', 'gazipur'], ctx: 'general', upazilas: 'কিশোরগঞ্জ সদর, অষ্টগ্রাম, বাজিতপুর, ভৈরব, হোসেনপুর, ইটনা, করিমগঞ্জ, কটিয়াদী, কুলিয়ারচর, মিঠামইন, নিকলী, পাকুন্দিয়া, তাড়াইল' },
  { name: 'ব্রাহ্মণবাড়িয়া', loc: 'ব্রাহ্মণবাড়িয়ায়', slug: 'brahmanbaria', en: 'Brahmanbaria', division: 'চট্টগ্রাম', near: ['cumilla', 'kishoreganj', 'habiganj'], ctx: 'general', upazilas: 'ব্রাহ্মণবাড়িয়া সদর, আখাউড়া, আশুগঞ্জ, বাঞ্ছারামপুর, বিজয়নগর, কসবা, নবীনগর, নাসিরনগর, সরাইল' },
  { name: 'সিলেট', loc: 'সিলেটে', slug: 'sylhet', en: 'Sylhet', division: 'সিলেট', near: ['habiganj', 'brahmanbaria', 'mymensingh'], ctx: 'general', upazilas: 'সিলেট সদর, বালাগঞ্জ, বিয়ানীবাজার, বিশ্বনাথ, কোম্পানীগঞ্জ, দক্ষিণ সুরমা, ফেঞ্চুগঞ্জ, গোলাপগঞ্জ, গোয়াইনঘাট, জৈন্তাপুর, কানাইঘাট, জকিগঞ্জ, ওসমানীনগর' },
  { name: 'হবিগঞ্জ', loc: 'হবিগঞ্জে', slug: 'habiganj', en: 'Habiganj', division: 'সিলেট', near: ['sylhet', 'brahmanbaria', 'cumilla'], ctx: 'general', upazilas: 'হবিগঞ্জ সদর, আজমিরীগঞ্জ, বাহুবল, বানিয়াচং, চুনারুঘাট, লাখাই, মাধবপুর, নবীগঞ্জ, শায়েস্তাগঞ্জ' },
  { name: 'ফরিদপুর', loc: 'ফরিদপুরে', slug: 'faridpur', en: 'Faridpur', division: 'ঢাকা', near: ['dhaka', 'kushtia', 'jashore'], ctx: 'general', upazilas: 'ফরিদপুর সদর, আলফাডাঙ্গা, ভাঙ্গা, বোয়ালমারী, চরভদ্রাসন, মধুখালী, নগরকান্দা, সদরপুর, সালথা' },
  { name: 'বরিশাল', loc: 'বরিশালে', slug: 'barishal', en: 'Barishal', division: 'বরিশাল', near: ['khulna', 'faridpur', 'noakhali'], ctx: 'coastal', upazilas: 'বরিশাল সদর, আগৈলঝাড়া, বাবুগঞ্জ, বাকেরগঞ্জ, বানারীপাড়া, গৌরনদী, হিজলা, মেহেন্দিগঞ্জ, মুলাদী, উজিরপুর' },
  { name: 'চাঁপাইনবাবগঞ্জ', loc: 'চাঁপাইনবাবগঞ্জে', slug: 'chapainawabganj', en: 'Chapainawabganj', division: 'রাজশাহী', near: ['rajshahi', 'naogaon'], ctx: 'north', upazilas: 'চাঁপাইনবাবগঞ্জ সদর, শিবগঞ্জ, গোমস্তাপুর, নাচোল, ভোলাহাট' },
  { name: 'পঞ্চগড়', loc: 'পঞ্চগড়ে', slug: 'panchagarh', en: 'Panchagarh', division: 'রংপুর', near: ['thakurgaon', 'dinajpur', 'nilphamari'], ctx: 'north', upazilas: 'পঞ্চগড় সদর, আটোয়ারী, বোদা, দেবীগঞ্জ, তেঁতুলিয়া' },
  { name: 'শেরপুর', loc: 'শেরপুরে', slug: 'sherpur', en: 'Sherpur', division: 'ময়মনসিংহ', near: ['jamalpur', 'mymensingh', 'netrokona'], ctx: 'general', upazilas: 'শেরপুর সদর, নকলা, নালিতাবাড়ী, ঝিনাইগাতী, শ্রীবরদী' },
  { name: 'নেত্রকোনা', loc: 'নেত্রকোনায়', slug: 'netrokona', en: 'Netrokona', division: 'ময়মনসিংহ', near: ['mymensingh', 'kishoreganj', 'sherpur'], ctx: 'general', upazilas: 'নেত্রকোনা সদর, আটপাড়া, বারহাট্টা, দুর্গাপুর, খালিয়াজুরী, কলমাকান্দা, কেন্দুয়া, মদন, মোহনগঞ্জ, পূর্বধলা' },
  { name: 'মানিকগঞ্জ', loc: 'মানিকগঞ্জে', slug: 'manikganj', en: 'Manikganj', division: 'ঢাকা', near: ['dhaka', 'tangail', 'faridpur'], ctx: 'general', upazilas: 'মানিকগঞ্জ সদর, দৌলতপুর, ঘিওর, হরিরামপুর, সাটুরিয়া, শিবালয়, সিংগাইর' },
  { name: 'ঝিনাইদহ', loc: 'ঝিনাইদহে', slug: 'jhenaidah', en: 'Jhenaidah', division: 'খুলনা', near: ['kushtia', 'jashore', 'chuadanga'], ctx: 'general', upazilas: 'ঝিনাইদহ সদর, হরিণাকুণ্ডু, কালীগঞ্জ, কোটচাঁদপুর, মহেশপুর, শৈলকুপা' },
  { name: 'চুয়াডাঙ্গা', loc: 'চুয়াডাঙ্গায়', slug: 'chuadanga', en: 'Chuadanga', division: 'খুলনা', near: ['kushtia', 'jhenaidah', 'meherpur'], ctx: 'general', upazilas: 'চুয়াডাঙ্গা সদর, আলমডাঙ্গা, দামুড়হুদা, জীবননগর' },
  { name: 'মেহেরপুর', loc: 'মেহেরপুরে', slug: 'meherpur', en: 'Meherpur', division: 'খুলনা', near: ['kushtia', 'chuadanga'], ctx: 'general', upazilas: 'মেহেরপুর সদর, গাংনী, মুজিবনগর' },
];

// Production base. The silage is mainly made in Bogura district, around the
// Sherpur, Dhunat and Shahjahanpur upazilas, with additional production
// elsewhere in the country when demand requires it. Saying where the product
// actually comes from is a trust signal competitors do not give, and for the
// Bogura page it is a genuine local-search advantage. Nothing below claims a
// depot, branch or stockist anywhere: there are none.
const ORIGIN = (d) => d.slug === 'bogura'
  ? `      <h2 class="mt-9 text-2xl font-bold text-[#123b28]">বগুড়ার সাইলেজ বগুড়াতেই তৈরি</h2>
      <p class="mt-3 max-w-3xl leading-8 text-[#33483a]">খামারভেস্ট সাইলেজের মূল উৎপাদন বগুড়া জেলাতেই, শেরপুর, ধুনট ও শাজাহানপুরসহ আশপাশের উপজেলার ভুট্টা খেত থেকে। অর্থাৎ বগুড়ার খামারি যে বস্তাটা হাতে পান সেটি দূরের জেলা থেকে আসা মাল নয়, একই জেলায় তৈরি। ফসল কাটা, চপ করা, চেপে ভরা ও বস্তা সিল করা পর্যন্ত পুরো কাজটাই নিজেদের তত্ত্বাবধানে হয়। এই দল এতদিন দেশের বড় প্রতিষ্ঠানগুলোর জন্য পর্দার আড়ালে বিপুল পরিমাণ সাইলেজ বানিয়েছে; খামারভেস্ট সেই দলেরই নিজের ব্র্যান্ড (<a href="/about#story" class="font-semibold text-[#0b6a3e] underline underline-offset-4">আমাদের গল্প</a>)।</p>
      <p class="mt-3 max-w-3xl leading-8 text-[#33483a]">চাহিদা বেশি হলে দেশের অন্য এলাকাতেও উৎপাদন করা হয়, তবে বগুড়াই মূল ঘাঁটি। বগুড়ায় আমাদের কোনো দোকান বা ডিপো নেই, অর্ডার শুধু WhatsApp নম্বরে নেওয়া হয়।</p>
`
  : `      <h2 class="mt-9 text-2xl font-bold text-[#123b28]">সাইলেজটা তৈরি হয় কোথায়</h2>
      <p class="mt-3 max-w-3xl leading-8 text-[#33483a]">খামারভেস্ট সাইলেজের মূল উৎপাদন <a href="/area/silage-bogura" class="font-semibold text-[#0b6a3e] underline underline-offset-4">বগুড়া জেলায়</a>, শেরপুর, ধুনট ও শাজাহানপুরসহ আশপাশের উপজেলার ভুট্টা খেত থেকে। সেখান থেকেই ${d.loc} বস্তা পাঠানো হয়। চাহিদা অনুযায়ী দেশের অন্য এলাকাতেও উৎপাদন করা হয়। যে দল এতদিন দেশের বড় প্রতিষ্ঠানগুলোর জন্য পর্দার আড়ালে বিপুল পরিমাণ সাইলেজ বানিয়েছে, খামারভেস্ট সেই দলেরই নিজের ব্র্যান্ড (<a href="/about#story" class="font-semibold text-[#0b6a3e] underline underline-offset-4">আমাদের গল্প</a>)।</p>
      <p class="mt-3 max-w-3xl leading-8 text-[#33483a]">${d.name} জেলায় খামারভেস্টের কোনো গুদাম, শাখা বা ডিলার নেই। কেউ আমাদের নাম ব্যবহার করে ${d.loc} দোকান বা ডিপো দেখালে আগে যাচাই করে নিন, অর্ডার শুধু WhatsApp নম্বরে নেওয়া হয়। কেনার আগে দেখে নিতে পারেন <a href="/blog/nirapode-silage-kenar-niyom" class="font-semibold text-[#0b6a3e] underline underline-offset-4">নিরাপদে সাইলেজ কেনার নিয়ম</a>।</p>
`;

// A real production photo and the video, then the trust page. District pages
// had no image at all, while a cash-on-delivery buyer ordering from a website
// they have never seen needs to see that the product and the people are real.
// Bengali digits for counts written into copy, so "৩৩টি জেলা" cannot go stale again.
const bnNum = (n) => String(n).replace(/[0-9]/g, (x) => '০১২৩৪৫৬৭৮৯'[+x]);
// Bengali genitive: vowel-ending names take র (বগুড়ার), consonant-ending
// names take ের (দিনাজপুরের), ও-ending take য়ের (ঠাকুরগাঁওয়ের).
// Until 2026-10-20 the template appended র everywhere and printed "দিনাজপুরর".
const gen = (n) => {
  const base = n.replace(/\u0981$/, '');
  if (/[\u09BE-\u09CC]$/.test(base)) return n + 'র';
  if (/ও$/.test(base)) return n + 'য়ের';
  return n + 'ের';
};

const bySlug = Object.fromEntries(districts.map((d) => [d.slug, d]));
const fbSvg = '<svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';

function page(d) {
  const url = `${siteUrl}/area/silage-${d.slug}`;
  // Names the district page and asks for upazila and bag count, the two facts
  // the owner needs before quoting transport. Also tells the owner which page sent the lead.
  const wa = `https://wa.me/8801303438063?text=${encodeURIComponent(`আসসালামু আলাইকুম, ${d.name} জেলার পাতা থেকে লিখছি। ভুট্টা সাইলেজ নিতে চাই।\nউপজেলা: \nবস্তা: `)}`;
  const callBtn = (cls) => `<a href="tel:${CALL_TEL}" class="${cls}">কল করুন</a>`;
  // Google cuts a title around 60 characters; long district names drop "ভুট্টা".
  const titleSpan = `${d.loc} ভুট্টা সাইলেজ: ${product.perKgBn} টাকা কেজি, হোম ডেলিভারি`;
  const title = titleSpan.length > 60
    ? `${d.loc} সাইলেজ: ${product.perKgBn} টাকা কেজি, হোম ডেলিভারি | খামারভেস্ট`
    : `${titleSpan} | খামারভেস্ট সাইলেজ`;
  const desc = `${d.name} জেলার সব উপজেলায় খাঁটি ভুট্টা সাইলেজ ডেলিভারি। দাম ${product.perKgBn} টাকা কেজি, ${product.bagKgBn} কেজি এয়ারটাইট বস্তা ${product.bagPriceBn} টাকা, টাকা পণ্য হাতে পেয়ে। WhatsApp: +880 1303-438063।`;
  const nearLinks = d.near.map((s) => `<a href="/area/silage-${s}" class="font-semibold text-[#0b6a3e] underline underline-offset-4">${bySlug[s].name}</a>`).join(', ');

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${d.name} সাইলেজ, ${d.loc} সাইলেজ কোথায় পাওয়া যায়, সাইলেজ ${d.name}, ${d.name} গরুর খাদ্য, ভুট্টা সাইলেজ ${d.name}, silage ${d.en.toLowerCase()}, খামারভেস্ট সাইলেজ">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="bn_BD">
  <meta property="og:site_name" content="খামারভেস্ট (Khamarvest)">
  <meta property="og:title" content="${d.loc} ভুট্টা সাইলেজ: ${product.perKgBn} টাকা কেজি, হোম ডেলিভারি">
  <meta property="og:description" content="${d.name} জেলার সব উপজেলায় ডেলিভারি। টাকা পণ্য হাতে পেয়ে।">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${siteUrl}/img/silage-production-1400.jpeg">
  <link rel="preload" href="/fonts/hind-siliguri-400-bengali.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/site.css">
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@graph":[
      {
        "@type":"Service",
        "name":"${d.loc} ভুট্টা সাইলেজ হোম ডেলিভারি",
        "serviceType":"Cattle feed delivery (corn silage)",
        "inLanguage":"bn-BD",
        "url":"${url}",
        "areaServed":{"@type":"AdministrativeArea","name":"${d.en} District, Bangladesh"},
        "provider":{"@type":"Organization","name":"খামারভেস্ট (Khamarvest)","telephone":"+8801303438063","url":"${siteUrl}/","address":{"@type":"PostalAddress","addressLocality":"বগুড়া","addressRegion":"রাজশাহী","addressCountry":"BD"}}
      },
      {
        "@type":"BreadcrumbList",
        "itemListElement":[
          {"@type":"ListItem","position":1,"name":"হোম","item":"${siteUrl}/"},
          {"@type":"ListItem","position":2,"name":"ডেলিভারি এলাকা","item":"${siteUrl}/area/"},
          {"@type":"ListItem","position":3,"name":"${d.name}","item":"${url}"}
        ]
      },
      {
        "@type":"FAQPage",
        "mainEntity":[
          {"@type":"Question","name":"${d.loc} কি ভুট্টা সাইলেজ ডেলিভারি হয়?","acceptedAnswer":{"@type":"Answer","text":"হ্যাঁ, খামারভেস্ট সাইলেজ ${d.name} জেলার সব উপজেলায় হোম ডেলিভারি দেয়। WhatsApp-এ (+880 1303-438063) নাম, ঠিকানা ও বস্তার সংখ্যা লিখে পাঠালেই অর্ডার হয়ে যায়।"}},
          {"@type":"Question","name":"${d.loc} ডেলিভারি চার্জ কত?","acceptedAnswer":{"@type":"Answer","text":"পরিবহন খরচ ঠিকানার দূরত্ব ও বস্তার সংখ্যাভেদে আলাদা হয়। অর্ডারের পর কনফার্মেশন কলে ডেলিভারিসহ মোট খরচ আগেই জানিয়ে দেওয়া হয়, পরে বাড়তি কিছু চাওয়া হয় না।"}},
          {"@type":"Question","name":"কত দিনে পৌঁছায়?","acceptedAnswer":{"@type":"Answer","text":"অর্ডার কনফার্ম করার সময়ই ডেলিভারির তারিখ জানিয়ে দেওয়া হয়। এলাকা ও পরিমাণ অনুযায়ী তারিখ ঠিক হয়।"}},
          {"@type":"Question","name":"টাকা কীভাবে দিতে হয়?","acceptedAnswer":{"@type":"Answer","text":"পণ্য হাতে পেয়ে, বস্তা ও মান দেখে তারপর টাকা দেবেন: নগদে (ক্যাশ অন ডেলিভারি), অথবা খামারভেস্টের নিজের নামের ব্যাংক অ্যাকাউন্টে ট্রান্সফার করে। আগে কোনো টাকা দিতে হয় না।"}},
          {"@type":"Question","name":"সর্বনিম্ন কত বস্তা নিতে হয়?","acceptedAnswer":{"@type":"Answer","text":"কোনো ন্যূনতম অর্ডার নেই, এক বস্তাও নেওয়া যায়। তবে পরিবহন খরচ দূরত্ব ও পরিমাণভেদে আলাদা, তাই দূরের জেলায় অল্প বস্তায় কেজিপ্রতি পরিবহন খরচ বেশি পড়ে। এলাকার কয়েকজন মিলে অর্ডার করলে খরচ ভাগ হয়ে যায়।"}}
        ]
      }
    ]
  }
  </script>
</head>
<body class="bg-[#f7f8f4] font-['Hind_Siliguri'] text-[#233126] antialiased">
  <header class="sticky top-0 z-20 border-b border-[#184d32]/10 bg-white/95 backdrop-blur">
    <nav class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
      <a href="/" class="text-lg font-bold tracking-tight text-[#075a35]">খামারভেস্ট সাইলেজ</a>
      <div class="flex items-center gap-1 sm:gap-3">
        <a href="/area/" class="inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm font-semibold text-[#075a35] hover:bg-[#e7f3e9]">সব এলাকা</a>
        <a href="/blog/" class="inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm font-semibold text-[#075a35] hover:bg-[#e7f3e9]">গাইড</a>
        <a href="https://www.facebook.com/khamarvestSilage/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0b5fcc]/10 px-3 py-1 font-semibold text-sm text-[#0b5fcc] transition hover:bg-[#0b5fcc] hover:text-white">${fbSvg}<span class="hidden sm:inline">Facebook</span></a>
      </div>
    </nav>
  </header>

  <main>
    <section class="border-b border-[#184d32]/10 bg-[#eaf5eb]">
      <div class="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
        <p class="text-sm font-bold tracking-wide text-[#147447]">ডেলিভারি এলাকা · ${d.division} বিভাগ</p>
        <h1 class="mt-3 max-w-3xl text-3xl font-bold leading-snug text-[#123b28] sm:text-4xl">${d.loc} ভুট্টা সাইলেজ: ${product.perKgBn} টাকা কেজি, বাড়ি পর্যন্ত ডেলিভারি</h1>
        <p class="mt-4 max-w-3xl text-lg leading-8 text-[#456451]">${d.name} জেলার সব উপজেলায় খামারভেস্ট সাইলেজের এয়ারটাইট বস্তা পৌঁছে দেওয়া হয়। আগে টাকা নয়, পণ্য হাতে পেয়ে মান দেখে তারপর দাম।</p>
        <div data-cta="hero" class="mt-6 flex flex-wrap gap-3">
          <a href="${wa}" target="_blank" rel="noopener" class="inline-flex rounded-xl bg-[#0b5b38] px-5 py-3 text-base font-bold text-white hover:bg-[#0e7c4b]">WhatsApp-এ অর্ডার করুন</a>
          ${callBtn('inline-flex rounded-xl border border-[#0b5b38]/30 bg-white px-5 py-3 text-base font-bold text-[#0b5b38] hover:bg-[#e7f3e9]')}
        </div>
        <p class="mt-3"><a href="#callback" class="inline-flex min-h-11 items-center font-semibold text-[#0b6a3e] underline underline-offset-4">WhatsApp নেই? নম্বর দিন, আমরা ফোন করব</a></p>
${d.localCall ? `        <p class="mt-1 text-base text-[#33483a]">${d.slug === 'pabna' ? 'পাবনা ও ঈশ্বরদী' : d.name} অঞ্চলের জন্য আরেকটি নম্বর: <a href="tel:+88${d.localCall.replace('-', '')}" class="inline-flex min-h-11 items-center font-bold text-[#0b6a3e] underline underline-offset-4">${d.localCall}</a></p>` : ''}
      </div>
    </section>

    <div class="mx-auto max-w-5xl px-5 py-8 sm:px-6">
      <section class="rounded-2xl border border-[#e4b44c]/40 bg-[#fff8e6] p-5 sm:p-6">
        <h2 class="text-xl font-bold text-[#724c00]">দাম (২০২৬)</h2>
        <p class="mt-2 text-[#624d24]">প্রতি কেজি <strong>${product.perKgBn} টাকা</strong> · ${product.bagKgBn} কেজি এয়ারটাইট বস্তা <strong>${product.bagPriceBn} টাকা</strong> · একসাথে বেশি নিলে ছাড় আলোচনাসাপেক্ষ। পরিবহন খরচ ঠিকানা ও পরিমাণভেদে, কনফার্মেশন কলে আগেই জানানো হয়।</p>
        <a href="${wa}" target="_blank" rel="noopener" data-cta="price" class="mt-4 inline-flex rounded-xl bg-[#0b5b38] px-5 py-2.5 text-base font-bold text-white hover:bg-[#0e7c4b]">${d.loc} ডেলিভারিসহ দাম জানুন</a>
      </section>

      <h2 class="mt-9 text-2xl font-bold text-[#123b28]">${d.loc} খামারিদের জন্য সাইলেজ কেন</h2>
      <p class="mt-3 max-w-3xl leading-8 text-[#33483a]">${CONTEXT[d.ctx](d)}</p>
      <p class="mt-3 max-w-3xl leading-8 text-[#33483a]">ভুট্টা সাইলেজে আস্ত ভুট্টা গাছ দানাসহ কুচি করা থাকে বলে আঁশ ও শক্তি একসাথে মেলে। দুধের গাভীকে দৈনিক ১৫-২৫ কেজি, মোটাতাজাকরণের গরুকে ১০-২০ কেজি আর ছাগল-ভেড়াকে ১-২ কেজি দেওয়া হয়। নতুন হলে আগে পড়ুন: <a href="/blog/silage-ki-kivabe-toiri-upokarita" class="font-semibold text-[#0b6a3e] underline underline-offset-4">সাইলেজ কী?</a> আর <a href="/vutta-silage-prothombar-khawano-rules" class="font-semibold text-[#0b6a3e] underline underline-offset-4">প্রথমবার খাওয়ানোর নিয়ম</a>।</p>

${ORIGIN(d)}
${d.upazilas ? `      <h2 id="upazila" class="mt-9 text-2xl font-bold text-[#123b28]">${gen(d.name)} যেসব উপজেলায় ডেলিভারি</h2>
      <p class="mt-3 max-w-3xl leading-8 text-[#33483a]">${d.name} জেলার প্রতিটি উপজেলায় বস্তা পৌঁছে দেওয়া হয়: ${d.upazilas}। পরিবহন খরচ উপজেলা ও বস্তার সংখ্যা দেখে কনফার্মেশন কলে জানানো হয়; পাশের খামারিরা মিলে এক গাড়িতে নিলে কেজিপ্রতি পরিবহন কম পড়ে।</p>
` : ''}      <h2 class="mt-9 text-2xl font-bold text-[#123b28]">${d.name} থেকে অর্ডারের নিয়ম (৩ ধাপ)</h2>
      <ol class="mt-4 grid gap-4 sm:grid-cols-3">
        <li class="rounded-xl border border-[#184d32]/10 bg-white p-5"><strong class="block text-[#0b6a3e]">১. মেসেজ পাঠান</strong>নাম, ${gen(d.name)} ঠিকানা ও কত বস্তা লাগবে লিখে WhatsApp করুন: +880 1303-438063</li>
        <li class="rounded-xl border border-[#184d32]/10 bg-white p-5"><strong class="block text-[#0b6a3e]">২. কনফার্মেশন কল</strong>ডেলিভারির তারিখ ও পরিবহনসহ মোট খরচ আগেই জানানো হবে</li>
        <li class="rounded-xl border border-[#184d32]/10 bg-white p-5"><strong class="block text-[#0b6a3e]">৩. পণ্য বুঝে টাকা</strong>বস্তা হাতে পেয়ে মান দেখে টাকা দেবেন: নগদে বা খামারভেস্টের নামের ব্যাংক অ্যাকাউন্টে</li>
      </ol>
      <div data-cta="steps" class="mt-4 flex flex-wrap gap-3">
        <a href="${wa}" target="_blank" rel="noopener" class="inline-flex rounded-xl bg-[#0b5b38] px-5 py-2.5 text-base font-bold text-white hover:bg-[#0e7c4b]">১ম ধাপ: WhatsApp-এ মেসেজ পাঠান</a>
        ${callBtn('inline-flex rounded-xl border border-[#0b5b38]/30 bg-white px-5 py-2.5 text-base font-bold text-[#0b5b38] hover:bg-[#e7f3e9]')}
      </div>

      <!-- Callback request: saved to the owner's lead sheet by /js/leads.js, for
           farmers who would rather be called than type on WhatsApp. -->
      <section id="callback" data-cta="callback" class="mt-6 rounded-2xl border border-[#184d32]/15 bg-white p-5 sm:p-6">
        <h2 class="text-xl font-bold text-[#123b28]">WhatsApp নেই? নম্বর দিন, আমরা ফোন করব</h2>
        <p class="mt-2 text-[#33483a]">${d.loc} ডেলিভারিসহ মোট খরচ ফোনেই জানিয়ে দেওয়া হবে। আগে কোনো টাকা দিতে হয় না।</p>
        <form data-lead-form data-district="${d.name}" onsubmit="event.preventDefault()" class="mt-4 grid gap-3 sm:grid-cols-2">
          <label class="text-base font-semibold text-[#123b28]">আপনার নাম <span class="font-normal text-[#456451]">(ঐচ্ছিক)</span><input name="name" autocomplete="name" class="mt-1 block min-h-11 w-full rounded-lg border border-[#6f8f7c] bg-white px-3 py-2 text-base font-normal text-black placeholder:text-[#6b7280]" placeholder="যেমন: রহিম উদ্দিন"></label>
          <label class="text-base font-semibold text-[#123b28]">মোবাইল নম্বর<input name="phone" required inputmode="tel" autocomplete="tel" class="mt-1 block min-h-11 w-full rounded-lg border border-[#6f8f7c] bg-white px-3 py-2 text-base font-normal text-black placeholder:text-[#6b7280]" placeholder="01XXXXXXXXX"></label>
          <label class="text-base font-semibold text-[#123b28]">উপজেলা <span class="font-normal text-[#456451]">(ঐচ্ছিক)</span><input name="upazila" autocomplete="address-level2" class="mt-1 block min-h-11 w-full rounded-lg border border-[#6f8f7c] bg-white px-3 py-2 text-base font-normal text-black placeholder:text-[#6b7280]" placeholder="${gen(d.name)} কোন উপজেলা"></label>
          <label class="text-base font-semibold text-[#123b28]">কত বস্তা? <span class="font-normal text-[#456451]">(ঐচ্ছিক)</span><input name="bags" inputmode="numeric" class="mt-1 block min-h-11 w-full rounded-lg border border-[#6f8f7c] bg-white px-3 py-2 text-base font-normal text-black placeholder:text-[#6b7280]" placeholder="যেমন: ১০"></label>
          <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden">
          <button type="submit" class="min-h-11 rounded-xl bg-[#0b5b38] px-5 py-3 text-base font-bold text-white hover:bg-[#0e7c4b] disabled:opacity-60 sm:col-span-2 sm:justify-self-start">ফোন করে দাম জানান</button>
          <p class="text-sm text-[#456451] sm:col-span-2">নাম আর নম্বর শুধু এই অর্ডারের যোগাযোগের জন্য আমাদের কাছে থাকে।</p>
          <p data-lead-status hidden role="status" class="rounded-lg bg-[#eaf5eb] p-3 font-semibold text-[#0b5b38] sm:col-span-2">পেয়েছি, ধন্যবাদ। আমরা এই নম্বরে ফোন করে দাম আর ডেলিভারির খরচ জানাব।</p>
        </form>
      </section>

      <h2 class="mt-9 text-2xl font-bold text-[#123b28]">কত বস্তা লাগবে?</h2>
      <div class="mt-4 overflow-x-auto rounded-xl border border-[#184d32]/10 bg-white">
        <table class="w-full text-left text-base">
          <thead class="bg-[#eaf5eb] font-bold text-[#123b28]"><tr><th class="p-3.5">পশু</th><th class="p-3.5">দৈনিক সাইলেজ</th><th class="p-3.5">মাসে আনুমানিক</th></tr></thead>
          <tbody class="divide-y divide-[#184d32]/10 text-[#33483a]">
            <tr><td class="p-3.5 font-semibold text-[#0b6a3e]">দুধের গাভী</td><td class="p-3.5">১৫-২৫ কেজি</td><td class="p-3.5">প্রায় ১২ বস্তা</td></tr>
            <tr><td class="p-3.5 font-semibold text-[#0b6a3e]">মোটাতাজাকরণের গরু</td><td class="p-3.5">১০-২০ কেজি</td><td class="p-3.5">প্রায় ৯ বস্তা</td></tr>
            <tr><td class="p-3.5 font-semibold text-[#0b6a3e]">ছাগল / ভেড়া</td><td class="p-3.5">১-২ কেজি</td><td class="p-3.5">প্রায় ১ বস্তা</td></tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-[#33483a]">নিজের খামারের হিসাব করতে <a href="/tools/silage-calculator" class="font-semibold text-[#0b6a3e] underline underline-offset-4">সাইলেজ ক্যালকুলেটর</a> ব্যবহার করুন, অন্য কোথাও কম দর শুনলে আগে দেখে নিন <a href="/blog/vutta-silage-dam-koto-kothay-kinben" class="font-semibold text-[#0b6a3e] underline underline-offset-4">দাম কীভাবে মিলিয়ে দেখবেন</a>, আর ফ্রি চার্ট-খাতা পাবেন <a href="/tools/" class="font-semibold text-[#0b6a3e] underline underline-offset-4">টুলস পাতায়</a>।</p>

      <h2 class="mt-9 text-2xl font-bold text-[#123b28]">${d.loc} ডেলিভারি নিয়ে সাধারণ প্রশ্ন</h2>
      <div class="mt-4 space-y-3">
        <details class="rounded-xl border border-[#184d32]/10 bg-white p-5" open><summary class="block cursor-pointer py-2 font-bold text-[#0b6a3e]">${gen(d.name)} সব উপজেলায় কি ডেলিভারি হয়?</summary><p class="mt-2 text-[#33483a]">হ্যাঁ। WhatsApp-এ ঠিকানা জানালে আপনার উপজেলা-গ্রামসহ মোট খরচ জানিয়ে দেওয়া হয়।</p></details>
        <details class="rounded-xl border border-[#184d32]/10 bg-white p-5"><summary class="block cursor-pointer py-2 font-bold text-[#0b6a3e]">ডেলিভারি চার্জ কত?</summary><p class="mt-2 text-[#33483a]">দূরত্ব ও বস্তার সংখ্যাভেদে আলাদা। কনফার্মেশন কলে আগেই মোট খরচ বলা হয়, পরে বাড়তি কিছু নেই। এলাকার কয়েকজন মিলে অর্ডার করলে খরচ ভাগ হয়ে যায়; হিসাবের উদাহরণ আছে <a href="/blog/silage-poribohon-khoroch" class="font-semibold text-[#0b6a3e] underline underline-offset-4">পরিবহন খরচের গাইডে</a>।</p></details>
        <details class="rounded-xl border border-[#184d32]/10 bg-white p-5"><summary class="block cursor-pointer py-2 font-bold text-[#0b6a3e]">আগে অল্প নিয়ে পরীক্ষা করা যাবে?</summary><p class="mt-2 text-[#33483a]">যাবে, কোনো ন্যূনতম অর্ডার নেই, এক বস্তাও নেওয়া যায়। দূরের জেলায় অল্প বস্তায় পরিবহন খরচ তুলনায় বেশি পড়ে। প্রথমে কয়েক বস্তা নিয়ে <a href="/vutta-silage-prothombar-khawano-rules" class="font-semibold text-[#0b6a3e] underline underline-offset-4">৭ দিনের নিয়মে</a> গরুকে অভ্যাস করান, তারপর প্রয়োজনমতো নিয়মিত অর্ডার দিন।</p></details>
      </div>

      <p class="mt-8 text-[#456451]">কাছাকাছি জেলায়ও ডেলিভারি: ${nearLinks} · <a href="/area/" class="font-semibold text-[#0b6a3e] underline underline-offset-4">সব এলাকা দেখুন</a></p>

      <section class="mt-9 rounded-2xl bg-[#0b5b38] px-6 py-8 text-white sm:px-8">
        <p class="text-sm font-semibold text-[#b8e5c8]">খামারভেস্ট সাইলেজ (Khamarvest Silage)</p>
        <h2 class="mt-2 text-2xl font-bold">${d.loc} ডেলিভারিসহ দাম জানতে চান?</h2>
        <p class="mt-3 max-w-2xl text-lg leading-8 text-[#e1f5e6]">এক মেসেজেই হিসাব পেয়ে যাবেন। আগে টাকা দিতে হয় না।</p>
        <div data-cta="bottom" class="mt-5 flex flex-wrap gap-3">
          <a href="${wa}" target="_blank" rel="noopener" class="inline-flex rounded-xl bg-white px-5 py-3 text-base font-bold text-[#075a35] hover:bg-[#e5f5e9]">WhatsApp-এ কথা বলুন</a>
          ${callBtn('inline-flex rounded-xl border border-white/40 px-5 py-3 text-base font-bold text-white hover:bg-white/10')}
        </div>
      </section>
    </div>
  </main>

  <footer class="border-t border-[#184d32]/10 bg-white px-5 py-7 text-center text-sm text-[#54705d]">© ২০২৬ খামারভেস্ট সাইলেজ · <a href="/area/" class="font-medium text-[#0b6a3e] underline">ডেলিভারি এলাকা</a> · <a href="/blog/" class="font-medium text-[#0b6a3e] underline">সব গাইড</a> · <a href="/tools/" class="font-medium text-[#0b6a3e] underline">ফ্রি টুলস</a> · <a href="/about" class="font-medium text-[#0b6a3e] underline">আমাদের সম্পর্কে</a></footer>
<script src="/js/leads.js" defer></script>
<script src="/js/ga.js" defer></script></body>
</html>
`;
}

for (const d of districts) {
  await writeFile(join(areaDir, `silage-${d.slug}.html`), page(d));
}

// area index
const cards = districts.map((d) => `
      <a href="/area/silage-${d.slug}" class="rounded-xl border border-[#184d32]/10 bg-white p-4 font-semibold text-[#0b5b38] shadow-sm transition hover:border-[#0e7c4b] hover:shadow">${d.name}<span class="mt-0.5 block text-xs font-medium text-[#54705d]">${d.division} বিভাগ</span></a>`).join('');

const indexHtml = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ভুট্টা সাইলেজ হোম ডেলিভারি: ${bnNum(districts.length)} জেলা, পণ্য হাতে পেয়ে টাকা | খামারভেস্ট সাইলেজ</title>
  <meta name="description" content="বগুড়া থেকে ঢাকা, চট্টগ্রাম, সিলেটসহ ${bnNum(districts.length)}টি জেলার পাতায় দাম, অর্ডারের নিয়ম ও ডেলিভারির তথ্য। সারা বাংলাদেশেই ডেলিভারি হয়।">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${siteUrl}/area/">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="bn_BD">
  <meta property="og:site_name" content="খামারভেস্ট (Khamarvest)">
  <meta property="og:title" content="যেসব জেলায় ভুট্টা সাইলেজ ডেলিভারি দিই">
  <meta property="og:description" content="${bnNum(districts.length)}টি জেলার পাতা, আর সারা বাংলাদেশেই ডেলিভারি। টাকা পণ্য হাতে পেয়ে।">
  <meta property="og:url" content="${siteUrl}/area/">
  <meta property="og:image" content="${siteUrl}/img/silage-production-1400.jpeg">
  <link rel="preload" href="/fonts/hind-siliguri-400-bengali.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/site.css">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"CollectionPage","name":"ডেলিভারি এলাকা","inLanguage":"bn-BD","url":"${siteUrl}/area/"}</script>
</head>
<body class="bg-[#f7f8f4] font-['Hind_Siliguri'] text-[#233126] antialiased">
  <header class="sticky top-0 z-20 border-b border-[#184d32]/10 bg-white/95 backdrop-blur">
    <nav class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
      <a href="/" class="text-lg font-bold tracking-tight text-[#075a35]">খামারভেস্ট সাইলেজ</a>
      <div class="flex items-center gap-3">
        <a href="/tools/" class="rounded-full px-3 py-1.5 text-sm font-semibold text-[#075a35] hover:bg-[#e7f3e9]">ফ্রি টুলস</a>
        <a href="/blog/" class="inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-sm font-semibold text-[#075a35] hover:bg-[#e7f3e9]">গাইড</a>
      </div>
    </nav>
  </header>
  <main class="mx-auto max-w-5xl px-5 py-10 sm:px-6">
    <p class="font-semibold text-[#147447]">ডেলিভারি এলাকা</p>
    <h1 class="mt-1 text-3xl font-bold text-[#123b28] sm:text-4xl">যেসব জেলায় সাইলেজ পৌঁছে দিই</h1>
    <p class="mt-3 max-w-2xl text-lg leading-8 text-[#456451]">নিচের জেলাগুলোর পাতায় দাম, অর্ডারের নিয়ম ও প্রশ্নোত্তর পাবেন। তালিকায় আপনার জেলা না থাকলেও চিন্তা নেই, খামারভেস্ট সাইলেজ সারা বাংলাদেশেই ডেলিভারি দেয়; WhatsApp-এ ঠিকানা পাঠালেই হিসাব জানিয়ে দেওয়া হবে।</p>
    <div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">${cards}
    </div>
    <section class="mt-10 rounded-2xl bg-[#0b5b38] px-6 py-8 text-white sm:px-8">
      <h2 class="text-2xl font-bold">তালিকার বাইরের জেলা থেকে বলছেন?</h2>
      <p class="mt-3 max-w-2xl text-lg leading-8 text-[#e1f5e6]">সমস্যা নেই। নাম, ঠিকানা ও বস্তার সংখ্যা লিখে WhatsApp করুন, ডেলিভারিসহ মোট খরচ জানিয়ে দেওয়া হবে।</p>
      <a href="https://wa.me/8801303438063?text=${encodeURIComponent('আসসালামু আলাইকুম, আমার এলাকায় সাইলেজ ডেলিভারির খরচ জানতে চাই।')}" target="_blank" rel="noopener" class="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-base font-bold text-[#075a35] hover:bg-[#e5f5e9]">WhatsApp-এ কথা বলুন</a>
    </section>
  </main>
  <footer class="border-t border-[#184d32]/10 bg-white px-5 py-7 text-center text-sm text-[#54705d]">© ২০২৬ খামারভেস্ট সাইলেজ · <a href="/blog/" class="font-medium text-[#0b6a3e] underline">সব গাইড</a> · <a href="/tools/" class="font-medium text-[#0b6a3e] underline">ফ্রি টুলস</a> · <a href="/corn-silage-bangladesh" lang="en" class="font-medium text-[#0b6a3e] underline">Corn silage in Bangladesh (English)</a></footer>
<script src="/js/leads.js" defer></script>
<script src="/js/ga.js" defer></script></body>
</html>
`;
await writeFile(join(areaDir, 'index.html'), indexHtml);
console.log(`Generated ${districts.length} district pages + area/index.html`);

// Homepage: the district chips and every "৪১ জেলা" count are written from
// this list. Until 2026-10-20 the chips were hand-kept and lagged 8 pages.
{
  const homePath = join(root, 'index.html');
  const bn = (n) => String(n).replace(/[0-9]/g, (c) => '০১২৩৪৫৬৭৮৯'[c]);
  const chipCls = 'inline-flex min-h-11 items-center font-hind text-[15px] md:text-[17px] bg-white border border-[rgb(14,124,75)] text-[rgb(0,105,68)] rounded-full px-4 hover:bg-[rgb(14,124,75)] hover:text-white';
  const chips = [...districts].sort((a, b) => a.name.localeCompare(b.name, 'bn'))
    .map((d) => `        <a href="/area/silage-${d.slug}" class="${chipCls}">${d.name}</a>`).join('\n');
  let home = await readFile(homePath, 'utf8');
  home = home.replace(/<!-- area-chips:start -->[\s\S]*?<!-- area-chips:end -->/,
    `<!-- area-chips:start -->\n${chips}\n        <a href="/area/" class="inline-flex min-h-11 items-center font-hind text-[15px] md:text-[17px] bg-[rgb(14,124,75)] text-white rounded-full px-4 font-medium">সব জেলা</a>\n<!-- area-chips:end -->`);
  home = home.replace(/<!--area-count-->[^<]*<!--\/area-count-->/g, `<!--area-count-->${bn(districts.length)}<!--/area-count-->`);
  await writeFile(homePath, home);
}
