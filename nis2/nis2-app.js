import { evaluate } from './quiz-logic.mjs';

// Free NIS2 scope quiz — client-side only. The single fetch is the local
// nis2-data.json; no quiz answer ever leaves the browser. Every legal fact
// comes from nis2-data.json and quiz-logic.mjs (sourced from
// ops/nis2-legal-table.md); nothing is invented from model memory.

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const option = (value, label) => {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
};

const ICON_OK = `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>`;
const ICON_WARN = `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

const STATUS_UI = {
  essential: { cls: 'v-essential', icon: ICON_WARN, head: 'Essential entity — NIS2 applies' },
  important: { cls: 'v-important', icon: ICON_WARN, head: 'Important entity — NIS2 applies' },
  'likely-out': { cls: 'v-likely-out', icon: ICON_OK, head: 'Likely out of scope' },
  edge: { cls: 'v-edge', icon: ICON_WARN, head: 'Scope unclear — verify' },
};

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
  return {
    sectorId: $('#sector').value || null,
    subsectorId: sector ? (sector.subsectors.length > 1 ? $('#subsector').value : sector.subsectors[0].id) : null,
    sizeBand: document.querySelector('input[name="sizeBand"]:checked')?.value ?? null,
    captures: $$('input[name="captures"]:checked').map((i) => i.value),
  };
};

const list = (items) => {
  const ul = document.createElement('ul');
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  }
  return ul;
};

const renderVerdict = (result) => {
  const out = $('#out');
  out.replaceChildren();
  const ui = STATUS_UI[result.status] ?? STATUS_UI.edge;

  const wrap = document.createElement('div');
  wrap.className = `verdict ${ui.cls}`;
  wrap.style.margin = '0';
  wrap.innerHTML = ui.icon; // static SVG string — no user input

  const body = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = ui.head;
  body.appendChild(h3);

  if (result.reasons?.length) body.appendChild(list(result.reasons));
  if (result.obligations?.length) {
    const h4 = document.createElement('h4');
    h4.textContent = 'What you owe';
    body.appendChild(h4);
    body.appendChild(list(result.obligations));
  }

  wrap.appendChild(body);
  out.appendChild(wrap);
};

const showError = (message) => {
  const out = $('#out');
  out.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'verdict v-edge';
  wrap.style.margin = '0';
  wrap.innerHTML = ICON_WARN; // static SVG string
  const body = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = 'Could not load the quiz';
  const p = document.createElement('p');
  p.textContent = `The question data could not be loaded (${message}). The summary below still lists what an in-scope company owes.`;
  body.append(h3, p);
  wrap.appendChild(body);
  out.appendChild(wrap);
};

$('#sector').addEventListener('change', () => {
  const sector = data?.sectors.find((s) => s.id === $('#sector').value) ?? null;
  renderSubsector(sector);
});

$('#quiz').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!data) return;
  renderVerdict(evaluate(collect(), data));
});

const init = async () => {
  try {
    const res = await fetch('./nis2-data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    renderSectors();
    renderSubsector(null);
    renderSizeBands();
    renderCaptures();
    $('#eval').disabled = false;
  } catch (err) {
    showError(esc(err.message));
  }
};

init();
