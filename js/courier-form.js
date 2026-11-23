// /courier: Sundarban Courier order form (design-first version, no backend yet).
// Validates in Bengali, shows a live bag total, and on submit saves the order through
// window.saveLead (js/leads.js, form_type 'courier_order'; the Apps Script writes the
// "কুরিয়ার" tab, emails the owner and sends the Telegram alert). If the sheet is not
// configured it falls back to a complete WhatsApp prefill. Either way the card is
// swapped for a confirmation.
// The production base district (Sherpur thana is in Bogura), keyed by the district option value.
var NEAR_BOGURA = { 'বগুড়া': 1 };
(function () {
  var form = document.querySelector('form[data-courier-form]');
  if (!form) return;
  var mount = document.querySelector('[data-courier-mount]');
  var done = document.querySelector('[data-courier-done]');
  var BN = '০১২৩৪৫৬৭৮৯';
  function bn(n) { return String(n).replace(/\d/g, function (d) { return BN[d]; }); }
  function en(s) { return String(s).replace(/[০-৯]/g, function (d) { return BN.indexOf(d); }); }
  function money(n) {
    var s = String(n), o = '';
    while (s.length > 3) { o = ',' + s.slice(-3) + o; s = s.slice(0, -3); }
    return bn(s + o);
  }
  function $(sel) { return form.querySelector(sel); }

  // Bag price comes from the page, so set-price keeps it current.
  var priceEl = document.querySelector('[data-bag-price]');
  var BAG = parseInt(en((priceEl.textContent || '').replace(/[^0-9০-৯]/g, '')), 10) || 0;
  var FEE = parseInt(en((document.querySelector('[data-courier-fee]').textContent || '').replace(/[^0-9০-৯]/g, '')), 10) || 0;
  var MAX = parseInt(en((document.querySelector('[data-courier-max]').textContent || '').replace(/[^0-9০-৯]/g, '')), 10) || 0;
  var KG = 50;
  var bags = 1;
  var paid = form.elements.paid;
  var out = $('[data-bags]'), minus = $('[data-minus]'), plus = $('[data-plus]');
  // Paint the result box and buttons from the number; the field itself is only
  // rewritten when `writeField` is true, so typing is never interrupted.
  function isOver() { return MAX > 0 && bags >= MAX; }
  function amountFor(k, c) { return k === 'silage' ? c * BAG : k === 'fee' ? c * FEE : c * (BAG + FEE); }
  function payAmount() { var t = paytype(), c = Math.max(1, bags); if (isOver() && (t === 'শুধু কুরিয়ার খরচ' || t === 'সাইলেজ + কুরিয়ার')) return 0; return t === 'সাইলেজের দাম' ? amountFor('silage', c) : t === 'শুধু কুরিয়ার খরচ' ? amountFor('fee', c) : t === 'সাইলেজ + কুরিয়ার' ? amountFor('total', c) : 0; }
  function paint(n, writeField) {
    bags = n;
    var c = Math.max(1, n);
    if (writeField) out.value = n ? String(n) : '';
    minus.disabled = c <= 1;
    plus.disabled = c >= 999;
    $('[data-r-bags]').textContent = bn(c);
    $('[data-r-kg]').textContent = bn(c * KG);
    priceEl.textContent = money(c * BAG);
    $('[data-r-fee]').textContent = money(c * FEE);
    $('[data-r-total]').textContent = money(c * (BAG + FEE));
    $('[data-btn-total]').textContent = money(c * (BAG + FEE));
    var over = isOver();
    form.querySelectorAll('[data-opt]').forEach(function (o) { var k = o.getAttribute('data-opt'); o.textContent = (over && k !== 'silage') ? '' : money(amountFor(k, c)) + ' টাকা'; });
    form.querySelectorAll('[data-copy="amount:fee"], [data-copy="amount:total"]').forEach(function (b) { b.hidden = over; });
    var paySec = form.querySelector('[data-pay-section]');
    if (over && !paySec.hidden) {
      paySec.hidden = true; setPay(false);
      ['trx', 'paid'].forEach(function (k) { form.elements[k].value = ''; clearErr(k); });
      setService('বিকাশ');
      form.querySelectorAll('input[name=paytype]').forEach(function (r) { r.checked = false; });
    } else if (!over && paySec.hidden) {
      paySec.hidden = false;
      var fr = form.querySelector('input[name=paytype][value="শুধু কুরিয়ার খরচ"]'); fr.checked = true;
    }
    form.querySelector('[data-row=fee]').hidden = over;
    form.querySelector('[data-row=total]').hidden = over;
    $('[data-btn-label]').textContent = over ? 'ফোন করার অনুরোধ পাঠান' : 'কুরিয়ারে অর্ডার পাঠান';
    $('[data-total-row]').hidden = over;
    if (typeof updateNudges === 'function') updateNudges();
    if (paid) { var pa = payAmount(); if (pa) paid.value = String(pa); }
  }
  function setBags(n) { paint(Math.max(1, Math.min(999, n)), true); }
  out.addEventListener('input', function () {
    var d = en(out.value).replace(/[^0-9]/g, '').slice(0, 3);
    if (d !== out.value) out.value = d;
    paint(d ? parseInt(d, 10) : 0, false);
  });
  out.addEventListener('blur', function () { if (!bags || bags < 1) setBags(1); });
  out.addEventListener('focus', function () { if (out.select) out.select(); });
  minus.addEventListener('click', function () { setBags((bags || 1) - 1); });
  plus.addEventListener('click', function () { setBags((bags || 0) + 1); });
  form.addEventListener('keydown', function (e) { if (e.key === 'Tab') form.classList.add('kbd'); });
  form.addEventListener('pointerdown', function () { form.classList.remove('kbd'); });
  var fired = {};
  function nudge(k, show) {
    var el = form.querySelector('[data-nudge=' + k + ']');
    el.hidden = !show;
    if (show && !fired[k]) { fired[k] = 1; if (typeof window.gaEvent === 'function') window.gaEvent('courier_truck_nudge_shown', { reason: k }); }
  }
  function updateNudges() {
    var over = isOver(), d = form.elements.district ? form.elements.district.value : '';
    nudge('over_cap', over);
    nudge('near_bogura', !over && !!NEAR_BOGURA[d]);
    var wa = form.querySelector('[data-nudge-wa]');
    if (wa) wa.href = 'https://wa.me/8801334211984?text=' + encodeURIComponent('আসসালামু আলাইকুম, আমার ' + bn(Math.max(1, bags)) + ' বস্তা সাইলেজ লাগবে' + (d ? ', ' + d : '') + '। মিনি ট্রাকে পাঠাতে খরচ কত পড়বে?');
  }
  if (form.elements.district) ['change', 'input'].forEach(function (ev) { form.elements.district.addEventListener(ev, updateNudges); });
  setBags(1);

  var FIELDS = ['phone', 'name', 'district', 'upazila', 'office', 'bags', 'alt', 'service', 'trx', 'paid', 'paytype'];
  function input(k) { var e = form.elements[k]; return k === 'paytype' ? (document.getElementById('l-paytype')) : e; }
  function paytype() { var r = form.querySelector('input[name=paytype]:checked'); return r ? r.value : ''; }
  function focusTarget(k) {
    var el = input(k);
    if (k === 'paytype') return form.querySelector('input[name=paytype]');
    if (k === 'service') return svcBtns[0];
    if (k === 'district') {
      var btn = document.getElementById('f-district-btn');
      if (btn && el.className.indexOf('sr-only') > -1) return btn;
    }
    return el;
  }
  form.querySelectorAll('input[name=paytype]').forEach(function (r) { r.addEventListener('change', function () { clearErr('paytype'); var pa = payAmount(); if (pa) paid.value = String(pa); }); });
  // Payment panel: collapsed by default, smooth expand (CSS), inert while closed so Tab skips it.
  function setPay() {} // step 3 is always open now
  // Service: three toggle buttons feeding the hidden input.
  var svcBtns = form.querySelectorAll('[data-service]');
  function setService(v) {
    form.elements.service.value = v;
    svcBtns.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-service') === v ? 'true' : 'false'); });
    var pl = form.querySelector('[data-pay-label]'); if (pl) pl.textContent = v + ' নম্বর (সেন্ড মানি)';
  }
  svcBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-service');
      setService(v);
      clearErr('service');
    });
  });
  var altBtn = form.querySelector('[data-alt-toggle]'), altPanel = form.querySelector('[data-alt-panel]'), altIc = form.querySelector('[data-alt-ic]');
  function setAlt(open) {
    altBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    altPanel.classList.toggle('grid-rows-[1fr]', open);
    altPanel.classList.toggle('grid-rows-[0fr]', !open);
    if (open) altPanel.removeAttribute('inert'); else altPanel.setAttribute('inert', '');
    altIc.innerHTML = open ? '<path d="M5 12h14"/>' : '<path d="M12 5v14M5 12h14"/>';
  }
  altBtn.addEventListener('click', function () { setAlt(altBtn.getAttribute('aria-expanded') !== 'true'); });
  function setErr(k, msg) {
    document.getElementById('e-' + k).textContent = msg;
    if (k !== 'paytype') input(k).setAttribute('aria-invalid', 'true');
  }
  function clearErr(k) {
    document.getElementById('e-' + k).textContent = '';
    if (k !== 'paytype') input(k).removeAttribute('aria-invalid');
  }
  FIELDS.forEach(function (k) {
    ['input', 'change'].forEach(function (ev) { input(k).addEventListener(ev, function () { clearErr(k); }); });
  });
  function phoneOf(v) { return en(v).replace(/[\s-]/g, ''); }
  function trxOf() { return en(input('trx').value).replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
  input('trx').addEventListener('input', function () { var t = this.value.replace(/[\s]/g, '').toUpperCase(); if (t !== this.value) this.value = t; });
  input('paid').addEventListener('input', function () { var d = en(this.value).replace(/[^0-9]/g, ''); if (d !== this.value) this.value = d; });

  // Copy the send-money number or a card's amount: clipboard API first, then a hidden-input execCommand, then select the text.
  (function () {
    var st = form.querySelector('[data-copy-status]'), numEl = form.querySelector('[data-pay-number]'), timers = [];
    var CHECK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>', COPY = '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>';
    function ok(btn, i) {
      var lbl = btn.querySelector('[data-lbl]'), ic = btn.querySelector('[data-ic]');
      lbl.textContent = 'কপি হয়েছে'; ic.innerHTML = CHECK; st.textContent = 'কপি হয়েছে';
      clearTimeout(timers[i]);
      timers[i] = setTimeout(function () { lbl.textContent = 'কপি'; ic.innerHTML = COPY; st.textContent = ''; }, 2000);
    }
    function fallback(btn, text, i) {
      var done = false;
      try { var h = document.createElement('input'); h.value = text; h.setAttribute('readonly', ''); h.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(h); h.select(); h.setSelectionRange(0, 99); done = document.execCommand('copy'); document.body.removeChild(h); } catch (e) { done = false; }
      if (done) { ok(btn, i); return; }
      try { var r = document.createRange(); r.selectNodeContents(numEl); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e2) {}
      st.textContent = 'বেছে নেওয়া হয়েছে, কপি করুন';
    }
    form.querySelectorAll('[data-copy]').forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        var text = /^amount:/.test(btn.getAttribute('data-copy')) ? String(amountFor(btn.getAttribute('data-copy').slice(7), Math.max(1, bags))) : numEl.getAttribute('data-copy-value');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { ok(btn, i); }, function () { fallback(btn, text, i); });
        else fallback(btn, text, i);
      });
    });
    var proxy = form.querySelector('[data-copy-proxy]');
    if (proxy) proxy.addEventListener('click', function () { form.querySelector('[data-copy="number"]').click(); });
  })();

  var PHONE_RE = /^01\d{9}$/;

  function validate() {
    var first = null;
    function bad(k, m) { setErr(k, m); if (!first) first = k; }
    var p = phoneOf(input('phone').value);
    if (!p) bad('phone', 'মোবাইল নম্বর দিন');
    else if (!PHONE_RE.test(p)) bad('phone', '১১ সংখ্যার মোবাইল নম্বর দিন, যেমন ০১৭১২৩৪৫৬৭৮');
    if (!input('name').value.trim()) bad('name', 'প্রাপকের নাম দিন');
    if (!input('district').value) bad('district', 'জেলা বেছে নিন');
    if (!input('upazila').value.trim()) bad('upazila', 'উপজেলা বা থানার নাম দিন');
    if (!input('office').value.trim()) bad('office', 'সুন্দরবন কুরিয়ারের শাখার নাম দিন');
    if (!bags || bags < 1) bad('bags', 'কত বস্তা লাগবে লিখুন');
    var alt = phoneOf(input('alt').value);
    if (alt && !PHONE_RE.test(alt)) {
      bad('alt', 'বিকল্প নম্বর ১১ সংখ্যার হতে হবে, অথবা ঘরটি ফাঁকা রাখুন');
      setAlt(true);
    }
    var trx = trxOf();
    var svc = input('service').value;
    if (trx && !/^[A-Z0-9]{6,20}$/.test(trx)) bad('trx', 'সঠিক ট্রানজেকশন আইডি লিখুন');
    else if (trx && !svc) bad('service', 'কোন মাধ্যমে পাঠিয়েছেন বেছে নিন');
    if (trx && !paytype()) bad('paytype', 'কিসের টাকা পাঠিয়েছেন বেছে নিন');
    if (first && ['service', 'trx', 'paid', 'paytype'].indexOf(first) > -1) setPay(true);
    if (first) { focusTarget(first).focus(); return false; }
    return true;
  }

  function showDone() {
    var v = {
      name: input('name').value.trim(),
      phone: bn(phoneOf(input('phone').value)),
      district: input('district').value,
      upazila: input('upazila').value.trim(),
      office: input('office').value.trim()
    };
    var rows = [
      ['নাম', v.name],
      ['মোবাইল', v.phone],
      ['জেলা / উপজেলা', v.district + ' / ' + v.upazila],
      ['সুন্দরবন শাখা', v.office],
      ['বস্তা', bn(bags) + ' বস্তা, সাইলেজ ' + money(bags * BAG) + ' টাকা'],
    ];
    if (!isOver()) rows.push(['কুরিয়ার খরচ', money(bags * FEE) + ' টাকা'], ['মোট', money(bags * (BAG + FEE)) + ' টাকা']);
    var trx = trxOf(), svc = input('service').value, paidV = en(input('paid').value).replace(/\D/g, ''), pt = paytype();
    if (pt && trx) rows.push(['কিসের টাকা', pt]);
    if (svc && trx) rows.push(['পাঠানোর মাধ্যম', svc]);
    if (trx) rows.push(['TrxID', trx]);
    if (paidV && trx) rows.push(['পাঠানো টাকা', paidV + ' টাকা']);
    done.querySelector('[data-done-line]').textContent = isOver() ? 'আমরা ফোন করে ট্রাকের খরচ জানাব।' : 'আমরা ফোন করে মোট খরচ জানাব।';
    var note = done.querySelector('[data-pay-note]');
    note.textContent = isOver() ? '' : (trx ? 'টাকা পাঠানোর তথ্য পেয়েছি (TrxID: ' + trx + '), মিলিয়ে ফোনে জানাব।' : 'ফোনে কথা বলার পর কুরিয়ার খরচ পাঠালে পার্সেল বুক করা হবে।') + (pt === 'সাইলেজ + কুরিয়ার' ? '' : ' সাইলেজের দাম শাখায় পার্সেল নেওয়ার সময় দেবেন।');
    var dl = done.querySelector('[data-summary]');
    dl.textContent = '';
    rows.forEach(function (r, i) {
      var d = document.createElement('div');
      var tot = r[0] === 'মোট';
      d.className = 'flex justify-between gap-3 py-2' + (tot ? ' border-t border-[#0b5b38]/15 mt-1 pt-3' : '');
      var dt = document.createElement('dt');
      dt.className = 'shrink-0 text-[#4b5a51]';
      dt.textContent = r[0];
      var dd = document.createElement('dd');
      dd.className = 'min-w-0 text-right font-semibold tabular-nums text-[#123b28] [overflow-wrap:anywhere]' + (tot ? ' text-xl text-[rgb(0,105,68)]' : '');
      dd.textContent = r[1];
      d.appendChild(dt); d.appendChild(dd); dl.appendChild(d);
    });
    // Complete as sent: ends with a question, never a label.
    var text = 'আসসালামু আলাইকুম, আমি ' + v.name + ', ' + v.district + ', ' + v.upazila + '। সুন্দরবন কুরিয়ারের ' +
      v.office + ' থেকে ' + bn(bags) + ' বস্তা সাইলেজ নিতে চাই। সাইলেজ ' + money(bags * BAG) + ' টাকা' + (isOver() ? '।' : ', কুরিয়ার ' + money(bags * FEE) + ' টাকা, মোট ' + money(bags * (BAG + FEE)) + ' টাকা।') +
      (trx ? ' ' + (svc || '') + 'এ ' + (pt ? pt + ' বাবদ ' : '') + (paidV ? paidV + ' টাকা ' : '') + 'পাঠিয়েছি, TrxID: ' + trx + '।' : '') + (isOver() ? ' ট্রাকে পাঠাতে খরচ কত পড়বে?' : ' মোট খরচ জানাবেন?');
    done.querySelector('[data-wa]').href = 'https://wa.me/8801334211984?text=' + encodeURIComponent(text);
    mount.hidden = true;
    done.hidden = false;
    done.focus();
    done.scrollIntoView({ block: 'start' });
    return rows;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.elements.website && form.elements.website.value) return; // honeypot
    if (!validate()) return;
    var summary = showDone();
    var saved = false;
    try { saved = typeof window.saveLead === 'function' && !!window.saveLead(orderPayload(summary)); } catch (err) { saved = false; }
    if (!saved) {
      var wa = done.querySelector('[data-wa]');
      if (wa) window.open(wa.href, '_blank', 'noopener');
    }
    if (typeof window.gaEvent === 'function') {
      window.gaEvent('order_details_submitted', { submission_method: saved ? 'courier' : 'courier_whatsapp', page_path: location.pathname });
    }
  });

  // Everything the sheet needs, plus a readable note so an older deployed Apps Script
  // (which ignores unknown fields) still stores the whole order as a normal lead.
  function orderPayload(rows) {
    var c = Math.max(1, bags), truck = isOver();
    var trx = trxOf(), svc = input('service').value, pt = paytype();
    var paidV = en(input('paid').value).replace(/\D/g, '');
    var alt = phoneOf(input('alt').value);
    var district = input('district').value, upazila = input('upazila').value.trim(), office = input('office').value.trim();
    var parts = ['কুরিয়ার অর্ডার (সুন্দরবন কুরিয়ার)'];
    rows.forEach(function (r) { parts.push(r[0] + ': ' + r[1]); });
    if (alt) parts.push('বিকল্প নম্বর: ' + alt);
    if (truck) parts.push('ট্রাকে পাঠাতে হবে, ফোন করুন');
    return {
      form_type: 'courier_order',
      name: input('name').value.trim(),
      phone: phoneOf(input('phone').value),
      alt_phone: alt,
      district: district,
      upazila: upazila,
      location: district + ', ' + upazila,
      branch: office,
      bags: c,
      silage_amount: c * BAG,
      courier_amount: truck ? 0 : c * FEE,
      total: truck ? 0 : c * (BAG + FEE),
      truck_mode: truck,
      service: trx ? svc : '',
      pay_type: trx ? pt : '',
      trx_id: trx,
      amount_sent: trx && paidV ? parseInt(paidV, 10) : 0,
      note: parts.join(' | '),
      website: form.elements.website ? form.elements.website.value : ''
    };
  }

  done.querySelector('[data-back]').addEventListener('click', function () {
    done.hidden = true;
    mount.hidden = false;
    input('phone').focus();
  });
})();
