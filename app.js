import { scanHtml, STATUS } from './scanner/core.mjs';

/* Checkout target. STORE_LIVE gates the CTA: flip to false to take the store
   offline without removing the wiring. */
const CHECKOUT_URL = 'https://clearlabel.gumroad.com/l/article-50-compliance-pack';
const STORE_LIVE = true;

const DEADLINE_LIVE = Date.UTC(2026, 7, 2);   // Art.50(1) applied
const DEADLINE_MARK = Date.UTC(2026, 11, 2);  // Art.50(2) machine-readable marking
const DAY = 86400000;

/* Readers must return RAW HTML: vendor fingerprints live in <script src>, and a
   markdown-rendering reader silently strips exactly the evidence we need. */
const READERS = [
  (url) => [`https://r.jina.ai/${url}`, { 'x-respond-with': 'html' }],
  (url) => [`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, {}],
  (url) => [`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {}],
];

const $ = (sel) => document.querySelector(sel);

const VERDICT_COPY = {
  [STATUS.ACTION_REQUIRED]: {
    icon: '\u{1F534}',
    head: 'Action required',
    sub: 'We found an AI system a visitor can talk to, and no disclosure wording anywhere in the page copy.',
  },
  [STATUS.CHECK_REQUIRED]: {
    icon: '\u{1F7E0}',
    head: 'Check required',
    sub: 'Something here depends on settings we cannot see from outside. Confirm it, then write down what you confirmed.',
  },
  [STATUS.LIKELY_OK]: {
    icon: '\u{1F7E2}',
    head: 'No obvious gap on this page',
    sub: 'Disclosure wording is present. Confirm it appears at first interaction, inside the chat window itself.',
  },
  [STATUS.NO_SIGNAL]: {
    icon: '\u{26AA}',
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
  for (const build of READERS) {
    const [endpoint, headers] = build(url);
    try {
      const res = await fetch(endpoint, { redirect: 'follow', headers });
      if (!res.ok) {
        errors.push(`HTTP ${res.status}`);
        continue;
      }
      const body = await res.text();
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
      <div class="vi">${v.icon}</div>
      <div><h3>${esc(v.head)}</h3><p>${esc(v.sub)}</p>
      <p style="margin-top:6px;font-size:.85rem;color:var(--muted)">Scanned: <code>${esc(url)}</code></p></div>
    </div>
    ${findings}${found}${renderSample(result.vendors)}${table}
    <p class="hint" style="padding:14px 0 0">Page-source heuristics, not an audit or a legal opinion. It cannot see inside your vendor console or open your chat widget.</p>`;
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

const onSubmit = async (event) => {
  event.preventDefault();
  const url = normalise($('#url').value);
  if (!url) {
    showRaw('<div class="verdict v-check-required"><div class="vi">\u{26A0}\u{FE0F}</div><div><h3>That does not look like a web address</h3><p>Try something like <code>yourshop.de</code> or <code>yourshop.de/contact</code>.</p></div></div>');
    return;
  }
  setBusy(true);
  showRaw('<p style="color:var(--muted);margin:0"><span class="spin" style="border-color:var(--line);border-top-color:var(--accent)"></span>Fetching the page and fingerprinting vendors…</p>');
  try {
    const db = await loadDb();
    const page = await fetchThroughReader(url);
    if (!page.ok) {
      showRaw(`<div class="verdict v-no-signal"><div class="vi">\u{26A0}\u{FE0F}</div><div><h3>Could not read that page</h3>
        <p>${esc(page.error)}. Some sites block automated reads. You can still check by hand: open the page, view source, and search it for your chat vendor's script.</p></div></div>`);
      return;
    }
    lastResult = { url, ...scanHtml(page.body, db) };
    showRaw(render(url, lastResult));
    const copy = $('#copy-sample');
    if (copy) {
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(DISCLOSURE.en);
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy English version'), 1800);
      });
    }
  } catch (err) {
    showRaw(`<div class="verdict v-no-signal"><div class="vi">\u{26A0}\u{FE0F}</div><div><h3>Scan failed</h3><p>${esc(err.message)}</p></div></div>`);
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
