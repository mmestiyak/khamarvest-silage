// Lead inbox for silage.khamarvest.com: a Google Sheet, no server.
//
// One-time setup (5 minutes, owner's Google account):
//   1. Create a new Google Sheet, name it "Khamarvest Leads".
//   2. Extensions > Apps Script. Delete what is there, paste this whole file, Save.
//   3. Optional: put an email in NOTIFY_EMAIL below to get an email per lead.
//   4. Deploy > New deployment > type "Web app".
//        Execute as: Me.   Who has access: Anyone.
//      Authorise when asked, then copy the Web app URL (ends in /exec).
//   5. Paste that URL into LEADS_URL in js/leads.js, then `npm run verify` and push.
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
var NOTIFY_EMAIL = ''; // e.g. 'owner@example.com'; leave empty for no email
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

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, 'নতুন লিড: ' + name + ' (' + clip(d.location, 40) + ')',
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
