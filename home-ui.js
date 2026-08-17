/* Static-page behaviour for the homepage: the live countdowns, the FAQ accordion
   and the copy buttons. Loaded as a classic script at the end of <body> so the
   countdowns are filled in during parse — the page must never paint a dash, a
   zero or a NaN where a real number belongs. Scanner wiring lives in app.js. */
(function () {
  'use strict';

  var DAY = 86400000;
  var ENFORCED_FROM = Date.UTC(2026, 7, 2);   // Art. 50(1) disclosure duty
  var MARKING_DUE = Date.UTC(2026, 11, 2);    // Art. 50(2) machine-readable marking

  var now = new Date();
  var today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  /* 2 Aug 2026 is day 1, so the ticker, the clock and the closing line all quote
     the same ordinal rather than three near-miss numbers. */
  var dayOfEnforcement = today >= ENFORCED_FROM ? Math.floor((today - ENFORCED_FROM) / DAY) + 1 : 0;
  var daysToMarking = today <= MARKING_DUE ? Math.ceil((MARKING_DUE - today) / DAY) : 0;

  var write = function (id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  write('ticker-day', dayOfEnforcement);
  write('clock-binding-days', dayOfEnforcement);
  write('cta-day', dayOfEnforcement);
  write('clock-remaining-days', daysToMarking);
  write('days-to-marking', daysToMarking);
  write('cta-remaining', daysToMarking);
  write('today-date', now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));

  /* FAQ accordion: single-open, first item open, driven off the markup already
     in the page so the answers stay readable with JavaScript switched off. */
  var items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));

  var setOpen = function (item, open) {
    var button = item.querySelector('.faq-question');
    var icon = item.querySelector('.faq-icon');
    item.classList.toggle('open', open);
    if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (icon) icon.textContent = open ? '−' : '+';
  };

  items.forEach(function (item) {
    var button = item.querySelector('.faq-question');
    if (!button) return;
    button.addEventListener('click', function () {
      var wasOpen = item.classList.contains('open');
      items.forEach(function (other) { setOpen(other, false); });
      setOpen(item, !wasOpen);
    });
  });

  /* Copy buttons. execCommand is the fallback for browsers that withhold the
     async clipboard outside a secure context. */
  var COPIED_MS = 1800;

  var flash = function (button, original) {
    button.textContent = 'Copied';
    setTimeout(function () { button.textContent = original; }, COPIED_MS);
  };

  var copyFallback = function (text) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'absolute';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(field);
    return ok;
  };

  document.querySelectorAll('[data-copy]').forEach(function (button) {
    var original = button.textContent;
    button.addEventListener('click', function () {
      var text = button.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { flash(button, original); },
          function () { if (copyFallback(text)) flash(button, original); }
        );
        return;
      }
      if (copyFallback(text)) flash(button, original);
    });
  });
})();
