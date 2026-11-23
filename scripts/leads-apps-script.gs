// Lead inbox for silage.khamarvest.com: a Google Sheet, no server.
//
// One-time setup (5 minutes, owner's Google account):
//   1. Create a new Google Sheet, name it "Khamarvest Leads".
//   2. Extensions > Apps Script. Delete what is there, paste this whole file, Save.
//   3. Pick "setup" in the function dropdown at the top, press Run, and allow
//      the permissions. It creates the tabs, schedules the 8am daily email and
//      sends you one right away so you know email works.
//   4. Deploy > New deployment > type "Web app".
//        Execute as: Me.   Who has access: Anyone.
//      Copy the Web app URL (ends in /exec).
//   5. Paste that URL into LEADS_URL in js/leads.js, then `npm run verify` and push.
//
//
// REDEPLOY NEEDED for the /courier page ("কুরিয়ার অর্ডার", Sundarban Courier orders):
//   1. Paste this whole file over the old one, Save.
//   2. Project Settings (gear) > Script properties > Add (names exact, values are secrets,
//      they live ONLY here, never in this file or the repo):
//        TG_TOKEN          the Telegram bot token (from @BotFather)
//        TG_CHAT_ID        the group's chat id. From a topic link t.me/c/1234567890/5 the chat id
//                          is -100 followed by the first number: -1001234567890, and 5 is the
//                          topic (thread) id. Add the bot to the group, make it allowed to post
//                          in topics (admin, or "Post messages" on), then use these keys:
//        TG_TOPIC_COURIER  thread id of the courier-orders topic (optional)
//        TG_TOPIC_CALL     thread id of the /form "silage hishab" topic (optional)
//        TG_TOPIC_OTHER    thread id for callback, advance booking, shared delivery, homepage orders (optional)
//      A missing TG_TOKEN or TG_CHAT_ID silently turns Telegram off; a missing topic id posts
//      to the group's General topic. This script only SENDS messages (sendMessage only,
//      URL buttons only). It never calls getUpdates, setWebhook or deleteWebhook, so the
//      bot's existing handler elsewhere keeps working.
//   3. Show the manifest: Project Settings > tick "Show appsscript.json manifest file in editor",
//      open appsscript.json and make sure it has these scopes (Telegram needs web requests):
//        "oauthScopes": [
//          "https://www.googleapis.com/auth/spreadsheets",
//          "https://www.googleapis.com/auth/script.external_request",
//          "https://www.googleapis.com/auth/script.send_mail",
//          "https://www.googleapis.com/auth/script.scriptapp",
//          "https://www.googleapis.com/auth/userinfo.email"
//        ]
//   4. Run setup() once from the editor and approve the new permissions. It creates the
//      "কুরিয়ার" tab.
//   5. Optional check: run tgTest() once; it posts one line to each configured topic.
//   6. Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
//
// Courier tab "কুরিয়ার": one row per /courier order: অর্ডার নম্বর (KV-C-0001, 0002, ...),
// তারিখ, নাম, মোবাইল, বিকল্প নম্বর, জেলা, উপজেলা, সুন্দরবন শাখা, বস্তা, সাইলেজ (টাকা),
// কুরিয়ার (টাকা), মোট, ট্রাক দরকার, মাধ্যম (বিকাশ/নগদ), কিসের টাকা, TrxID, পাঠানো টাকা,
// নোট, অবস্থা (dropdown, default "নতুন"), CN নম্বর (you fill it in after booking). The same
// order is also a row in the Leads tab (মাধ্যম "কুরিয়ার"), emailed to you as
// "কুরিয়ার অর্ডার: <নাম> (<জেলা>)" and counted in the 8am digest. Telegram gets the order
// text at once, with buttons "WhatsApp" (reply to the farmer) and "শিট". There is no slip page:
// it was removed because saving it as a photo failed on the owner's phone.
//
// Emails go to the Google account that owns this script. Put another address
// in NOTIFY_EMAIL to send them elsewhere, or 'off' to stop them.
//
// After editing this script later, use Deploy > Manage deployments > Edit >
// Version: New version > Deploy, so the same /exec URL keeps working.
// (Needed once now: the script also receives silagebd.com questions, see below.
// Redeploy as a NEW VERSION of the SAME deployment, never a new deployment.)
//
// REDEPLOY NEEDED for "একসাথে ডেলিভারি" (shared delivery): Deploy > Manage deployments >
// Edit (pencil) > Version: New version > Deploy. Without it the site's shared-delivery
// sign-ups still land in the Leads tab (the details are in the note), but the pool tab,
// the truck-full alert and the digest section below do not run. Then run setup() once
// more from the editor so the pool tab exists.
//
// Shared delivery: the form on district pages, the homepage and the price guide posts
// form_type 'shared_delivery'. Each sign-up is one row in the Leads tab (মাধ্যম
// "একসাথে ডেলিভারি") AND one row in the "একসাথে ডেলিভারি" tab (তারিখ, নাম, মোবাইল, জেলা,
// উপজেলা, বস্তা, কবে লাগবে, অবস্থা "অপেক্ষায়"). District = route for now. Bags of every
// row still "অপেক্ষায়" are totalled per district; when a total crosses a truck size
// in TRUCKS below that it had not crossed before, you get one email listing the
// farmers. When you set a row's অবস্থা to anything else (order done), the total falls
// and the alert re-arms for the next crossing. The 8am digest lists every district's
// waiting bags. Truck sizes live ONLY here (the website names none, and quotes no cost).
//
// Third tab, "SilageBD প্রশ্ন": questions from the question box on silagebd.com
// (public/js/questions.js there posts to this same /exec URL with form_type
// 'silagebd_question'). Columns: তারিখ, প্রশ্ন, জেলা, মোবাইল, পেজ, গাইড, উৎস,
// অবস্থা ("নতুন"). Each question emails the owner "SilageBD: নতুন প্রশ্ন (<জেলা>)",
// with a WhatsApp reply link when a number was given. They never go to the Leads tab.
//
// Two tabs: "Leads" (homepage order form: name, mobile, area, bags) and
// "Clicks" (every WhatsApp / call tap on any page: time, page, button, source;
// no phone number, the site never sees it). Match a WhatsApp chat's time to a
// click row to see which page and source sent that farmer.
//
// The page sends text/plain JSON so the browser makes no CORS preflight; the
// response is never read, which is why errors here are logged, not returned.

var SHEET_NAME = 'Leads';
var NOTIFY_EMAIL = ''; // '' = this script owner's Gmail; or an address; or 'off'
var DIGEST_HOUR = 8;  // daily summary email, Bangladesh time
var TZ = 'Asia/Dhaka';
var CLICKS_NAME = 'Clicks';
var CLICK_HEADERS = ['সময়', 'মাধ্যম', 'পাতার নাম', 'পাতা', 'বোতাম', 'উৎস', 'ডিভাইস', 'কল নম্বর'];
var SHARED_NAME = 'একসাথে ডেলিভারি';
var SHARED_HEADERS = ['তারিখ', 'নাম', 'মোবাইল', 'জেলা', 'উপজেলা', 'বস্তা', 'কবে লাগবে', 'অবস্থা'];
var SHARED_PENDING = 'অপেক্ষায়';
var SHARED_STATUSES = ['অপেক্ষায়', 'গাড়ির তালিকায়', 'ডেলিভারি হয়েছে', 'বাতিল'];
// Truck sizes, smallest first: bags of 50 kg.
var TRUCKS = [
  { bags: 60, label: '৩ টনের গাড়ি' },
  { bags: 100, label: '৫ টনের গাড়ি' },
  { bags: 200, label: '১০ টনের গাড়ি' },
  { bags: 300, label: '১৫ টনের গাড়ি' }
];
var COURIER_NAME = 'কুরিয়ার';
var COURIER_HEADERS = ['অর্ডার নম্বর', 'তারিখ', 'নাম', 'মোবাইল', 'বিকল্প নম্বর', 'জেলা', 'উপজেলা', 'সুন্দরবন শাখা',
  'বস্তা', 'সাইলেজ (টাকা)', 'কুরিয়ার (টাকা)', 'মোট', 'ট্রাক দরকার', 'মাধ্যম', 'কিসের টাকা', 'TrxID', 'পাঠানো টাকা',
  'নোট', 'অবস্থা', 'CN নম্বর'];
var COURIER_STATUSES = ['নতুন', 'ফোন হয়েছে', 'টাকা মিলেছে', 'বুক হয়েছে', 'পৌঁছেছে', 'বাতিল'];
var COURIER_NEW = 'নতুন';
var COURIER_STATUS_COL = 19; // S
var HEADERS = ['সময়', 'নাম', 'মোবাইল', 'এলাকা', 'বস্তা', 'অতিরিক্ত তথ্য', 'পাতা', 'উৎস', 'মাধ্যম', 'অবস্থা', 'নোট (নিজের)'];

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return ok(); // honeypot: real farmers never see this field
    if (d.type === 'click') return logClick(d);
    if (d.form_type === 'silagebd_question') return logQuestion(d);

    var phone = toAsciiDigits(clip(d.phone, 30)).replace(/[^\d+]/g, '');
    var name = clip(d.name, 80);
    if (!name && !phone) return ok();

    // Advance booking (আগাম চাহিদা) form: same tab, মাধ্যম says so. The months, animals and
    // yearly answers arrive inside the note (and as d.months, d.animals, d.yearly).
    var booking = d.form_type === 'advance_booking';
    var shared = d.form_type === 'shared_delivery';
    var callForm = d.form_type === 'call_form'; // the /form page linked from the WhatsApp auto-reply
    var courier = d.form_type === 'courier_order'; // the /courier page
    var order = courier ? logCourier(d, name, phone) : null; // gets the order number first
    var sheet = getSheet();
    sheet.appendRow([
      new Date(),
      name,
      "'" + phone, // keep the leading 0
      clip(d.location, 120),
      toAsciiDigits(clip(d.bags, 20)),
      (courier ? order.no + ' | ' : '') + clip(d.note, 500),
      clip(d.page, 200),
      clip(d.source, 80),
      courier ? 'কুরিয়ার' : booking ? 'আগাম চাহিদা' : (shared ? 'একসাথে ডেলিভারি' : (callForm ? 'ফর্ম (WhatsApp থেকে)' : 'ওয়েবসাইট ফর্ম')),
      'নতুন',
      ''
    ]);

    if (shared) logShared(d, name, phone);
    var to = ownerEmail();
    if (to) {
      if (courier) {
        MailApp.sendEmail(to, 'কুরিয়ার অর্ডার: ' + name + ' (' + order.district + ')', courierText(order) +
          '\nপাতা: ' + clip(d.page, 200) + '\nউৎস: ' + clip(d.source, 80) +
          '\n\nশিট: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
      } else {
        MailApp.sendEmail(to, (d.site === 'compost' ? 'কম্পোস্ট: ' : '') + (booking ? 'আগাম চাহিদা: ' : (shared ? 'একসাথে ডেলিভারি: ' : (callForm ? 'ফোনের অনুরোধ: ' : 'নতুন লিড: '))) + name + ' (' + clip(d.location, 40) + ')',
          'নাম: ' + name + '\nমোবাইল: ' + phone + '\nএলাকা: ' + clip(d.location, 120) +
          '\nবস্তা: ' + clip(d.bags, 20) + '\nতথ্য: ' + clip(d.note, 500) +
          '\nপাতা: ' + clip(d.page, 200) + '\nউৎস: ' + clip(d.source, 80) +
          '\n\nশিট: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
      }
    }
    // Telegram last, so a Telegram problem can never lose the lead or the email.
    if (courier) telegramCourier(order);
    else telegramLead(d, name, phone, booking ? '<b>আগাম চাহিদা</b>' : (shared ? '<b>একসাথে ডেলিভারি</b>' : (callForm ? '📞 <b>ফোনের অনুরোধ / হিসাব</b>' : '<b>নতুন লিড</b>')), callForm ? 'CALL' : 'OTHER');
  } catch (err) {
    console.error(err);
  }
  return ok();
}

// Opening the /exec URL in a browser shows this, a quick "is it live" check.
function doGet() {
  return ContentService.createTextOutput('Khamarvest lead inbox is live.');
}

function logClick(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CLICKS_NAME) || ss.insertSheet(CLICKS_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CLICK_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, CLICK_HEADERS.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  }
  sheet.appendRow([
    new Date(),
    d.channel === 'call' ? 'ফোন কল' : 'WhatsApp',
    clip(d.title, 100),
    clip(d.page, 200),
    clip(d.button, 60),
    clip(d.source, 80),
    clip(d.device, 20),
    clip(d.number, 20)
  ]);
  return ok();
}

// silagebd.com question box: own tab, own email. Rejects empty or oversize text.
var QUESTIONS_NAME = 'SilageBD প্রশ্ন';
var QUESTION_HEADERS = ['তারিখ', 'প্রশ্ন', 'জেলা', 'মোবাইল', 'পেজ', 'গাইড', 'উৎস', 'অবস্থা'];

function logQuestion(d) {
  var question = clip(d.question, 100000);
  if (question.length < 10 || question.length > 1000) return ok();
  var district = clip(d.district, 60);
  var phone = toAsciiDigits(clip(d.phone, 20)).replace(/[^\d+]/g, '');
  var page = clip(d.page, 200);
  var source = clip(d.ai_source, 40) || clip(d.referrer_host, 80) || clip(d.source, 80) || 'direct';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(QUESTIONS_NAME) || ss.insertSheet(QUESTIONS_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(QUESTION_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, QUESTION_HEADERS.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
    sheet.getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(['নতুন', 'উত্তর দেওয়া হয়েছে', 'প্রশ্নোত্তর পেজে গেছে', 'বাদ'], true).build());
  }
  sheet.appendRow([new Date(), question, district, "'" + phone, page, clip(d.guide_slug, 100), source, 'নতুন']);
  var to = ownerEmail();
  if (to) {
    var body = 'প্রশ্ন:\n' + question + '\n\nজেলা: ' + (district || '(দেননি)') + '\nপেজ: ' + page + '\nউৎস: ' + source;
    if (phone) {
      var n = phone.replace(/\D/g, '');
      if (n.indexOf('88') !== 0) n = '88' + n;
      var msg = 'আসসালামু আলাইকুম, SilageBD-তে আপনি একটা প্রশ্ন পাঠিয়েছিলেন। এখন কি উত্তরটা জানানো যাবে?';
      body += '\nমোবাইল: ' + phone + '\n\nWhatsApp-এ উত্তর দিতে: https://wa.me/' + n + '?text=' + encodeURIComponent(msg);
    } else {
      body += '\nমোবাইল: (দেননি, তাই শুধু প্রশ্নোত্তর পেজের জন্য)';
    }
    body += '\n\nশিট: ' + ss.getUrl();
    MailApp.sendEmail(to, 'SilageBD: নতুন প্রশ্ন (' + (district || 'জেলা জানা নেই') + ')', body);
  }
  return ok();
}

// ---- Shared delivery pool ----

function sharedSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHARED_NAME) || ss.insertSheet(SHARED_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHARED_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, SHARED_HEADERS.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
    sheet.getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(SHARED_STATUSES, true).build());
  }
  return sheet;
}

function logShared(d, name, phone) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var district = clip(d.district, 60) || clip(d.location, 60) || '(জেলা জানা নেই)';
    var bags = parseInt(toAsciiDigits(clip(d.bags, 10)).replace(/\D/g, ''), 10) || 0;
    sharedSheet().appendRow([new Date(), name, "'" + phone, district, clip(d.upazila, 60), bags,
      clip(d.when, 30) || 'যেকোনো সময়', SHARED_PENDING]);
    checkTruckAlert(district);
  } finally {
    lock.releaseLock();
  }
}

// Pending sign-ups grouped by district: { district: { bags, rows: [...] } }.
function pendingPool() {
  var pool = {};
  dataRows(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHARED_NAME)).forEach(function (r) {
    if (r[7] !== SHARED_PENDING) return;
    var key = String(r[3] || '(জেলা জানা নেই)').trim();
    pool[key] = pool[key] || { bags: 0, rows: [] };
    pool[key].bags += Number(r[5]) || 0;
    pool[key].rows.push(r);
  });
  return pool;
}

// Index of the biggest truck the total fills, -1 if none.
function truckIndex(bags) {
  var idx = -1;
  TRUCKS.forEach(function (t, i) { if (bags >= t.bags) idx = i; });
  return idx;
}

// Next truck size not yet filled: { label, need } or null above the biggest.
function nextTruck(bags) {
  for (var i = 0; i < TRUCKS.length; i++) {
    if (bags < TRUCKS[i].bags) return { label: TRUCKS[i].label, size: TRUCKS[i].bags, need: TRUCKS[i].bags - bags };
  }
  return null;
}

// Emails once when a district's waiting total crosses a truck size it had not
// crossed before. The last alerted level is kept per district; when the total
// falls (owner marked orders done) the level drops with it, so the next
// crossing alerts again.
function checkTruckAlert(district) {
  var props = PropertiesService.getScriptProperties();
  var key = 'truck:' + district;
  var pool = pendingPool()[district] || { bags: 0, rows: [] };
  var now = truckIndex(pool.bags);
  var was = parseInt(props.getProperty(key) || '-1', 10);
  if (now < was) { props.setProperty(key, String(now)); return; }
  if (now === was) return;
  props.setProperty(key, String(now));
  var to = ownerEmail();
  if (!to) return;
  var t = TRUCKS[now];
  var line = district + ': ' + pool.rows.length + ' জন খামারির ' + bn(pool.bags) + ' বস্তা জমেছে। ' +
    t.label + ' (' + bn(t.bags) + ' বস্তা) ভরার মতো।';
  var nx = nextTruck(pool.bags);
  if (nx) line += ' ' + nx.label + ' (' + bn(nx.size) + ') ভরতে আর ' + bn(nx.need) + ' বস্তা লাগবে।';
  var body = [line, '', 'খামারিদের তালিকা:'];
  pool.rows.forEach(function (r) {
    body.push('  - ' + r[1] + ', ' + r[2] + ', ' + (r[4] || 'উপজেলা দেননি') + ', ' + bn(Number(r[5]) || 0) + ' বস্তা, ' + r[6]);
  });
  body.push('', 'গাড়ি ঠিক হলে "একসাথে ডেলিভারি" ট্যাবে এদের অবস্থা বদলে দিন, তাহলে এই জেলার হিসাব আবার শূন্য থেকে শুরু হবে।',
    '', 'শিট: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
  MailApp.sendEmail(to, 'একসাথে ডেলিভারি: ' + district + ', ' + bn(pool.bags) + ' বস্তা জমেছে', body.join('\n'));
}

// Called from the daily digest: lowers stored levels for districts whose
// waiting total fell since (rows marked done by hand), so alerts re-arm.
function resyncTruckLevels() {
  var props = PropertiesService.getScriptProperties();
  var pool = pendingPool();
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('truck:') !== 0) return;
    var cur = pool[k.slice(6)] ? truckIndex(pool[k.slice(6)].bags) : -1;
    if (cur < parseInt(all[k], 10)) props.setProperty(k, String(cur));
  });
}

// Digest section: per district, bags waiting, farmers, next truck.
function sharedDigestLines() {
  var pool = pendingPool();
  var keys = Object.keys(pool).sort(function (a, b) { return pool[b].bags - pool[a].bags; });
  if (!keys.length) return [];
  var lines = ['একসাথে ডেলিভারি, অপেক্ষায় থাকা:'];
  keys.forEach(function (k) {
    var p = pool[k];
    var nx = nextTruck(p.bags);
    var tail = nx ? 'পরের গাড়ি ' + nx.label + ' (' + bn(nx.size) + ' বস্তা), আর ' + bn(nx.need) + ' বস্তা লাগবে' : 'সবচেয়ে বড় গাড়িও ভরার মতো';
    lines.push('  - ' + k + ': ' + bn(p.bags) + ' বস্তা, ' + bn(p.rows.length) + ' জন। ' + tail);
  });
  lines.push('');
  return lines;
}

function bn(n) {
  return String(n).replace(/\d/g, function (c) { return String.fromCharCode(0x09E6 + Number(c)); });
}

function ownerEmail() {
  if (NOTIFY_EMAIL === 'off') return '';
  if (NOTIFY_EMAIL) return NOTIFY_EMAIL;
  // Preferred: Project Settings > Script properties > NOTIFY_EMAIL = your Gmail.
  // Keeps the address out of this public file and needs no extra permission.
  var prop = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (prop) return prop.trim();
  // Needs the "see your email address" permission; if it was not granted,
  // skip the email instead of crashing the whole request.
  try { return Session.getEffectiveUser().getEmail(); } catch (e) { console.error(e); return ''; }
}

// Run once from the editor (step 3). Safe to run again: it replaces its trigger.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyDigest').timeBased().everyDays(1).atHour(DIGEST_HOUR).inTimezone(TZ).create();
  getSheet();
  sharedSheet();
  courierSheet();
  dailyDigest(true);
}

// Every morning: who still has not been called, and what the site did in the
// last 24 hours. Skipped on a day with nothing to report.
function dailyDigest(force) {
  var to = ownerEmail();
  if (!to) return;
  resyncTruckLevels();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var since = new Date(Date.now() - 24 * 3600 * 1000);
  var leads = dataRows(ss.getSheetByName(SHEET_NAME));
  var clicks = dataRows(ss.getSheetByName(CLICKS_NAME));
  var fresh = leads.filter(function (r) { return r[0] instanceof Date && r[0] >= since; });
  var waiting = leads.filter(function (r) { return r[9] === 'নতুন'; });
  var dayClicks = clicks.filter(function (r) { return r[0] instanceof Date && r[0] >= since; });
  var sharedLines = sharedDigestLines();
  var newCourier = dataRows(ss.getSheetByName(COURIER_NAME)).filter(function (r) { return r[COURIER_STATUS_COL - 1] === COURIER_NEW; });
  if (force !== true && !fresh.length && !waiting.length && !dayClicks.length && !sharedLines.length && !newCourier.length) return;

  var wa = dayClicks.filter(function (r) { return r[1] === 'WhatsApp'; }).length;
  var lines = [
    'গত ২৪ ঘণ্টা: ' + fresh.length + 'টি নতুন লিড (ফর্ম), ' + wa + ' বার WhatsApp, ' + (dayClicks.length - wa) + ' বার কল বোতামে ট্যাপ।',
    ''
  ];
  if (waiting.length) {
    lines.push('এখনো ফোন করা হয়নি (' + waiting.length + 'জন), অবস্থা "নতুন":');
    waiting.slice(0, 40).forEach(function (r) {
      lines.push('  - ' + r[1] + ', ' + r[2] + ', ' + r[3] + (r[4] ? ', ' + r[4] + ' বস্তা' : '') + ' (' + Utilities.formatDate(r[0], TZ, 'dd/MM HH:mm') + ')');
    });
    lines.push('ফোন করার পর শিটে "অবস্থা" বদলে দিন, তাহলে কাল আর এই তালিকায় আসবে না।', '');
  }
  if (newCourier.length) {
    lines.push('কুরিয়ার অর্ডার, অবস্থা "নতুন" (' + newCourier.length + 'টি):');
    newCourier.slice(0, 30).forEach(function (r) {
      lines.push('  - ' + r[0] + ': ' + r[2] + ', ' + r[3] + ', ' + r[5] + ', ' + r[8] + ' বস্তা' + (r[12] === 'হ্যাঁ' ? ' (ট্রাক)' : ''));
    });
    lines.push('');
  }
  if (sharedLines.length) sharedLines.forEach(function (l) { lines.push(l); });
  if (dayClicks.length) {
    lines.push('কোন পাতা থেকে বেশি ট্যাপ:');
    top(dayClicks, 2, 5).forEach(function (t) { lines.push('  - ' + t[0] + ': ' + t[1]); });
    lines.push('', 'কোথা থেকে এসেছেন:');
    top(dayClicks, 5, 5).forEach(function (t) { lines.push('  - ' + t[0] + ': ' + t[1]); });
  }
  var qs = dataRows(ss.getSheetByName(QUESTIONS_NAME)).filter(function (r) { return r[7] === 'নতুন'; });
  if (qs.length) lines.push('', 'SilageBD প্রশ্ন: ' + qs.length);
  lines.push('', 'শিট: ' + ss.getUrl());
  MailApp.sendEmail(to, 'খামারভেস্ট লিড: ' + fresh.length + ' নতুন, ' + waiting.length + ' জনকে ফোন বাকি', lines.join('\n'));
}

function dataRows(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function top(rows, col, n) {
  var c = {};
  rows.forEach(function (r) { var k = String(r[col] || '(জানা নেই)'); c[k] = (c[k] || 0) + 1; });
  return Object.keys(c).map(function (k) { return [k, c[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; }).slice(0, n);
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
    var status = SpreadsheetApp.newDataValidation()
      .requireValueInList(['নতুন', 'কল করা হয়েছে', 'দাম জানানো হয়েছে', 'অর্ডার হয়েছে', 'ডেলিভারি হয়েছে', 'বাতিল'], true).build();
    sheet.getRange('J2:J').setDataValidation(status);
    var source = SpreadsheetApp.newDataValidation()
      .requireValueInList(['ওয়েবসাইট ফর্ম', 'WhatsApp', 'ফোন কল', 'Facebook', 'আগাম চাহিদা', 'একসাথে ডেলিভারি', 'কুরিয়ার', 'অন্যান্য'], true).build();
    sheet.getRange('I2:I').setDataValidation(source);
  }
  return sheet;
}


// ---- Courier orders (/courier) ----

function courierSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(COURIER_NAME) || ss.insertSheet(COURIER_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COURIER_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, COURIER_HEADERS.length).setFontWeight('bold');
    sheet.getRange('B:B').setNumberFormat('dd/MM/yyyy HH:mm');
  }
  sheet.getRange(2, COURIER_STATUS_COL, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(COURIER_STATUSES, true).build());
  return sheet;
}

function pad4(n) { return ('0000' + n).slice(-4); }

// Appends the courier row and returns the order object. The sequence number lives in a
// Script property, guarded by a lock, and is never lower than the tab's row count.
function logCourier(d, name, phone) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = courierSheet();
    var props = PropertiesService.getScriptProperties();
    var seq = Math.max(parseInt(props.getProperty('COURIER_SEQ') || '0', 10), Math.max(sheet.getLastRow() - 1, 0)) + 1;
    props.setProperty('COURIER_SEQ', String(seq));
    var o = {
      no: 'KV-C-' + pad4(seq),
      date: new Date(),
      name: name,
      phone: phone,
      alt: toAsciiDigits(clip(d.alt_phone, 30)).replace(/[^\d+]/g, ''),
      district: clip(d.district, 60),
      upazila: clip(d.upazila, 80),
      branch: clip(d.branch, 120),
      bags: parseInt(toAsciiDigits(clip(d.bags, 10)).replace(/\D/g, ''), 10) || 0,
      silage: Number(d.silage_amount) || 0,
      fee: Number(d.courier_amount) || 0,
      total: Number(d.total) || 0,
      truck: d.truck_mode === true || d.truck_mode === 'true',
      svc: clip(d.service, 20),
      paytype: clip(d.pay_type, 40),
      trx: clip(d.trx_id, 30),
      sent: Number(d.amount_sent) || 0,
      note: clip(d.note, 600)
    };
    sheet.appendRow([o.no, o.date, o.name, "'" + o.phone, o.alt ? "'" + o.alt : '', o.district, o.upazila, o.branch,
      o.bags, o.silage, o.fee, o.total, o.truck ? 'হ্যাঁ' : 'না', o.svc, o.paytype, o.trx, o.sent || '',
      o.note, COURIER_NEW, '']);
    return o;
  } finally {
    lock.releaseLock();
  }
}

function courierFromRow(r) {
  return {
    no: String(r[0]), date: r[1], name: String(r[2]), phone: String(r[3]).replace(/^'/, ''), alt: String(r[4] || '').replace(/^'/, ''),
    district: String(r[5]), upazila: String(r[6]), branch: String(r[7]), bags: Number(r[8]) || 0,
    silage: Number(r[9]) || 0, fee: Number(r[10]) || 0, total: Number(r[11]) || 0, truck: r[12] === 'হ্যাঁ',
    svc: String(r[13] || ''), paytype: String(r[14] || ''), trx: String(r[15] || ''), sent: Number(r[16]) || 0, note: String(r[17] || '')
  };
}

function findCourier(no) {
  var rows = dataRows(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COURIER_NAME));
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === no) return courierFromRow(rows[i]);
  return null;
}

function payLine(o) {
  if (!o.trx) return 'কুরিয়ার খরচ এখনো পাঠাননি';
  return o.svc + (o.paytype ? ' (' + o.paytype + ')' : '') + (o.sent ? ' ' + bn(o.sent) + ' টাকা' : '') + ' পাঠিয়েছেন, TrxID ' + o.trx;
}

function amountLine(o) {
  if (o.truck) return bn(o.bags) + ' বস্তা, ৫ টন বা বেশি: ট্রাকে পাঠাতে হবে, ফোন করুন';
  return bn(o.bags) + ' বস্তা, সাইলেজ ' + bn(o.silage) + ' + কুরিয়ার ' + bn(o.fee) + ' = মোট ' + bn(o.total) + ' টাকা';
}

// Plain text, for the owner email.
function courierText(o) {
  return ['অর্ডার: ' + o.no, 'নাম: ' + o.name, 'মোবাইল: ' + o.phone + (o.alt ? ' (বিকল্প ' + o.alt + ')' : ''),
    'জেলা: ' + o.district, 'উপজেলা: ' + o.upazila, 'সুন্দরবন শাখা: ' + o.branch, amountLine(o), 'পেমেন্ট: ' + payLine(o),
    'নোট: ' + o.note].join('\n');
}

// ---- Telegram (config only from Script properties; sends only, never reads updates) ----

function esc(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tgConfig() {
  var p = PropertiesService.getScriptProperties();
  var token = (p.getProperty('TG_TOKEN') || '').trim(), chat = (p.getProperty('TG_CHAT_ID') || '').trim();
  if (!token || !chat) return null;
  return { token: token, chat: chat, props: p };
}

function tgTopic(cfg, key) {
  var t = (cfg.props.getProperty('TG_TOPIC_' + key) || '').trim();
  return t ? parseInt(t, 10) : 0;
}

// buttons: [[{text, url}, ...], ...]. URL buttons only, no callback_data.
// Returns true when Telegram accepted it. Never throws.
function tgSend(text, topicKey, buttons) {
  try {
    var cfg = tgConfig();
    if (!cfg) return false;
    var payload = { chat_id: cfg.chat, text: text, parse_mode: 'HTML', disable_web_page_preview: true };
    var thread = tgTopic(cfg, topicKey);
    if (thread) payload.message_thread_id = thread;
    if (buttons && buttons.length) payload.reply_markup = { inline_keyboard: buttons };
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) { console.error('tgSend ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300)); return false; }
    return true;
  } catch (err) {
    console.error('tgSend: ' + err);
    return false;
  }
}

function sheetUrl() { return SpreadsheetApp.getActiveSpreadsheet().getUrl(); }

// Phone as 8801XXXXXXXXX, or '' when it is not a Bangladeshi mobile. Accepts 01712345678,
// 1712345678, 8801712345678, +8801712345678, 008801712345678, "+88 017-1234-5678", Bengali digits.
function normBd(p) {
  var n = toAsciiDigits(String(p || '')).replace(/\D/g, '');
  if (n.indexOf('00') === 0) n = n.slice(2);
  if (n.indexOf('880') === 0) { /* keep */ }
  else if (n.charAt(0) === '0') n = '88' + n;
  else if (n.length === 10 && n.charAt(0) === '1') n = '880' + n;
  return /^8801[3-9]\d{8}$/.test(n) ? n : '';
}

// Run from the editor: logs sample inputs and what they become.
function phoneTest() {
  ['01712345678', '1712345678', '8801712345678', '+8801712345678', '008801712345678', '+88 017-1234-5678',
    '০১৭১২৩৪৫৬৭৮', '(017) 1234.5678', '12345', '01212345678'].forEach(function (x) {
    Logger.log(x + ' -> ' + (normBd(x) ? '+' + normBd(x) : '(invalid, shown as typed)'));
  });
}

// Plain text (never inside <b>/<code>/a link) so Telegram offers tap-to-call.
function phoneLine(p, label) {
  var n = normBd(p);
  return (label ? label + ': ' : '') + (n ? '+' + n : esc(p));
}

function waButton(phone, text) {
  var n = normBd(phone);
  return n ? { text: '💬 WhatsApp', url: 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) } : null;
}

function fmtMoney(n) {
  var s = String(Math.round(Number(n) || 0)), o = '';
  while (s.length > 3) { o = ',' + s.slice(-3) + o; s = s.slice(0, -3); }
  return bn(s + o);
}

var BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

// "২৩ নভেম্বর, রাত ১১:১৭"
function bnWhen(date) {
  var d = date instanceof Date ? date : new Date();
  var day = Number(Utilities.formatDate(d, TZ, 'd')), mon = Number(Utilities.formatDate(d, TZ, 'M')) - 1;
  var h = Number(Utilities.formatDate(d, TZ, 'H')), m = Utilities.formatDate(d, TZ, 'mm');
  var part = h < 4 ? 'রাত' : h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 17 ? 'বিকাল' : h < 19 ? 'সন্ধ্যা' : 'রাত';
  var h12 = h % 12 === 0 ? 12 : h % 12;
  return bn(day) + ' ' + BN_MONTHS[mon] + ', ' + part + ' ' + bn(h12) + ':' + bn(m);
}

// Blocks of lines, blank line between blocks, empty blocks and lines dropped.
function tgJoin(blocks) {
  return blocks.map(function (b) { return b.filter(Boolean).join('\n'); }).filter(Boolean).join('\n\n');
}

function courierMessage(o, sample) {
  var head = '🚚 <b>নতুন কুরিয়ার অর্ডার</b>  #' + esc(o.no);
  var money = o.truck
    ? '<b>৫ টন বা বেশি</b>: মিনি ট্রাকে পাঠাতে হবে, ফোন করুন'
    : 'সাইলেজ ' + fmtMoney(o.silage) + ' + কুরিয়ার ' + fmtMoney(o.fee) + ' = <b>' + fmtMoney(o.total) + ' টাকা</b>';
  var pay = o.trx ? ['পেমেন্ট: ' + esc([o.svc, o.paytype, o.sent ? fmtMoney(o.sent) + ' টাকা' : ''].filter(Boolean).join(' · ')),
    'TrxID: <b>' + esc(o.trx) + '</b>'] : [];
  var note = o.note && o.note.indexOf(' | ') === -1 ? 'নোট: ' + esc(o.note) : ''; // the web form's note is a generated summary
  return tgJoin([
    sample ? ['<i>নমুনা (আসল অর্ডার নয়)</i>'] : [],
    [head],
    ['<b>' + esc(o.name) + '</b>', phoneLine(o.phone), o.alt ? phoneLine(o.alt, 'বিকল্প') : ''],
    [esc([o.upazila, o.district].filter(Boolean).join(', ')), 'শাখা: <b>' + esc(o.branch) + '</b>'],
    ['<b>' + bn(o.bags) + ' বস্তা</b> (' + bn(o.bags * 50) + ' কেজি)', money],
    pay,
    [note, bnWhen(o.date)]
  ]);
}

// Message for every non-courier form lead. d = the posted fields.
function leadMessage(d, name, phone, label) {
  var compost = d.site === 'compost';
  var head = compost ? '🌱 <b>কম্পোস্ট লিড</b>' : label;
  var note = clip(d.note, 400);
  var noteLines = [];
  if (compost) note = note.replace(/^সাইট:\s*কম্পোস্ট[\s|:,.\-]*/, '');
  if (note.indexOf(' | ') > -1) {
    note.split(' | ').slice(1).forEach(function (part) { if (part.trim()) noteLines.push(esc(part.trim())); });
  } else if (note) {
    noteLines.push('নোট: ' + esc(note));
  }
  var bags = toAsciiDigits(clip(d.bags, 20));
  return tgJoin([
    [head],
    ['<b>' + esc(name || 'নাম দেননি') + '</b>', phone ? phoneLine(phone) : ''],
    [clip(d.location, 120) ? esc(clip(d.location, 120)) : '', bags ? '<b>' + esc(/^\d+$/.test(bags) ? bn(bags) + ' বস্তা' : bags) + '</b>' : ''],
    noteLines,
    [bnWhen(new Date())]
  ]);
}

function telegramLead(d, name, phone, label, topicKey) {
  try {
    if (!tgConfig()) return;
    var row1 = [];
    var wa = waButton(phone, 'আসসালামু আলাইকুম, খামারভেস্ট থেকে বলছি। আপনার অনুরোধ পেয়েছি।');
    if (wa) row1.push(wa);
    var kb = [];
    if (row1.length) kb.push(row1);
    kb.push([{ text: '📊 শিট', url: sheetUrl() }]);
    tgSend(leadMessage(d, name, phone, label), topicKey, kb);
  } catch (err) { console.error('telegramLead: ' + err); }
}

function telegramCourier(o) {
  try {
    if (!tgConfig()) return;
    var row1 = [];
    var wa = waButton(o.phone, 'আসসালামু আলাইকুম, খামারভেস্ট থেকে বলছি। আপনার কুরিয়ার অর্ডার #' + o.no + ' পেয়েছি।');
    if (wa) row1.push(wa);
    var kb = [];
    if (row1.length) kb.push(row1);
    kb.push([{ text: '📊 শিট', url: sheetUrl() }]);
    tgSend(courierMessage(o, false), 'COURIER', kb);
  } catch (err) { console.error('telegramCourier: ' + err); }
}

// Run from the editor to check the bot, chat and topics: a sample courier message to the
// courier topic (marked "নমুনা", nothing is saved) and one line to the other topics.
function tgTest() {
  var sample = { no: 'KV-C-0007', date: new Date(), name: 'আব্দুল করিম', phone: '01712345678', alt: '01811111111',
    district: 'সিরাজগঞ্জ', upazila: 'উল্লাপাড়া', branch: 'উল্লাপাড়া বাসস্ট্যান্ড', bags: 13, silage: 6175, fee: 3900, total: 10075,
    truck: false, svc: 'বিকাশ', paytype: 'কুরিয়ার খরচ', trx: '9A7K3XQ2LM', sent: 3900, note: '' };
  Logger.log('COURIER: ' + tgSend(courierMessage(sample, true), 'COURIER', [[{ text: '📊 শিট', url: sheetUrl() }]]));
  ['CALL', 'OTHER'].forEach(function (k) {
    Logger.log(k + ': ' + tgSend('✅ খামারভেস্ট লিড বট: সংযোগ ঠিক আছে (' + k + ')', k, null));
  });
}

function clip(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}

function toAsciiDigits(s) {
  return s.replace(/[০-৯]/g, function (c) { return String(c.charCodeAt(0) - 0x09E6); });
}

function ok() {
  return ContentService.createTextOutput('ok');
}

// Run from the editor when tgTest() fails: logs which bot the token belongs to
// and the chats it has recently been added to (with their real chat ids).
// Never logs the token. getUpdates only works for a bot without a webhook.
function tgDiagnose() {
  var token = (PropertiesService.getScriptProperties().getProperty('TG_TOKEN') || '').trim();
  if (!token) { Logger.log('TG_TOKEN নেই'); return; }
  var api = 'https://api.telegram.org/bot' + token + '/';
  var me = JSON.parse(UrlFetchApp.fetch(api + 'getMe', { muteHttpExceptions: true }).getContentText());
  Logger.log('বট: ' + (me.ok ? '@' + me.result.username : JSON.stringify(me)));
  var up = JSON.parse(UrlFetchApp.fetch(api + 'getUpdates', { muteHttpExceptions: true }).getContentText());
  if (!up.ok) { Logger.log('getUpdates: ' + up.description); return; }
  var seen = {};
  up.result.forEach(function (u) {
    var m = u.message || u.my_chat_member || u.channel_post || u.edited_message;
    if (m && m.chat && !seen[m.chat.id]) { seen[m.chat.id] = 1; Logger.log('চ্যাট: ' + m.chat.id + ' · ' + (m.chat.title || m.chat.type)); }
  });
  if (!Object.keys(seen).length) Logger.log('কোনো চ্যাট পাওয়া যায়নি: গ্রুপে একটা মেসেজ দিন, তারপর আবার চালান');
}
