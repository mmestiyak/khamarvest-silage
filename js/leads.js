// Sends leads to the owner's Google Sheet (setup: scripts/leads-apps-script.gs).
//  - saveLead(fields): the homepage order form, before WhatsApp opens, so the
//    farmer's name and number survive even if WhatsApp never opens.
//  - every WhatsApp / call tap on any page goes to the sheet's "Clicks" tab with
//    the page, button and source. No phone number (the site never sees it),
//    but the owner can match a chat's time to the page that sent it.
// Homepage loads this directly; every other page gets it from /js/ga.js.
// Until LEADS_URL is filled in, nothing is sent.
(function () {
  if (window.saveLead) return;
  var LEADS_URL = 'https://script.google.com/macros/s/AKfycbx_UlR76fDtfA8yzqY2IEbtLYXZ37dm0DZxDfFio5LaJlYpWsCfsLRIwoamdGYLLKtV/exec';

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
