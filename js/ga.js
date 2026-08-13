// Shared GA4 bootstrap + event helpers for blog pages.
// Measurement ID must match the one inline in index.html (see AGENTS.md > Analytics).
(function () {
  var GA_MEASUREMENT_ID = 'G-4SVWY8JWBX';

  window.gaEvent = function (name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  };

  function fireView() {
    var isArticle = !!document.querySelector('article');
    window.gaEvent(isArticle ? 'article_view' : 'page_view', {
      page_title: document.title,
      page_path: window.location.pathname
    });
  }

  function trackLinkClicks() {
    document.querySelectorAll('a[href*="facebook.com"]').forEach(function (a) {
      a.addEventListener('click', function () {
        window.gaEvent('facebook_click', { link_url: a.href });
      });
    });
    document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) {
      a.addEventListener('click', function () {
        window.gaEvent('whatsapp_click', { link_location: 'blog', link_url: a.href });
      });
    });
  }

  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.indexOf('G-XXXX') === 0) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);

  fireView();
  trackLinkClicks();
})();
