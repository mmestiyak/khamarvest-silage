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
    var sheet = getSheet();
    sheet.appendRow([
      new Date(),
      name,
      "'" + phone, // keep the leading 0
      clip(d.location, 120),
      toAsciiDigits(clip(d.bags, 20)),
      clip(d.note, 500),
      clip(d.page, 200),
      clip(d.source, 80),
      booking ? 'আগাম চাহিদা' : (shared ? 'একসাথে ডেলিভারি' : 'ওয়েবসাইট ফর্ম'),
      'নতুন',
      ''
    ]);

    var to = ownerEmail();
    if (to) {
      MailApp.sendEmail(to, (booking ? 'আগাম চাহিদা: ' : (shared ? 'একসাথে ডেলিভারি: ' : 'নতুন লিড: ')) + name + ' (' + clip(d.location, 40) + ')',
        'নাম: ' + name + '\nমোবাইল: ' + phone + '\nএলাকা: ' + clip(d.location, 120) +
        '\nবস্তা: ' + clip(d.bags, 20) + '\nতথ্য: ' + clip(d.note, 500) +
        '\nপাতা: ' + clip(d.page, 200) + '\nউৎস: ' + clip(d.source, 80) +
        '\n\nশিট: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    }
    if (shared) logShared(d, name, phone);
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
  return NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
}

// Run once from the editor (step 3). Safe to run again: it replaces its trigger.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyDigest').timeBased().everyDays(1).atHour(DIGEST_HOUR).inTimezone(TZ).create();
  getSheet();
  sharedSheet();
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
  if (force !== true && !fresh.length && !waiting.length && !dayClicks.length && !sharedLines.length) return;

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
      .requireValueInList(['ওয়েবসাইট ফর্ম', 'WhatsApp', 'ফোন কল', 'Facebook', 'আগাম চাহিদা', 'একসাথে ডেলিভারি', 'অন্যান্য'], true).build();
    sheet.getRange('I2:I').setDataValidation(source);
  }
  return sheet;
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
