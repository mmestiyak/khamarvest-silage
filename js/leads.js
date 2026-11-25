// Sends leads to the owner's Google Sheet (setup: scripts/leads-apps-script.gs).
//  - saveLead(fields): the homepage order form, before WhatsApp opens, so the
//    farmer's name and number survive even if WhatsApp never opens.
//  - every WhatsApp / call tap on any page goes to the sheet's "Clicks" tab with
//    the page, button and source. No phone number (the site never sees it),
//    but the owner can match a chat's time to the page that sent it.
//  - any <form data-lead-form> (the "নম্বর দিন, আমরা ফোন করব" box on district
//    pages): saves name, mobile, upazila and bags as a lead and shows a
//    confirmation. If the sheet is not set up, it falls back to WhatsApp.
//  - any <form data-booking-form>: the advance-booking (আগাম চাহিদা) form, below.
//  - any <form data-shared-delivery-form>: the shared-delivery (একসাথে ডেলিভারি) form, below.
//  - any <form data-call-form>: the /form page the owner links in the WhatsApp auto-reply, below.
// Homepage loads this directly; every other page gets it from /js/ga.js.
// Until LEADS_URL is filled in, nothing is sent.
(function () {
  if (window.saveLead) return;
  var LEADS_URL = 'https://script.google.com/macros/s/AKfycbwSc5OzLRgkDEU7lV0niQPe8R1g-BBAF_ZDz__A-ZI1MX5k46b0fzEhH-aR_xKhT-7_/exec';

  function source() {
    try {
      var ai = sessionStorage.getItem('ai_source');
      if (ai) return ai;
      var utm = new URLSearchParams(location.search).get('utm_source');
      if (utm) return utm;
      return document.referrer ? new URL(document.referrer).hostname : 'direct';
    } catch (e) { return ''; }
  }

  function send(fields) {
    if (!LEADS_URL) return false;
    var body = JSON.stringify(Object.assign({ page: location.pathname, source: source() }, fields));
    try {
      // text/plain keeps it a "simple" request (no CORS preflight), and
      // sendBeacon survives the tab switching away to WhatsApp.
      var blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
      if (navigator.sendBeacon && navigator.sendBeacon(LEADS_URL, blob)) return true;
      fetch(LEADS_URL, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body });
      return true;
    } catch (e) { return false; }
  }

  window.saveLead = function (fields) { return send(Object.assign({ type: 'lead' }, fields)); };

  // Same regions as link_location in /js/ga.js, so the sheet and GA4 agree.
  function locationOf(a) {
    var tagged = a.closest('[data-cta]');
    if (tagged) return tagged.getAttribute('data-cta');
    if (a.closest('header')) return 'header';
    if (a.closest('footer')) return 'footer';
    if (a.closest('aside')) return 'sidebar';
    if (a.closest('article')) return 'article_body';
    var h = a.closest('section') && a.closest('section').querySelector('h2');
    return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : 'page';
  }

  function toAscii(v) {
    return String(v || '').replace(/[০-৯]/g, function (c) { return String(c.charCodeAt(0) - 0x09E6); });
  }

  function bindForms() {
    document.querySelectorAll('form[data-lead-form]').forEach(function (f) {
      var phone = f.elements.phone;
      phone.addEventListener('input', function () { phone.setCustomValidity(''); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (toAscii(phone.value).replace(/\D/g, '').length < 11) {
          phone.setCustomValidity('১১ সংখ্যার মোবাইল নম্বর লিখুন, যেমন ০১৭১২৩৪৫৬৭৮');
          phone.reportValidity();
          return;
        }
        var v = function (n) { return f.elements[n] ? f.elements[n].value.trim() : ''; };
        var area = [v('upazila'), f.getAttribute('data-district')].filter(Boolean).join(', ');
        var saved = window.saveLead({
          name: v('name'), phone: v('phone'), location: area, bags: v('bags'),
          note: 'ফোন করতে বলেছেন' + (v('note') ? ': ' + v('note') : ''), website: v('website')
        });
        if (typeof window.gaEvent === 'function') window.gaEvent('order_details_submitted', { submission_method: saved ? 'callback' : 'whatsapp', page_path: location.pathname });
        if (saved) {
          f.querySelector('[data-lead-status]').hidden = false;
          f.querySelector('button[type="submit"]').disabled = true;
          return;
        }
        // Only filled fields: no blank labels. Ends with a question to reply to.
        var msg = ['আসসালামু আলাইকুম, আমি ভুট্টা সাইলেজ নিতে চাই।',
          v('name') ? 'নাম: ' + v('name') : '', v('phone') ? 'মোবাইল: ' + v('phone') : '',
          area ? 'এলাকা: ' + area : '', v('bags') ? 'বস্তা: ' + v('bags') : '',
          'দাম জানাবেন?'].filter(Boolean).join('\n');
        window.open('https://wa.me/8801334211984?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindForms);
  else bindForms();

  // "নতুন মৌসুমের সাইলেজ: আগে থেকে জানিয়ে রাখুন" (<form data-booking-form>):
  // saved like any lead but tagged form_type advance_booking, with the extra
  // answers also written into the note so an older deployed Apps Script, which
  // ignores unknown fields, still stores everything. Promises a call when the
  // new season's silage is ready, takes no payment, reserves no stock.
  function bindBookingForms() {
    document.querySelectorAll('form[data-booking-form]').forEach(function (f) {
      var phone = f.elements.phone;
      phone.addEventListener('input', function () { phone.setCustomValidity(''); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (toAscii(phone.value).replace(/\D/g, '').length < 11) {
          phone.setCustomValidity('১১ সংখ্যার মোবাইল নম্বর লিখুন, যেমন ০১৭১২৩৪৫৬৭৮');
          phone.reportValidity();
          return;
        }
        var v = function (n) { return f.elements[n] && f.elements[n].value ? f.elements[n].value.trim() : ''; };
        var yearly = !!(f.elements.yearly && f.elements.yearly.checked);
        var parts = ['আগাম চাহিদা (নতুন মৌসুম, তৈরি হলে আগে ফোন করবেন)'];
        var area = [v('district'), v('upazila')].filter(Boolean).join(', ');
        if (v('district')) parts.push('জেলা: ' + v('district'));
        if (v('upazila')) parts.push('উপজেলা: ' + v('upazila'));
        if (v('address')) parts.push('ঠিকানা: ' + v('address'));
        if (v('animals')) parts.push('গরু: ' + v('animals'));
        if (v('bags')) parts.push('মাসে বস্তা: ' + v('bags'));
        if (v('months')) parts.push('মাস: ' + v('months'));
        if (yearly) parts.push('সারা বছরের সাইলেজ পরিকল্পনায় রাখতে বলেছেন');
        if (v('note')) parts.push('নোট: ' + v('note'));
        var saved = window.saveLead({
          form_type: 'advance_booking', name: v('name'), phone: v('phone'), location: area, area: area,
          district: v('district'), upazila: v('upazila'), address: v('address'),
          bags: v('bags'), animals: v('animals'), months: v('months'), yearly: yearly,
          note: parts.join(' | '), website: v('website')
        });
        if (typeof window.gaEvent === 'function') window.gaEvent('order_details_submitted', { submission_method: saved ? 'advance_booking' : 'advance_booking_whatsapp', page_path: location.pathname });
        if (saved) {
          f.querySelector('[data-lead-status]').hidden = false;
          f.querySelector('button[type="submit"]').disabled = true;
          return;
        }
        var msg = ['আসসালামু আলাইকুম, নতুন মৌসুমের সাইলেজ তৈরি হলে আগে জানাবেন, আমি আগাম জানিয়ে রাখছি।',
          v('name') ? 'নাম: ' + v('name') : '', v('phone') ? 'মোবাইল: ' + v('phone') : '',
          v('district') ? 'জেলা: ' + v('district') : '', v('upazila') ? 'উপজেলা: ' + v('upazila') : '',
          v('address') ? 'ঠিকানা: ' + v('address') : '', v('animals') ? 'গরু: ' + v('animals') : '',
          v('bags') ? 'মাসে বস্তা: ' + v('bags') : '', v('months') ? 'কোন মাসে লাগবে: ' + v('months') : '',
          yearly ? 'সারা বছরের সাইলেজ পরিকল্পনায় রাখুন' : '', v('note') ? 'নোট: ' + v('note') : '',
          'তৈরি হলে আমাকে ফোন করবেন?'].filter(Boolean).join('\n');
        window.open('https://wa.me/8801334211984?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindBookingForms);
  else bindBookingForms();

  // "অল্প বস্তা? একসাথে ডেলিভারিতে যোগ দিন" (<form data-shared-delivery-form>):
  // tagged form_type shared_delivery; district, upazila, bags and when also go
  // into the note so an older deployed Apps Script still stores them. The owner
  // pools sign-ups per district and calls when a truck can be filled. No payment.
  function bindSharedDeliveryForms() {
    document.querySelectorAll('form[data-shared-delivery-form]').forEach(function (f) {
      var phone = f.elements.phone;
      phone.addEventListener('input', function () { phone.setCustomValidity(''); });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (toAscii(phone.value).replace(/\D/g, '').length < 11) {
          phone.setCustomValidity('১১ সংখ্যার মোবাইল নম্বর লিখুন, যেমন ০১৭১২৩৪৫৬৭৮');
          phone.reportValidity();
          return;
        }
        var v = function (n) { return f.elements[n] && f.elements[n].value ? f.elements[n].value.trim() : ''; };
        var bags = toAscii(v('bags')).replace(/\D/g, '');
        var parts = ['একসাথে ডেলিভারি (এলাকার অর্ডার জমলে ফোন করবেন)'];
        if (v('district')) parts.push('জেলা: ' + v('district'));
        if (v('upazila')) parts.push('উপজেলা: ' + v('upazila'));
        if (v('address')) parts.push('ঠিকানা: ' + v('address'));
        if (bags) parts.push('বস্তা: ' + bags);
        if (v('when')) parts.push('কবে লাগবে: ' + v('when'));
        var saved = window.saveLead({
          form_type: 'shared_delivery', name: v('name'), phone: v('phone'),
          location: [v('district'), v('upazila')].filter(Boolean).join(', '),
          district: v('district'), upazila: v('upazila'), address: v('address'), bags: bags, when: v('when'),
          note: parts.join(' | '), website: v('website')
        });
        if (typeof window.gaEvent === 'function') window.gaEvent('order_details_submitted', { submission_method: saved ? 'shared_delivery' : 'shared_delivery_whatsapp', page_path: location.pathname });
        if (saved) {
          f.querySelector('[data-lead-status]').hidden = false;
          f.querySelector('button[type="submit"]').disabled = true;
          return;
        }
        var msg = ['আসসালামু আলাইকুম, আমি একসাথে ডেলিভারিতে যোগ দিতে চাই।',
          v('name') ? 'নাম: ' + v('name') : '', v('phone') ? 'মোবাইল: ' + v('phone') : '',
          v('district') ? 'জেলা: ' + v('district') : '', v('upazila') ? 'উপজেলা: ' + v('upazila') : '',
          v('address') ? 'ঠিকানা: ' + v('address') : '', bags ? 'বস্তা: ' + bags : '', v('when') ? 'কবে লাগবে: ' + v('when') : '',
          'আমার এলাকায় গাড়ি গেলে জানাবেন?'].filter(Boolean).join('\n');
        window.open('https://wa.me/8801334211984?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindSharedDeliveryForms);
  else bindSharedDeliveryForms();


  // /form (<form data-call-form>): the short "we will call you" form linked from
  // the WhatsApp Business auto-reply. Only the mobile number is required; name,
  // district, upazila and the number of cattle are optional. Tagged form_type
  // call_form; the answers are also written into the note so an older deployed
  // Apps Script still stores everything.
  function bindCallForms() {
    document.querySelectorAll('form[data-call-form]').forEach(function (f) {
      var phone = f.elements.phone;
      phone.addEventListener('input', function () { phone.setCustomValidity(''); });
      // Live estimate under "কয়টা গরু আছে?": 10-15 kg a cow a day (owner's choice,
      // 2026-11-21: inside the published beef 10-20 / dairy 15-25 ranges, no cow
      // category asked) x 30 days / 50 kg bag = 6-9 bags a cow a month. Bag price is read from the page's <span data-bag-price>, which
      // set-price / build:calc keep current, so nothing here goes stale.
      var est = f.querySelector('[data-bag-estimate]');
      var range = '';
      // "২৫-৩৮ হাজার টাকা", "৮.৫-১১.৩ লাখ টাকা": a farmer reads a rounded sum at a glance.
      var money = function (a, b) {
        if (b >= 100000) { var l = function (x) { return bnNum(Math.round(x / 10000) / 10); }; return l(a) + '-' + l(b) + ' লাখ টাকা'; }
        if (b >= 10000) return bnNum(Math.round(a / 1000)) + '-' + bnNum(Math.round(b / 1000)) + ' হাজার টাকা';
        return bnNum(Math.round(a)) + '-' + bnNum(Math.round(b)) + ' টাকা';
      };
      var bnNum = function (n) { return n.toLocaleString('en-IN').replace(/\d/g, function (d) { return '০১২৩৪৫৬৭৮৯'[d]; }); };
      if (est && f.elements.cows) {
        f.elements.cows.addEventListener('input', function () {
          var n = parseInt(toAscii(f.elements.cows.value).replace(/\D/g, ''), 10);
          if (!n || n < 1 || n > 5000) { est.hidden = true; range = ''; return; }
          var lo = Math.ceil(n * 10 * 30 / 50), hi = Math.ceil(n * 15 * 30 / 50);
          range = lo + '-' + hi;
          var bp = document.querySelector('[data-bag-price]');
          var price = bp ? parseFloat(toAscii(bp.textContent).replace(/[^\d.]/g, '')) : 0;
          est.querySelector('[data-bag-range]').textContent = 'মাসে আনুমানিক ' + bnNum(lo) + '-' + bnNum(hi) + ' বস্তা';
          est.querySelector('[data-bag-cost]').textContent = (price ? 'দাম প্রায় ' + money(lo * price, hi * price) + ', পরিবহন আলাদা। ' : '') + 'গরুপ্রতি দিনে ১০-১৫ কেজি ধরে।';
          est.hidden = false;
        });
      }
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (toAscii(phone.value).replace(/\D/g, '').length < 11) {
          phone.setCustomValidity('১১ সংখ্যার মোবাইল নম্বর লিখুন, যেমন ০১৭১২৩৪৫৬৭৮');
          phone.reportValidity();
          return;
        }
        var v = function (n) { return f.elements[n] && f.elements[n].value ? f.elements[n].value.trim() : ''; };
        var cows = toAscii(v('cows')).replace(/\D/g, '');
        var animals = cows && parseInt(cows, 10) > 0 ? 'গরু ' + cows : '';
        var loc = [v('district'), v('upazila')].filter(Boolean).join(', ');
        var parts = ['ফোনের অনুরোধ (WhatsApp থেকে ফর্ম)'];
        if (loc) parts.push('এলাকা: ' + loc);
        if (v('address')) parts.push('ঠিকানা: ' + v('address'));
        if (animals) parts.push('পশু: ' + animals);
        if (animals && range) parts.push('আনুমানিক মাসে বস্তা: ' + range);
        if (v('note')) parts.push('নোট: ' + v('note'));
        var saved = window.saveLead({
          form_type: 'call_form', name: v('name'), phone: v('phone'), location: loc, address: v('address'),
          animals: animals, note: parts.join(' | '), website: v('website')
        });
        if (typeof window.gaEvent === 'function') window.gaEvent('order_details_submitted', { submission_method: saved ? 'call_form' : 'call_form_whatsapp', page_path: location.pathname });
        if (saved) {
          var done = document.querySelector('[data-call-done]');
          f.hidden = true;
          if (done) { done.hidden = false; done.scrollIntoView({ block: 'start' }); done.focus(); }
          return;
        }
        var msg = ['আসসালামু আলাইকুম, আমি ভুট্টা সাইলেজ নিতে চাই।',
          v('name') ? 'নাম: ' + v('name') : '', 'মোবাইল: ' + v('phone'),
          loc ? 'এলাকা: ' + loc : '', animals ? 'পশু: ' + animals : '', v('note') ? 'নোট: ' + v('note') : '',
          'আমাকে ফোন করবেন?'].filter(Boolean).join('\n');
        window.open('https://wa.me/8801334211984?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindCallForms);
  else bindCallForms();

  var last = '', lastAt = 0;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me/"], a[href^="tel:"]');
    if (!a) return;
    var kind = a.href.indexOf('tel:') === 0 ? 'call' : 'whatsapp';
    var key = kind + a.href;
    if (key === last && Date.now() - lastAt < 5000) return; // double tap
    last = key; lastAt = Date.now();
    var h1 = document.querySelector('h1');
    send({
      type: 'click',
      channel: kind,
      button: locationOf(a),
      title: ((h1 && h1.textContent) || document.title.split('|')[0]).replace(/\s+/g, ' ').trim().slice(0, 100),
      number: kind === 'call' ? a.href.slice(4) : '',
      device: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    });
  }, true);
})();
