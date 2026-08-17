/* Turns a scan result into the HTML shown under the scanner band. Pure string
   builders, no DOM access and no fetching — app.js owns both. Class names here
   are styled by home-scan.css. */

/* Sample wording offered free on the homepage; the paid pack ships the full set
   per vendor. Kept in sync by hand with scanner/pack.mjs. */
export const DISCLOSURE = {
  en: "You're chatting with an AI assistant. It can make mistakes — ask for a human at any time.",
  de: 'Sie chatten mit einem KI-Assistenten. Er kann Fehler machen — fragen Sie jederzeit nach einem Menschen.',
  fr: 'Vous discutez avec un assistant IA. Il peut se tromper — demandez un conseiller humain à tout moment.',
  es: 'Estás hablando con un asistente de IA. Puede cometer errores — pide hablar con una persona cuando quieras.',
  it: 'Stai parlando con un assistente IA. Può commettere errori — puoi chiedere un operatore umano in qualsiasi momento.',
  nl: 'Je chat met een AI-assistent. Deze kan fouten maken — vraag altijd om een medewerker.',
};

const ICON = {
  warn: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  query: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
};

const svg = (paths) =>
  `<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const VERDICT_COPY = {
  'action-required': {
    icon: svg(ICON.warn),
    head: 'Action required',
    sub: 'We found an AI system a visitor can talk to, and no disclosure wording anywhere in the page copy.',
  },
  'check-required': {
    icon: svg(ICON.query),
    head: 'Check required',
    sub: 'Something here depends on settings we cannot see from outside. Confirm it, then write down what you confirmed.',
  },
  'likely-ok': {
    icon: svg(ICON.ok),
    head: 'No obvious gap on this page',
    sub: 'Disclosure wording is present. Confirm it appears at first interaction, inside the chat window itself.',
  },
  'no-signal': {
    icon: svg(ICON.search),
    head: 'Nothing detected on this page',
    sub: 'No known AI chat vendor was fingerprinted here. Try your /contact or /help page — that is where widgets usually live.',
  },
};

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const vendorRows = (vendors) =>
  vendors
    .map(
      (v) => `<tr>
        <td><strong>${esc(v.name)}</strong>${v.aiProduct ? `<br><span class="result-note">AI product: ${esc(v.aiProduct)}</span>` : ''}</td>
        <td>${esc(v.aiNature)}</td>
        <td><code>${esc(v.matchedOn)}</code></td>
        <td>${esc(v.disclosureHook)}</td>
      </tr>`
    )
    .join('');

/** The free sample: wording the visitor can paste into the vendor we just found. */
const sample = (vendors) => {
  const primary = vendors[0];
  if (!primary) return '';
  const rows = Object.entries(DISCLOSURE)
    .map(([lang, text]) => `<tr><td class="sample-lang"><code>${lang}</code></td><td>${esc(text)}</td></tr>`)
    .join('');
  return `<div class="finding accent">
      <div class="meta"><span class="pill art">Free sample</span></div>
      <h4>Disclosure wording you can paste into ${esc(primary.name)} today</h4>
      <p>Set this as the assistant's opening message. Placement for this vendor: <em>${esc(primary.disclosureHook)}</em>.</p>
      <div class="tablewrap sample-table"><table>${rows}</table></div>
      <button class="btn ghost" type="button" id="copy-sample">Copy English version</button>
    </div>`;
};

const findingCards = (findings) =>
  findings
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

const disclosureCard = (disclosures) =>
  disclosures.length
    ? `<div class="finding"><div class="meta"><span class="pill">disclosure wording found</span></div>
        <h4>Matched in: ${disclosures.map((d) => esc(d.lang)).join(', ')}</h4>
        <p>Nearest context: &ldquo;&hellip;${esc(disclosures[0].context)}&hellip;&rdquo;</p></div>`
    : '';

/* Offered, never run automatically: each extra page spends the shared free-proxy
   rate limit. 69% is the Tranco frame (703 sites), which is where that figure
   comes from — do not pair it with the 883-site combined total. */
const deepScanCard = `<div class="finding accent">
      <h4>Widgets are usually not on the homepage</h4>
      <p>In our scan of 703 Tranco-ranked EU sites, <strong>69% of chat widgets were found on a contact or help page</strong>, not the homepage. Worth checking those before concluding you have none.</p>
      <button class="btn ghost" type="button" id="deep-scan">Also check /contact, /kontakt and /help</button>
    </div>`;

const alsoRead = (pagesRead) =>
  pagesRead && pagesRead.length > 1
    ? ` — also checked ${pagesRead.slice(1).map((p) => `<code>${esc(p)}</code>`).join(', ')}`
    : '';

export const renderDetail = (url, result) => {
  const v = VERDICT_COPY[result.overall];
  const table = result.vendors.length
    ? `<div class="detected"><h3>Detected on this page</h3><div class="tablewrap"><table>
        <thead><tr><th>Vendor</th><th>AI nature</th><th>Matched</th><th>Where the disclosure goes</th></tr></thead>
        <tbody>${vendorRows(result.vendors)}</tbody></table></div></div>`
    : '';

  return `<div class="verdict v-${esc(result.overall)}">
      ${v.icon}
      <div><h3>${esc(v.head)}</h3><p>${esc(v.sub)}</p>
      <p class="result-note">Scanned: <code>${esc(url)}</code>${alsoRead(result.pagesRead)}</p></div>
    </div>
    ${findingCards(result.findings)}${disclosureCard(result.disclosures)}${sample(result.vendors)}${table}
    ${result.vendors.length === 0 ? deepScanCard : ''}
    <p class="hint">Page-source heuristics, not an audit or a legal opinion. It cannot see inside your vendor console or open your chat widget.</p>`;
};

export const renderProblem = (head, detail) =>
  `<div class="verdict v-check-required">${svg(ICON.warn)}<div><h3>${esc(head)}</h3><p>${detail}</p></div></div>`;
