// Styled district dropdown for /form. The native <select name="district"> stays in
// the DOM as the source of truth (still submitted, still read by js/leads.js) and
// is only visually hidden once this script runs; without JS it shows as usual.
// ARIA: button (aria-haspopup=listbox) opens a panel with a search field and a
// listbox. Search matches the Bengali name and the English slug or spelling.
// One picker per <select name="district">, so the homepage and district pages can carry
// several forms; each select needs its own unique id, and ids below derive from it.
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('select[name="district"]'), function (sel) {
    if (sel.getAttribute('data-dp-init') || !sel.id) return;
    sel.setAttribute('data-dp-init', '1');
    initPicker(sel);
  });
})();

function initPicker(sel) {
  var base = sel.id;
  var OTHER = 'অন্য জেলা';
  var items = [], other = null;
  Array.prototype.forEach.call(sel.options, function (o) {
    if (!o.value) return;
    if (o.value === OTHER) { other = { v: o.value, label: o.textContent, hay: '' }; return; }
    items.push({ v: o.value, label: o.textContent, hay: (o.textContent + ' ' + (o.getAttribute('data-en') || '')).toLowerCase() });
  });
  if (!other) other = { v: OTHER, label: OTHER, hay: '' };

  var inputCls = 'block min-h-12 w-full rounded-[8px] border border-[#6f8f7c] bg-white px-4 py-2.5 text-base font-normal text-black focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0b5fcc]';
  var CHECK = '<svg aria-hidden="true" class="h-5 w-5 shrink-0 fill-none stroke-[rgb(14,124,75)]" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHEVRON = '<svg aria-hidden="true" class="h-5 w-5 shrink-0 fill-none stroke-[#456451]" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var wrap = document.createElement('div');
  wrap.className = 'relative mt-2';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.id = base + '-btn';
  btn.className = inputCls + ' flex items-center justify-between gap-2 text-left';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', base + '-list');
  var lbl = document.querySelector('label[for="' + base + '"]');
  if (lbl && !lbl.id) lbl.id = 'lbl-' + base;
  var lblId = lbl ? lbl.id : '';
  if (lbl) btn.setAttribute('aria-labelledby', lblId + ' ' + base + '-btn');
  var btnText = document.createElement('span');
  btn.appendChild(btnText);
  btn.insertAdjacentHTML('beforeend', CHEVRON);

  var panel = document.createElement('div');
  panel.hidden = true;
  panel.className = 'absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-[#0b5b38]/10 bg-white p-2 shadow-[0_8px_24px_rgba(11,91,56,0.14)]';
  var search = document.createElement('input');
  search.type = 'text';
  search.setAttribute('role', 'combobox');
  search.setAttribute('aria-expanded', 'true');
  search.setAttribute('aria-controls', base + '-list');
  search.setAttribute('aria-autocomplete', 'list');
  search.setAttribute('aria-label', 'জেলার নাম খুঁজুন');
  search.autocomplete = 'off';
  search.placeholder = 'জেলার নাম লিখুন, যেমন বগুড়া';
  search.className = inputCls + ' mt-0 placeholder:text-[#6b7280]';
  var empty = document.createElement('p');
  empty.hidden = true;
  empty.setAttribute('role', 'status');
  empty.className = 'px-3 py-2 text-[15px] leading-6 text-[#4b5a51]';
  empty.textContent = 'পাওয়া যায়নি, \'অন্য জেলা\' বেছে নিন';
  var list = document.createElement('ul');
  list.id = base + '-list';
  list.setAttribute('role', 'listbox');
  if (lblId) list.setAttribute('aria-labelledby', lblId);
  list.className = 'mt-2 max-h-[18rem] overflow-y-auto overscroll-contain';
  panel.appendChild(search);
  panel.appendChild(empty);
  panel.appendChild(list);
  wrap.appendChild(btn);
  wrap.appendChild(panel);

  sel.className = 'sr-only'; // replace, not add: its w-full/block classes would beat sr-only and widen the page
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');
  sel.parentNode.insertBefore(wrap, sel.nextSibling);

  var shown = [], active = -1;

  function paintButton() {
    if (sel.value) { btnText.textContent = sel.value; btnText.className = 'text-black'; }
    else { btnText.textContent = 'জেলা বেছে নিন'; btnText.className = 'text-[#6b7280]'; }
  }

  function render() {
    var q = search.value.trim().toLowerCase();
    var hits = items.filter(function (i) { return !q || i.hay.indexOf(q) !== -1; });
    empty.hidden = hits.length > 0;
    shown = hits.concat([other]);
    if (active >= shown.length || active < 0) active = 0;
    list.innerHTML = '';
    shown.forEach(function (it, idx) {
      var li = document.createElement('li');
      li.id = base + '-opt-' + idx;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', sel.value === it.v ? 'true' : 'false');
      li.className = 'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-[17px] leading-6 text-black hover:bg-[rgb(245,255,248)] active:bg-[rgb(245,255,248)]' + (idx === active ? ' bg-[rgb(245,255,248)]' : '') + (it === other ? ' mt-1 border-t border-[#0b5b38]/10' : '');
      li.textContent = it.label;
      if (sel.value === it.v) li.insertAdjacentHTML('beforeend', CHECK);
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });
      li.addEventListener('click', function () { choose(it); });
      list.appendChild(li);
    });
    search.setAttribute('aria-activedescendant', base + '-opt-' + active);
  }

  function setActive(n) {
    active = Math.max(0, Math.min(shown.length - 1, n));
    render();
    var el = document.getElementById(base + '-opt-' + active);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function open(viaKeyboard, seed) {
    search.value = seed || '';
    active = -1;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    render();
    var cur = shown.map(function (s) { return s.v; }).indexOf(sel.value);
    if (cur > -1 && !seed) setActive(cur);
    if (panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // On a phone the keyboard would cover the list, so only focus search for a
    // mouse or keyboard user; touch users see the list first.
    if (viaKeyboard || (window.matchMedia && window.matchMedia('(pointer: fine)').matches)) search.focus();
  }

  function close(returnFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn.focus();
  }

  function choose(it) {
    sel.value = it.v;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    paintButton();
    close(false);
    var up = sel.form && sel.form.elements.upazila;
    if (up) up.focus();
  }

  btn.addEventListener('click', function (e) {
    if (panel.hidden) open(e.detail === 0); else close(false);
  });
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (panel.hidden) open(true); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') { e.preventDefault(); if (panel.hidden) open(true, e.key); }
  });
  search.addEventListener('input', function () { active = 0; render(); });
  search.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close(false);
  });
  document.addEventListener('pointerdown', function (e) { if (!wrap.contains(e.target)) close(false); });
  sel.addEventListener('change', paintButton);
  paintButton();
}
