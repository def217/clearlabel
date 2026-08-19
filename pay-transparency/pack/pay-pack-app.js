import { buildPayPack } from './pay-pack.mjs';
import { makeZip } from '../../scanner/zip.mjs';

/* Pay Transparency Job-Ad Kit. Client-side only: the two fetches are the
   local pay-pack-data.json and the Gumroad licence-verify POST; no other
   answer ever leaves the browser. */
const PRODUCT_PERMALINK = 'pay-transparency-kit';
const STORE_URL = 'https://clearlabel.gumroad.com/l/pay-transparency-kit';
const SUPPORT_EMAIL = 'info@clearlabel.eu';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const say = (html) => { $('#out').innerHTML = html; };
const ICON_OK = `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>`;
const ICON_WARN = `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

const note = (kind, head, body) =>
  `<div class="verdict v-${kind}" style="margin:14px 0 0">${kind === 'likely-ok' ? ICON_OK : ICON_WARN}
   <div><h3>${esc(head)}</h3><p>${body}</p></div></div>`;

const download = (blob, filename) => {
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
};

const DOCS_NOTE = 'Salary-range clause (EN, DE, FR) · gender-neutral pay-criteria statement · interviewer one-pager · contract checklist item';

let data = null;

const verifyLicence = async (key) => {
  const body = new URLSearchParams({
    product_permalink: PRODUCT_PERMALINK,
    license_key: key.trim(),
    increment_uses_count: 'false',
  });
  const res = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body });
  return res.json();
};

$('#packform').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!data) return;
  const key = $('#nkey').value.trim();
  if (!key) return say(note('check-required', 'A licence key is required', 'Paste the key from your receipt to build the pack.'));

  $('#build').disabled = true;
  $('#build').innerHTML = '<span class="spin"></span>Working';
  try {
    const lic = await verifyLicence(key);
    if (!lic?.success) {
      say(note('check-required', 'That licence key was not accepted', `Check it against your receipt, or <a href="${STORE_URL}">buy a licence</a>.`));
      return;
    }
    const opts = {
      orgName: $('#norg').value.trim(),
      currency: $('#ncur').value.trim(),
      range: $('#nrange').value.trim(),
    };
    download(makeZip(buildPayPack(data, opts)), 'clearlabel-pay-transparency-kit.zip');
    say(note('likely-ok', 'Pack downloaded', `Four ready-to-edit documents, built from your answers and dated today: ${DOCS_NOTE}.`));
  } catch (err) {
    say(note('check-required', 'Could not build the pack', esc(err.message)));
  } finally {
    $('#build').disabled = false;
    $('#build').textContent = 'Build my pack';
  }
});

$('#sample').addEventListener('click', () => {
  const btn = $('#sample');
  if (!data) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin" style="border-color:var(--line);border-top-color:var(--accent)"></span>Building sample';
  try {
    const demo = { orgName: '', currency: 'EUR', range: '45,000 - 55,000', sample: true };
    download(makeZip(buildPayPack(data, demo)), 'clearlabel-pay-transparency-SAMPLE-pack.zip');
    say(note('likely-ok', 'Sample pack downloaded', `This is the full document set: ${DOCS_NOTE}. A real pack is identical but generated from your own currency and range.`));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download a sample pack (.zip)';
  }
});

const init = async () => {
  try {
    const res = await fetch('../pay-pack-data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    $('#build').disabled = false;
  } catch (err) {
    say(note('check-required', 'Could not load the generator', `The document data could not be loaded (${esc(err.message)}). Refresh to try again, or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`));
  }
};

init();
