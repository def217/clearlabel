```js
(function () {
  'use strict';

  /* ---------- Synchronous countdown computation ---------- */
  const DAY = 86400000;
  const startUTC = Date.UTC(2026, 7, 2);      // 2 Aug 2026
  const endUTC = Date.UTC(2026, 11, 2);       // 2 Dec 2026
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const daysBinding = todayUTC >= startUTC ? Math.floor((todayUTC - startUTC) / DAY) + 1 : 0;
  const daysRemaining = todayUTC <= endUTC ? Math.ceil((endUTC - todayUTC) / DAY) : 0;

  const tickerDay = document.getElementById('ticker-day');
  if (tickerDay) tickerDay.textContent = daysBinding;

  const clockBinding = document.getElementById('clock-binding');
  if (clockBinding) clockBinding.textContent = daysBinding;

  const clockRemaining = document.getElementById('clock-remaining');
  if (clockRemaining) clockRemaining.textContent = daysRemaining;

  const closingLine = document.getElementById('closing-line');
  if (closingLine) {
    closingLine.textContent =
      'Day ' + daysBinding + ' of Article 50(1). ' + daysRemaining +
      ' days until the marking duty.';
  }

  document.querySelectorAll('[data-live-n-days]').forEach(function (el) {
    el.textContent = daysRemaining;
  });

  document.querySelectorAll('[data-live-day-binding]').forEach(function (el) {
    el.textContent = daysBinding;
  });

  /* ---------- Accordion ---------- */
  const accordion = document.querySelector('.faq-accordion');
  if (accordion) {
    const questions = Array.prototype.slice.call(accordion.querySelectorAll('.faq-question'));

    questions.forEach(function (btn, index) {
      const answer = btn.nextElementSibling;
      if (answer && answer.id) {
        btn.setAttribute('aria-controls', answer.id);
      }

      if (index === 0) {
        btn.setAttribute('aria-expanded', 'true');
        if (answer) answer.hidden = false;
      } else {
        btn.setAttribute('aria-expanded', 'false');
        if (answer) answer.hidden = true;
      }

      btn.addEventListener('click', function () {
        const wasOpen = btn.getAttribute('aria-expanded') === 'true';

        questions.forEach(function (other) {
          other.setAttribute('aria-expanded', 'false');
          const otherAnswer = other.nextElementSibling;
          if (otherAnswer) otherAnswer.hidden = true;
        });

        if (!wasOpen) {
          btn.setAttribute('aria-expanded', 'true');
          if (answer) answer.hidden = false;
        }
      });
    });
  }

  /* ---------- Copy-to-clipboard button ---------- */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const text = btn.getAttribute('data-copy');
      const flashCopied = function () {
        const original = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () {
          btn.textContent = original;
        }, 1800);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(flashCopied);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch (e) {
          /* ignore */
        }
        document.body.removeChild(ta);
        flashCopied();
      }
    });
  });

  /* ---------- Scan-status panel ---------- */
  const scanPhase = document.getElementById('scan-phase');
  const scanSubmit = document.getElementById('scan-submit');
  const scanIdle = document.getElementById('scan-idle-strip');
  const scanResult = document.getElementById('scan-result');
  const scanResultIssues = document.getElementById('scan-result-issues');
  const scanResultFindings = document.getElementById('scan-result-findings');

  const checkStatusEls = {
    vendor: document.getElementById('check-vendor-status'),
    disclosure: document.getElementById('check-disclosure-status'),
    marking: document.getElementById('check-marking-status')
  };

  function setCheckStatus(id, status) {
    if (checkStatusEls[id]) {
      checkStatusEls[id].textContent = status;
    }
  }

  window.ClearLabelScanUI = {
    setPhase: function (phase) {
      if (scanPhase) scanPhase.textContent = phase;

      if (scanSubmit) {
        if (phase === 'running') {
          scanSubmit.textContent = 'Scanning…';
        } else if (phase === 'complete') {
          scanSubmit.textContent = 'Scan again';
        } else {
          scanSubmit.textContent = 'Scan free';
        }
      }
    },

    setCheck: setCheckStatus,

    start: function () {
      if (scanIdle) scanIdle.hidden = false;
      if (scanResult) scanResult.hidden = true;

      this.setPhase('running');
      setCheckStatus('vendor', 'queued');
      setCheckStatus('disclosure', 'queued');
      setCheckStatus('marking', 'queued');
    },

    complete: function (result) {
      if (scanIdle) scanIdle.hidden = true;
      if (scanResult) {
        scanResult.hidden = false;

        const findings = (result && result.findings) || [];
        if (scanResultIssues) {
          scanResultIssues.textContent = findings.length;
        }

        if (scanResultFindings) {
          scanResultFindings.innerHTML = '';

          findings.forEach(function (finding) {
            const row = document.createElement('div');
            row.className = 'scan-finding';

            const tag = document.createElement('span');
            tag.className = 'scan-finding-article';
            tag.textContent = finding.article || '50(1)';

            const title = document.createElement('span');
            title.textContent = finding.title || finding.detail || '';

            row.appendChild(tag);
            row.appendChild(title);
            scanResultFindings.appendChild(row);
          });
        }
      }

      this.setPhase('complete');
    },

    reset: function () {
      if (scanIdle) scanIdle.hidden = false;
      if (scanResult) scanResult.hidden = true;

      setCheckStatus('vendor', '—');
      setCheckStatus('disclosure', '—');
      setCheckStatus('marking', '—');

      this.setPhase('idle');
    }
  };

  window.ClearLabelScanUI.reset();
})();
```