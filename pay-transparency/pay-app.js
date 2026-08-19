import { assessAd } from './ad-check.mjs';

// Free pay-transparency job-ad check. Client-side only, no fetch, no upload:
// the pasted ad is analysed by ad-check.mjs in this tab and never leaves the
// browser. Every legal fact comes from ad-check.mjs, sourced from
// ops/paytransparency-legal-table.md; nothing is invented from model memory.

const $ = (s) => document.querySelector(s);

const ICON_OK = `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>`;
const ICON_WARN = `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

const STATUS_UI = {
  ok: { cls: 'v-likely-ok', pill: 's-likely-ok', icon: ICON_OK, label: 'OK' },
  advice: { cls: 'v-check-required', pill: 's-check-required', icon: ICON_WARN, label: 'Advice' },
  flag: { cls: 'v-action-required', pill: 's-action-required', icon: ICON_WARN, label: 'Flag' },
};

const renderResults = (results) => {
  const out = $('#out');
  out.replaceChildren();
  for (const r of results) {
    const ui = STATUS_UI[r.status] ?? STATUS_UI.advice;
    const wrap = document.createElement('div');
    wrap.className = `verdict ${ui.cls}`;
    wrap.style.margin = '0';
    wrap.innerHTML = ui.icon; // static SVG string, no user input

    const body = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = r.check;
    const pill = document.createElement('span');
    pill.className = `pill ${ui.pill}`;
    pill.textContent = ui.label;
    const p = document.createElement('p');
    p.textContent = r.message;
    body.append(h3, pill, p);

    wrap.appendChild(body);
    out.appendChild(wrap);
  }
};

const MIN_AD_LENGTH = 40;

$('#adform').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#adtext').value.trim();
  if (text.length < MIN_AD_LENGTH) {
    renderResults([{ check: 'Nothing to check yet', status: 'advice', message: 'Paste the full job ad text above first. The check runs locally in your browser.' }]);
    return;
  }
  renderResults(assessAd(text));
});
