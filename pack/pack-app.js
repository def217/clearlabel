import { scanHtml } from '../scanner/core.mjs';
import { buildPack } from '../scanner/pack.mjs';
import { makeZip } from '../scanner/zip.mjs';

/* Live product. STORE_LIVE flips to true once payouts are connected and the
   product is published on Gumroad - that is the only remaining switch. */
const GUMROAD_PRODUCT_ID = '0EQRheFtJ8PMpFMR34QXJQ==';
const STORE_URL = 'https://killermind1.gumroad.com/l/article-50-compliance-pack';
const STORE_LIVE = false;

const READERS = [
  (url) => [`https://r.jina.ai/${url}`, { 'x-respond-with': 'html' }],
  (url) => [`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, {}],
];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const say = (html) => { $('#pout').innerHTML = html; };
const note = (kind, head, body) =>
  `<div class="verdict v-${kind}" style="margin:14px 0 0"><div class="vi">${kind === 'likely-ok' ? '\u{2705}' : '\u{26A0}\u{FE0F}'}</div>
   <div><h3>${esc(head)}</h3><p>${body}</p></div></div>`;

const normalise = (raw) => {
  const t = (raw || '').trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.includes('.') ? u.toString() : null;
  } catch { return null; }
};

const readPage = async (url) => {
  for (const build of READERS) {
    const [endpoint, headers] = build(url);
    try {
      const res = await fetch(endpoint, { headers, redirect: 'follow' });
      if (!res.ok) continue;
      const body = await res.text();
      if (body.length > 200 && /<\s*(script|html|body|head|div)\b/i.test(body)) return body;
    } catch { /* try the next reader */ }
  }
  return null;
};

const download = (blob, filename) => {
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
};

const verifyLicence = async (key) => {
  if (!GUMROAD_PRODUCT_ID) return { ok: false, reason: 'store-not-open' };
  const body = new URLSearchParams({ product_id: GUMROAD_PRODUCT_ID, license_key: key.trim(), increment_uses_count: 'false' });
  try {
    const res = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body });
    const json = await res.json();
    return json.success ? { ok: true } : { ok: false, reason: 'invalid' };
  } catch (err) {
    return { ok: false, reason: `network: ${err.message}` };
  }
};

const deliver = async (url, filenameHint) => {
  const db = await (await fetch('../data/vendors.json')).json();
  const html = await readPage(url);
  if (!html) throw new Error('Could not read that page. Some sites block automated reads.');
  const scan = { url, scannedAt: new Date().toISOString(), ...scanHtml(html, db) };
  const zip = makeZip(buildPack(scan));
  download(zip, `clearlabel-article50-pack-${filenameHint}.zip`);
  return scan;
};

$('#packform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = normalise($('#psite').value);
  const key = $('#pkey').value.trim();
  if (!url) return say(note('check-required', 'That does not look like a web address', 'Try <code>yourshop.de/contact</code>.'));

  $('#pgo').disabled = true;
  $('#pgo').innerHTML = '<span class="spin"></span>Working';
  try {
    const lic = await verifyLicence(key);
    if (!lic.ok) {
      say(
        !STORE_LIVE
          ? note('check-required', 'The storefront is not open yet', 'Licence keys cannot be checked until checkout is live. The <strong>free sample pack below is the complete document set</strong> — build it against a demo scan and see exactly what you would receive.')
          : note('check-required', 'That licence key was not accepted', `Check it against your receipt${STORE_URL ? `, or <a href="${STORE_URL}">buy a licence</a>` : ''}.`)
      );
      return;
    }
    const scan = await deliver(url, new URL(url).hostname);
    say(note('likely-ok', 'Pack downloaded', `Built from a live scan of <code>${esc(url)}</code>. ${scan.vendors.length} vendor(s) detected and pre-filled into your register and implementation steps.`));
  } catch (err) {
    say(note('check-required', 'Could not build the pack', esc(err.message)));
  } finally {
    $('#pgo').disabled = false;
    $('#pgo').textContent = 'Build my pack';
  }
});

$('#sample').addEventListener('click', async () => {
  const btn = $('#sample');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin" style="border-color:var(--line);border-top-color:var(--accent)"></span>Building sample';
  try {
    const demo = {
      url: 'https://example-shop.eu/contact',
      scannedAt: new Date().toISOString(),
      vendors: [
        { id: 'zendesk', name: 'Zendesk / Zopim', aiNature: 'ai-optional', aiProduct: 'Zendesk AI agents', vendorDocs: 'https://support.zendesk.com', consolePath: 'Admin Center → Channels → Messaging → your Web Widget → Responses → bot name and greeting.', note: 'Zendesk AI agents are enabled per-brand. Check each brand separately.' },
        { id: 'chatbase', name: 'Chatbase', aiNature: 'ai-native', vendorDocs: 'https://www.chatbase.co/docs', consolePath: 'Chatbot → Settings → Chat Interface → Display name and Initial messages.', note: 'Chatbase is an LLM agent by definition. Article 50(1) applies.' },
      ],
      disclosures: [],
      contentSignals: [],
      overall: 'action-required',
      findings: [],
    };
    download(makeZip(buildPack(demo)), 'clearlabel-article50-SAMPLE-pack.zip');
    say(note('likely-ok', 'Sample pack downloaded', 'This is the full document set. A real pack is identical but generated from your own site, with your own vendors pre-filled.'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download a sample pack (.zip)';
  }
});
