import { evaluate } from '../quiz-logic.mjs';
import { buildNis2Pack } from '../../scanner/nis2-pack.mjs';
import { makeZip } from '../../scanner/zip.mjs';

/* NIS2 Starter Pack — client-side only. The two fetches are the local
   nis2-data.json and the Gumroad licence-verify POST; no other answer ever
   leaves the browser. */
const PRODUCT_PERMALINK = 'nis2-starter-pack';
const STORE_URL = 'https://clearlabel.gumroad.com/l/nis2-starter-pack';
const SUPPORT_EMAIL = 'info@clearlabel.eu';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const option = (value, label) => {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
};

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

const DOCS_NOTE = 'START-HERE guide · risk-management checklist · incident-reporting runbook · registration sheet · management one-pager · dated evidence record';

let data = null;

const renderSectors = () => {
  const sel = $('#sector');
  sel.replaceChildren(option('', 'None of these'));
  for (const annex of [1, 2]) {
    const group = document.createElement('optgroup');
    group.label = annex === 1 ? 'Annex I — high criticality' : 'Annex II — other critical sectors';
    for (const sector of data.sectors.filter((s) => s.annex === annex)) {
      group.appendChild(option(sector.id, sector.name));
    }
    sel.appendChild(group);
  }
};

const renderSubsector = (sector) => {
  const wrap = $('#subsector-wrap');
  const sel = $('#subsector');
  if (!sector) {
    wrap.hidden = true;
    return;
  }
  sel.replaceChildren(...sector.subsectors.map((s) => option(s.id, s.name)));
  wrap.hidden = sector.subsectors.length <= 1;
};

const renderSizeBands = () => {
  const wrap = $('#size-bands');
  const sizes = [
    { value: 'micro-small', label: 'Micro or small — below both thresholds' },
    { value: 'medium', label: `Medium — ${data.sizeTest.mediumOrLarger}` },
    { value: 'large', label: `Large — ${data.sizeTest.largeCeiling}` },
  ];
  wrap.replaceChildren();
  sizes.forEach((size, i) => {
    const label = document.createElement('label');
    label.className = 'opt';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'sizeBand';
    input.value = size.value;
    input.checked = i === 0;
    const span = document.createElement('span');
    span.textContent = size.label;
    label.append(input, span);
    wrap.appendChild(label);
  });
};

const renderCaptures = () => {
  const wrap = $('#captures');
  wrap.replaceChildren();
  for (const capture of data.sizeIndependentCaptures) {
    const label = document.createElement('label');
    label.className = 'opt';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'captures';
    input.value = capture.id;
    const span = document.createElement('span');
    span.textContent = capture.label;
    label.append(input, span);
    wrap.appendChild(label);
  }
};

const collect = () => {
  const sector = data.sectors.find((s) => s.id === $('#sector').value) ?? null;
  const subsectorId = sector ? (sector.subsectors.length > 1 ? $('#subsector').value : sector.subsectors[0].id) : null;
  return {
    sectorId: $('#sector').value || null,
    subsectorId,
    sizeBand: document.querySelector('input[name="sizeBand"]:checked')?.value ?? null,
    captures: $$('input[name="captures"]:checked').map((i) => i.value),
  };
};

// evaluate() reads captures as ids; buildNis2Pack() prints captures as labels.
const packAnswers = (a) => {
  const sector = data.sectors.find((s) => s.id === a.sectorId) ?? null;
  const subsector = sector?.subsectors.find((s) => s.id === a.subsectorId) ?? null;
  return {
    sectorName: sector?.name ?? '',
    subsectorName: subsector?.name ?? '',
    sizeBand: a.sizeBand,
    captures: a.captures.map((id) => data.sizeIndependentCaptures.find((c) => c.id === id)?.label ?? id),
    orgName: $('#norg').value.trim(),
  };
};

const verifyLicence = async (key) => {
  const body = new URLSearchParams({
    product_permalink: PRODUCT_PERMALINK,
    license_key: key.trim(),
    increment_uses_count: 'false',
  });
  const res = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body });
  return res.json();
};

$('#sector').addEventListener('change', () => {
  const sector = data?.sectors.find((s) => s.id === $('#sector').value) ?? null;
  renderSubsector(sector);
});

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
    const answers = collect();
    const verdict = evaluate(answers, data);
    if (verdict.status === 'likely-out') {
      say(note('likely-ok', 'Likely out of NIS2 scope', `Your answers put you likely out of NIS2 scope — the pack would not apply. Re-check your answers, or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> if you bought by mistake (we refund).`));
      return;
    }
    download(makeZip(buildNis2Pack(packAnswers(answers), verdict)), 'clearlabel-nis2-starter-pack.zip');
    say(note('likely-ok', 'Pack downloaded', `Six ready-to-fill documents, built from your answers and dated today: ${DOCS_NOTE}.`));
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
    const demoAnswers = { sectorId: 'health', subsectorId: 'healthcare-providers', sizeBand: 'medium', captures: [] };
    const demo = {
      sectorName: 'Health',
      subsectorName: 'Healthcare providers',
      sizeBand: 'medium',
      captures: [],
      orgName: '',
    };
    download(makeZip(buildNis2Pack(demo, evaluate(demoAnswers, data), new Date(), { sample: true })), 'clearlabel-nis2-SAMPLE-pack.zip');
    say(note('likely-ok', 'Sample pack downloaded', `This is the full document set — ${DOCS_NOTE}. A real pack is identical but generated from your own answers, with your organisation name pre-filled.`));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download a sample pack (.zip)';
  }
});

const init = async () => {
  try {
    const res = await fetch('../nis2-data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    renderSectors();
    renderSubsector(null);
    renderSizeBands();
    renderCaptures();
    $('#build').disabled = false;
  } catch (err) {
    say(note('check-required', 'Could not load the generator', `The scope data could not be loaded (${esc(err.message)}). Refresh to try again, or email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`));
  }
};

init();
