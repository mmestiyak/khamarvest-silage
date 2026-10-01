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
// Version: New version, so the same /exec URL keeps working.
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
var HEADERS = ['সময়', 'নাম', 'মোবাইল', 'এলাকা', 'বস্তা', 'অতিরিক্ত তথ্য', 'পাতা', 'উৎস', 'মাধ্যম', 'অবস্থা', 'নোট (নিজের)'];

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return ok(); // honeypot: real farmers never see this field
    if (d.type === 'click') return logClick(d);

    var phone = toAsciiDigits(clip(d.phone, 30)).replace(/[^\d+]/g, '');
    var name = clip(d.name, 80);
    if (!name && !phone) return ok();

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
      'ওয়েবসাইট ফর্ম',
      'নতুন',
      ''
    ]);

    var to = ownerEmail();
    if (to) {
      MailApp.sendEmail(to, 'নতুন লিড: ' + name + ' (' + clip(d.location, 40) + ')',
        'নাম: ' + name + '\nমোবাইল: ' + phone + '\nএলাকা: ' + clip(d.location, 120) +
        '\nবস্তা: ' + clip(d.bags, 20) + '\nতথ্য: ' + clip(d.note, 500) +
        '\nপাতা: ' + clip(d.page, 200) + '\nউৎস: ' + clip(d.source, 80) +
        '\n\nশিট: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    }
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
  dailyDigest(true);
}

// Every morning: who still has not been called, and what the site did in the
// last 24 hours. Skipped on a day with nothing to report.
function dailyDigest(force) {
  var to = ownerEmail();
  if (!to) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var since = new Date(Date.now() - 24 * 3600 * 1000);
  var leads = dataRows(ss.getSheetByName(SHEET_NAME));
  var clicks = dataRows(ss.getSheetByName(CLICKS_NAME));
  var fresh = leads.filter(function (r) { return r[0] instanceof Date && r[0] >= since; });
  var waiting = leads.filter(function (r) { return r[9] === 'নতুন'; });
  var dayClicks = clicks.filter(function (r) { return r[0] instanceof Date && r[0] >= since; });
  if (force !== true && !fresh.length && !waiting.length && !dayClicks.length) return;

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
  if (dayClicks.length) {
    lines.push('কোন পাতা থেকে বেশি ট্যাপ:');
    top(dayClicks, 2, 5).forEach(function (t) { lines.push('  - ' + t[0] + ': ' + t[1]); });
    lines.push('', 'কোথা থেকে এসেছেন:');
    top(dayClicks, 5, 5).forEach(function (t) { lines.push('  - ' + t[0] + ': ' + t[1]); });
  }
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
      .requireValueInList(['ওয়েবসাইট ফর্ম', 'WhatsApp', 'ফোন কল', 'Facebook', 'অন্যান্য'], true).build();
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
