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

  // Which spot on the page the link sits in, so GA4 shows whether the sticky
  // header, the in-body links, the sidebar or the closing CTA earns the click.
  function locationOf(a) {
    if (a.closest('header')) return 'header';
    if (a.closest('footer')) return 'footer';
    if (a.closest('aside')) return 'sidebar';
    if (a.closest('article')) return 'article_body';
    return 'cta_section';
  }

  function trackLinkClicks() {
    document.querySelectorAll('a[href*="facebook.com"]').forEach(function (a) {
      a.addEventListener('click', function () {
        window.gaEvent('facebook_click', {
          link_location: locationOf(a),
          link_url: a.href,
          page_path: window.location.pathname
        });
      });
    });
    document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) {
      a.addEventListener('click', function () {
        window.gaEvent('whatsapp_click', {
          link_location: locationOf(a),
          link_url: a.href,
          page_path: window.location.pathname
        });
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
