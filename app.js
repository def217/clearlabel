import { scanHtml, assess, STATUS } from './scanner/core.mjs';

/* Checkout target. STORE_LIVE gates the CTA: flip to false to take the store
   offline without removing the wiring. */
const CHECKOUT_URL = 'https://clearlabel.gumroad.com/l/article-50-compliance-pack';
const STORE_LIVE = true;

const DEADLINE_LIVE = Date.UTC(2026, 7, 2);   // Art.50(1) applied
const DEADLINE_MARK = Date.UTC(2026, 11, 2);  // Art.50(2) machine-readable marking
const DAY = 86400000;

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

const $ = (sel) => document.querySelector(sel);

const VERDICT_COPY = {
  [STATUS.ACTION_REQUIRED]: {
    icon: `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    head: 'Action required',
    sub: 'We found an AI system a visitor can talk to, and no disclosure wording anywhere in the page copy.',
  },
  [STATUS.CHECK_REQUIRED]: {
    icon: `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
    head: 'Check required',
    sub: 'Something here depends on settings we cannot see from outside. Confirm it, then write down what you confirmed.',
  },
  [STATUS.LIKELY_OK]: {
    icon: `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>`,
    head: 'No obvious gap on this page',
    sub: 'Disclosure wording is present. Confirm it appears at first interaction, inside the chat window itself.',
  },
  [STATUS.NO_SIGNAL]: {
    icon: `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
    head: 'Nothing detected on this page',
    sub: 'No known AI chat vendor was fingerprinted here. Try your /contact or /help page — that is where widgets usually live.',
  },
};

const DISCLOSURE = {
  en: "You're chatting with an AI assistant. It can make mistakes — ask for a human at any time.",
  de: 'Sie chatten mit einem KI-Assistenten. Er kann Fehler machen — fragen Sie jederzeit nach einem Menschen.',
  fr: "Vous discutez avec un assistant IA. Il peut se tromper — demandez un conseiller humain à tout moment.",
  es: 'Estás hablando con un asistente de IA. Puede cometer errores — pide hablar con una persona cuando quieras.',
  it: 'Stai parlando con un assistente IA. Può commettere errori — puoi chiedere un operatore umano in qualsiasi momento.',
  nl: 'Je chat met een AI-assistent. Deze kan fouten maken — vraag altijd om een medewerker.',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const daysBetween = (a, b) => Math.round((a - b) / DAY);

const paintCounters = () => {
  const now = Date.now();
  const live = daysBetween(now, DEADLINE_LIVE);
  const due = daysBetween(DEADLINE_MARK, now);
  $('#c-live').textContent = live > 0 ? live : 0;
  $('#c-due').textContent = due > 0 ? due : 'passed';
  const inline = $('#c-due-inline');
  if (inline) inline.textContent = due > 0 ? `${due} days away` : 'now passed';
};

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

const renderVendorRows = (vendors) =>
  vendors
    .map(
      (v) => `<tr>
        <td><strong>${esc(v.name)}</strong>${v.aiProduct ? `<br><span style="color:var(--muted);font-size:.86em">AI product: ${esc(v.aiProduct)}</span>` : ''}</td>
        <td>${esc(v.aiNature)}</td>
        <td><code>${esc(v.matchedOn)}</code></td>
        <td>${esc(v.disclosureHook)}</td>
      </tr>`
    )
    .join('');

const renderSample = (vendors) => {
  const primary = vendors[0];
  if (!primary) return '';
  const rows = Object.entries(DISCLOSURE)
    .map(([lang, text]) => `<tr><td style="width:52px"><code>${lang}</code></td><td>${esc(text)}</td></tr>`)
    .join('');
  return `<div class="finding" style="border-color:var(--accent)">
      <div class="meta"><span class="pill art">Free sample</span></div>
      <h4>Disclosure wording you can paste into ${esc(primary.name)} today</h4>
      <p style="margin-bottom:10px">Set this as the assistant's opening message. Placement for this vendor: <em>${esc(primary.disclosureHook)}</em>.</p>
      <div class="tablewrap"><table style="width:100%;border-collapse:collapse;font-size:.9rem">${rows}</table></div>
      <button class="btn ghost" type="button" id="copy-sample" style="margin-top:12px">Copy English version</button>
    </div>`;
};

const render = (url, result) => {
  const v = VERDICT_COPY[result.overall];
  const findings = result.findings
    .map(
      (f) => `<div class="finding">
        <div class="meta">
          <span class="pill art">Art. ${esc(f.article)}</span>
          <span class="pill s-${esc(f.status)}">${esc(f.status.replace('-', ' '))}</span>
          <span class="pill">confidence: ${esc(f.confidence)}</span>
        </div>
        <h4>${esc(f.title)}</h4>
        <p>${esc(f.detail)}</p>
      </div>`
    )
    .join('');

  const table = result.vendors.length
    ? `<div class="detected"><h3>Detected on this page</h3><div class="tablewrap"><table>
        <thead><tr><th>Vendor</th><th>AI nature</th><th>Matched</th><th>Where the disclosure goes</th></tr></thead>
        <tbody>${renderVendorRows(result.vendors)}</tbody></table></div></div>`
    : '';

  const found = result.disclosures.length
    ? `<div class="finding"><div class="meta"><span class="pill">disclosure wording found</span></div>
        <h4>Matched in: ${result.disclosures.map((d) => esc(d.lang)).join(', ')}</h4>
        <p>Nearest context: &ldquo;&hellip;${esc(result.disclosures[0].context)}&hellip;&rdquo;</p></div>`
    : '';

  return `<div class="verdict v-${esc(result.overall)}">
      ${v.icon}
      <div><h3>${esc(v.head)}</h3><p>${esc(v.sub)}</p>
      <p style="margin-top:6px;font-size:.85rem;color:var(--muted)">Scanned: <code>${esc(url)}</code>${
      result.pagesRead && result.pagesRead.length > 1
        ? ` — also checked ${result.pagesRead.slice(1).map((p) => `<code>${esc(p)}</code>`).join(', ')}`
        : ''
    }</p></div>
    </div>
    ${findings}${found}${renderSample(result.vendors)}${table}
    ${
      result.vendors.length === 0
        ? `<div class="finding" style="border-color:var(--accent)">
             <h4 style="margin-bottom:6px">Widgets are usually not on the homepage</h4>
             <p style="margin-bottom:11px">In our scan of 703 EU sites, <strong>69% of chat widgets were found on a contact or help page</strong>, not the homepage. Worth checking those before concluding you have none.</p>
             <button class="btn ghost" type="button" id="deep-scan">Also check /contact, /kontakt and /help</button>
           </div>`
        : ''
    }
    <p class="hint" style="padding:14px 0 0">Page-source heuristics, not an audit or a legal opinion. It cannot see inside your vendor console or open your chat widget.</p>`;
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

const setBusy = (busy) => {
  const btn = $('#go');
  btn.disabled = busy;
  btn.innerHTML = busy ? '<span class="spin"></span>Scanning' : 'Scan free';
};

const showRaw = (html) => {
  const out = $('#out');
  out.className = 'on';
  out.innerHTML = html;
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

const progress = (text) =>
  showRaw(`<p style="color:var(--muted);margin:0"><span class="spin" style="border-color:var(--line);border-top-color:var(--accent)"></span>${esc(text)}</p>`);

/** Runs the extra contact/help pages only when the visitor asks for it. */
const wireDeepScan = (db) => {
  const btn = $('#deep-scan');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    let acc = lastResult;
    for (const { path, href } of fallbacksFor(lastResult.url)) {
      btn.innerHTML = `<span class="spin"></span>Checking ${esc(path)}`;
      const extra = await fetchThroughReader(href);
      if (!extra.ok) continue;
      acc = mergeScans(acc, scanHtml(extra.body, db), path);
      if (acc.vendors.length > 0) break;
    }
    lastResult = { ...acc, ...assess(acc) };
    showRaw(render(lastResult.url, lastResult));
    wireCopyButton();
    wireDeepScan(db);
  });
};

const onSubmit = async (event) => {
  event.preventDefault();
  const url = normalise($('#url').value);
  if (!url) {
    showRaw('<div class="verdict v-check-required"><svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg><div><h3>That does not look like a web address</h3><p>Try something like <code>yourshop.de</code> or <code>yourshop.de/contact</code>.</p></div></div>');
    return;
  }
  setBusy(true);
  progress('Fetching the page and fingerprinting vendors…');
  try {
    const db = await loadDb();
    const page = await fetchThroughReader(url);
    if (!page.ok) {
      showRaw(`<div class="verdict v-no-signal"><svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg><div><h3>Could not read that page</h3>
        <p>${esc(page.error)}. Some sites block automated reads. You can still check by hand: open the page, view source, and search it for your chat vendor's script.</p></div></div>`);
      return;
    }

    const first = scanHtml(page.body, db);
    const combined = { ...first, pagesRead: [new URL(url).pathname || '/'] };

    lastResult = { url, ...combined };
    showRaw(render(url, lastResult));
    wireCopyButton();
    wireDeepScan(db);
  } catch (err) {
    showRaw(`<div class="verdict v-no-signal"><svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg><div><h3>Scan failed</h3><p>${esc(err.message)}</p></div></div>`);
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

paintCounters();
$('#form').addEventListener('submit', onSubmit);
$('#buy').addEventListener('click', onBuy);
