// Shared GA4 bootstrap + event helpers for blog pages.
// Measurement ID must match the one inline in index.html (see AGENTS.md > Analytics).
(function () {
  var GA_MEASUREMENT_ID = 'G-4SVWY8JWBX';

  // AI assistants (ChatGPT, Perplexity, Copilot, Gemini, Claude) are the main
  // lead source. Detect the landing from the referrer or ChatGPT's utm_source,
  // remember it for the session, and stamp ai_source on every later event so a
  // whatsapp_click can be traced back to the assistant that sent the farmer.
  var AI_SOURCES = [['chatgpt', 'chatgpt'], ['openai', 'chatgpt'], ['perplexity', 'perplexity'], ['copilot', 'copilot'], ['gemini', 'gemini'], ['claude', 'claude'], ['meta.ai', 'meta_ai'], ['you.com', 'you']];
  var aiSource = '', aiFresh = false;
  try {
    var probe = ((new URLSearchParams(location.search).get('utm_source') || '') + ' ' + (document.referrer ? new URL(document.referrer).hostname : '')).toLowerCase();
    for (var i = 0; i < AI_SOURCES.length; i++) if (probe.indexOf(AI_SOURCES[i][0]) !== -1) { aiSource = AI_SOURCES[i][1]; aiFresh = true; break; }
    if (aiSource) sessionStorage.setItem('ai_source', aiSource); else aiSource = sessionStorage.getItem('ai_source') || '';
  } catch (e) {}

  window.gaEvent = function (name, params) {
    params = params || {};
    if (aiSource && !params.ai_source) params.ai_source = aiSource;
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
  };

  function fireAiReferral() {
    if (aiFresh) window.gaEvent('ai_referral', { ai_source: aiSource, page_path: window.location.pathname, page_title: document.title });
  }

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
    // An explicit data-cta wins, so two CTAs in the same region (the hero and
    // the closing box of a district page) can be told apart.
    var tagged = a.closest('[data-cta]');
    if (tagged) return tagged.getAttribute('data-cta');
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
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.addEventListener('click', function () {
        window.gaEvent('phone_click', {
          link_location: locationOf(a),
          link_url: a.href,
          page_path: window.location.pathname
        });
      });
    });
  }

  // A bare wa.me link opens an empty chat: the farmer has to think of what to
  // write, and the owner cannot tell which page sent them (GA sees the click,
  // not the order). Name the page and ask for the two facts every quote needs.
  // Links that already carry ?text= (district pages, calculators) keep theirs.
  // Runs before the GA early return so it works even with analytics off.
  function prefillWhatsApp() {
    var h1 = document.querySelector('h1');
    var name = ((h1 && h1.textContent) || document.title.split('|')[0]).replace(/\s+/g, ' ').trim().slice(0, 70);
    var msg = 'আসসালামু আলাইকুম, "' + name + '" পাতা থেকে লিখছি। ভুট্টা সাইলেজ নিতে চাই।\nএলাকা: \nবস্তা: ';
    document.querySelectorAll('a[href*="wa.me/"]').forEach(function (a) {
      if (a.href.indexOf('text=') === -1) a.href = a.href.split('?')[0] + '?text=' + encodeURIComponent(msg);
    });
  }
  prefillWhatsApp();

  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.indexOf('G-XXXX') === 0) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);

  fireAiReferral();
  fireView();
  trackLinkClicks();
})();
