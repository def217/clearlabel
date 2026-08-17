import { scanHtml, assess } from './scanner/core.mjs';
import { renderDetail, renderProblem, DISCLOSURE, esc } from './scan-render.js';

/* Checkout target. STORE_LIVE gates the CTA: flip to false to take the store
   offline without removing the wiring. */
const CHECKOUT_URL = 'https://clearlabel.gumroad.com/l/article-50-compliance-pack';
const STORE_LIVE = true;

/* Readers must return RAW HTML: vendor fingerprints live in <script src>, and a
   markdown-rendering reader silently strips exactly the evidence we need.
   More than one provider because the free tiers rate-limit. */
const READERS = [
  {
    build: (url) => [`https://r.jina.ai/${url}`, { 'x-respond-with': 'html' }],
    unwrap: (body) => body,
  },
  {
    build: (url) => [`https://www.whateverorigin.org/get?url=${encodeURIComponent(url)}`, {}],
    unwrap: (body) => {
      try { return JSON.parse(body).contents ?? ''; } catch { return ''; }
    },
  },
  {
    build: (url) => [`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {}],
    unwrap: (body) => body,
  },
];

/* Chat widgets usually live on a contact or help page rather than the homepage,
   so we offer to follow a few likely paths - on request, not automatically,
   because every extra fetch spends a shared rate limit. */
const FALLBACK_PATHS = ['/contact', '/kontakt', '/help', '/support', '/contacto', '/contatti'];
const MAX_FALLBACKS = 3;

/* Findings the visitor has to do something about, as opposed to ones that only
   confirm the page is fine. Drives the count in the output panel. */
const ACTIONABLE = new Set(['action-required', 'check-required']);

const $ = (sel) => document.querySelector(sel);

const normalise = (raw) => {
  const t = raw.trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
};

const fetchThroughReader = async (url) => {
  const errors = [];
  for (const reader of READERS) {
    const [endpoint, headers] = reader.build(url);
    try {
      const res = await fetch(endpoint, { redirect: 'follow', headers });
      if (!res.ok) {
        errors.push(res.status === 429 ? 'reader busy (429)' : `HTTP ${res.status}`);
        continue;
      }
      const body = reader.unwrap(await res.text());
      if (body && body.length > 200 && /<\s*(script|html|body|head|div)\b/i.test(body)) {
        return { ok: true, body };
      }
      errors.push(body && body.length > 200 ? 'reader returned text, not HTML' : 'empty response');
    } catch (err) {
      errors.push(err.message || 'network error');
    }
  }
  return { ok: false, error: errors.join('; ') };
};

/** Combine findings from several pages of the same site without duplicating vendors. */
const mergeScans = (acc, next, path) => {
  const seen = new Set(acc.vendors.map((v) => v.id));
  return {
    ...acc,
    vendors: [...acc.vendors, ...next.vendors.filter((v) => !seen.has(v.id)).map((v) => ({ ...v, foundOn: path }))],
    disclosures: [...acc.disclosures, ...next.disclosures.filter((d) => !acc.disclosures.some((x) => x.lang === d.lang))],
    contentSignals: [...acc.contentSignals, ...next.contentSignals.filter((c) => !acc.contentSignals.some((x) => x.id === c.id))],
    pagesRead: [...acc.pagesRead, path],
  };
};

/** Paths worth trying on this origin, skipping the one already scanned. */
const fallbacksFor = (url) => {
  const u = new URL(url);
  const already = u.pathname.replace(/\/$/, '');
  return FALLBACK_PATHS.filter((p) => p !== already).slice(0, MAX_FALLBACKS).map((p) => ({ path: p, href: `${u.origin}${p}` }));
};

const setPhase = (phase) => { $('#scan-phase').textContent = phase; };

const setCheck = (row, text) => {
  const status = $(`#${row} .check-status`);
  if (status) status.textContent = text;
};

const setAllChecks = (text) => {
  setCheck('check-vendor', text);
  setCheck('check-disclosure', text);
  setCheck('check-marking', text);
};

const setBusy = (busy) => {
  const btn = $('#scan-submit');
  btn.disabled = busy;
  btn.innerHTML = busy ? '<span class="spin"></span>Scanning' : 'Scan again';
};

const showDetail = (html) => {
  $('#scan-detail-body').innerHTML = html;
  $('#scan-detail').hidden = false;
};

const panelIdle = () => {
  setPhase('idle');
  setAllChecks('—');
  $('#scan-result').hidden = true;
  $('#scan-idle-strip').hidden = false;
};

const panelStart = () => {
  setPhase('running');
  setAllChecks('queued');
  $('#scan-result').hidden = true;
  $('#scan-idle-strip').hidden = false;
  $('#scan-detail').hidden = true;
};

const panelFailed = () => {
  setPhase('failed');
  setAllChecks('—');
  $('#scan-result').hidden = true;
  $('#scan-idle-strip').hidden = false;
};

/** Every number here comes out of the real scan result; nothing is invented. */
const panelComplete = (result) => {
  setCheck('check-vendor', result.vendors.length ? `${result.vendors.length} found` : 'none found');
  setCheck(
    'check-disclosure',
    result.disclosures.length ? `found · ${result.disclosures.map((d) => d.lang).join(' ')}` : 'none found'
  );
  setCheck('check-marking', result.contentSignals.length ? `${result.contentSignals.length} found` : 'none found');

  const actionable = result.findings.filter((f) => ACTIONABLE.has(f.status));
  $('#scan-result-issues').textContent = actionable.length;
  $('#scan-result-findings').innerHTML = result.findings
    .map(
      (f) => `<div class="scan-finding"><span class="finding-tag">${esc(f.article)}</span><span>${esc(f.title)}</span></div>`
    )
    .join('');

  $('#scan-idle-strip').hidden = true;
  $('#scan-result').hidden = false;
  setPhase('complete');
};

let vendorDb = null;
const loadDb = async () => {
  if (vendorDb) return vendorDb;
  const res = await fetch('./data/vendors.json');
  if (!res.ok) throw new Error('could not load the vendor database');
  vendorDb = await res.json();
  return vendorDb;
};

let lastResult = null;

const wireCopyButton = () => {
  const copy = $('#copy-sample');
  if (!copy) return;
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(DISCLOSURE.en);
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy English version'), 1800);
  });
};

/* The result CTA is re-rendered with every scan, so it is re-wired alongside
   the copy button rather than once at startup. */
const wireResultBuy = () => {
  const btn = $('#result-buy');
  if (btn) btn.addEventListener('click', onBuy);
};

/** Runs the extra contact/help pages only when the visitor asks for it. */
const wireDeepScan = (db) => {
  const btn = $('#deep-scan');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    setPhase('running');
    setAllChecks('reading…');
    let acc = lastResult;
    for (const { path, href } of fallbacksFor(lastResult.url)) {
      btn.innerHTML = `<span class="spin"></span>Checking ${esc(path)}`;
      const extra = await fetchThroughReader(href);
      if (!extra.ok) continue;
      acc = mergeScans(acc, scanHtml(extra.body, db), path);
      if (acc.vendors.length > 0) break;
    }
    lastResult = { ...acc, ...assess(acc) };
    showDetail(renderDetail(lastResult.url, lastResult));
    panelComplete(lastResult);
    wireCopyButton();
    wireResultBuy();
    wireDeepScan(db);
  });
};

const onSubmit = async (event) => {
  event.preventDefault();
  const url = normalise($('#scan-url').value);
  if (!url) {
    panelIdle();
    showDetail(
      renderProblem(
        'That does not look like a web address',
        'Try something like <code>yourshop.de</code> or <code>yourshop.de/contact</code>.'
      )
    );
    return;
  }

  setBusy(true);
  panelStart();
  try {
    const db = await loadDb();
    setAllChecks('reading…');
    const page = await fetchThroughReader(url);
    if (!page.ok) {
      panelFailed();
      showDetail(
        renderProblem(
          'Could not read that page',
          `${esc(page.error)}. Some sites block automated reads. You can still check by hand: open the page, view source, and search it for your chat vendor's script.`
        )
      );
      return;
    }

    lastResult = { url, ...scanHtml(page.body, db), pagesRead: [new URL(url).pathname || '/'] };
    showDetail(renderDetail(url, lastResult));
    panelComplete(lastResult);
    wireCopyButton();
    wireResultBuy();
    wireDeepScan(db);
  } catch (err) {
    panelFailed();
    showDetail(renderProblem('Scan failed', esc(err.message)));
  } finally {
    setBusy(false);
  }
};

const onBuy = () => {
  if (STORE_LIVE && CHECKOUT_URL) {
    const q = lastResult ? `?site=${encodeURIComponent(lastResult.url)}` : '';
    window.location.href = `${CHECKOUT_URL}${q}`;
    return;
  }
  $('#buynote').innerHTML =
    'Checkout opens shortly. Nothing is charged and no email is collected here. ' +
    'Meanwhile you can <a href="./pack/">build the complete sample pack</a> — all eight documents, free — ' +
    'and the scan and full rule breakdown on this page stay free either way.';
};

$('#scan-form').addEventListener('submit', onSubmit);
$('#buy').addEventListener('click', onBuy);
