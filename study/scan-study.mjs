#!/usr/bin/env node
/**
 * ClearLabel Article 50 base-rate study.
 * Scans a stratified sample of EU-ccTLD domains for conversational-AI vendors
 * and AI-disclosure wording. Homepage first; if no vendor is found, tries a
 * small number of country-appropriate contact/help paths, because that is
 * where chat widgets usually live.
 */
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { scanHtml } from '../scanner/core.mjs';

const DB = JSON.parse(await readFile(new URL('../data/vendors.json', import.meta.url), 'utf8'));
const TIMEOUT_MS = 15000;
const CONCURRENCY = 12;
const UA = 'ClearLabelBot/1.0 (+https://clearlabel.eu; EU AI Act Art.50 transparency research)';
const OUT = new URL('./results.jsonl', import.meta.url);

/** Contact/help paths worth trying, by ccTLD. Kept to three to limit load. */
const PATHS = {
  de: ['/kontakt', '/hilfe', '/service'], at: ['/kontakt', '/hilfe', '/service'],
  fr: ['/contact', '/aide', '/nous-contacter'], be: ['/contact', '/help', '/kontakt'],
  nl: ['/contact', '/klantenservice', '/help'], es: ['/contacto', '/ayuda', '/atencion-al-cliente'],
  it: ['/contatti', '/assistenza', '/aiuto'], pt: ['/contato', '/contactos', '/ajuda'],
  pl: ['/kontakt', '/pomoc', '/obsluga-klienta'], se: ['/kontakt', '/hjalp', '/kundservice'],
  dk: ['/kontakt', '/hjaelp', '/kundeservice'], fi: ['/yhteystiedot', '/asiakaspalvelu', '/ohje'],
  cz: ['/kontakt', '/napoveda', '/podpora'], sk: ['/kontakt', '/pomoc', '/podpora'],
  hu: ['/kapcsolat', '/segitseg', '/ugyfelszolgalat'], ro: ['/contact', '/ajutor', '/suport'],
  gr: ['/contact', '/epikoinonia', '/help'], bg: ['/contact', '/kontakti', '/pomosht'],
  hr: ['/kontakt', '/pomoc', '/podrska'], si: ['/kontakt', '/pomoc', '/podpora'],
  lt: ['/kontaktai', '/pagalba', '/contact'], lv: ['/kontakti', '/palidziba', '/contact'],
  ee: ['/kontakt', '/abi', '/contact'], ie: ['/contact', '/help', '/support'],
  lu: ['/contact', '/kontakt', '/aide'], eu: ['/contact', '/help', '/support'],
};
const DEFAULT_PATHS = ['/contact', '/help', '/support'];

const fetchPage = async (url, extraHeaders = {}) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow', signal: c.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', ...extraHeaders },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    // Some sites mislabel HTML as text/plain; judge by body, not by header.
    const body = await res.text();
    if (!/<\s*(html|head|body|script|div)\b/i.test(body)) {
      return { ok: false, error: `not html (${(res.headers.get('content-type') || '?').slice(0, 24)})` };
    }
    return { ok: true, html: body };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : (e.cause?.code || e.message).slice(0, 40) };
  } finally { clearTimeout(t); }
};

const readerFetch = (url) => fetchPage(`https://r.jina.ai/${url}`, { 'x-respond-with': 'html' });

const scanUrl = async (url, useReader) => {
  let page = await fetchPage(url);
  if (!page.ok && useReader) page = await readerFetch(url);
  if (!page.ok) return { ok: false, error: page.error };
  return { ok: true, ...scanHtml(page.html, DB) };
};

const merge = (acc, r, path) => {
  const seen = new Set(acc.vendors.map((v) => v.id));
  const fresh = r.vendors.filter((v) => !seen.has(v.id)).map((v) => ({ ...v, foundOn: path }));
  return {
    vendors: [...acc.vendors, ...fresh],
    disclosures: [...acc.disclosures, ...r.disclosures.filter((d) => !acc.disclosures.some((x) => x.lang === d.lang))],
    contentSignals: [...acc.contentSignals, ...r.contentSignals.filter((c) => !acc.contentSignals.some((x) => x.id === c.id))],
    pagesRead: [...acc.pagesRead, path],
  };
};

const studyOne = async ({ rank, domain, cctld }) => {
  const base = `https://${domain}`;
  const home = await scanUrl(base + '/', true);
  if (!home.ok) return { rank, domain, cctld, ok: false, error: home.error };

  let acc = merge({ vendors: [], disclosures: [], contentSignals: [], pagesRead: [] }, home, '/');

  // Only spend extra requests when the homepage showed nothing.
  if (acc.vendors.length === 0) {
    for (const p of (PATHS[cctld] || DEFAULT_PATHS)) {
      const r = await scanUrl(base + p, false);
      if (r.ok) {
        acc = merge(acc, r, p);
        if (acc.vendors.length > 0) break;
      }
    }
  }
  const nature = acc.vendors.some((v) => v.aiNature === 'ai-native') ? 'ai-native'
    : acc.vendors.some((v) => v.aiNature === 'ai-optional') ? 'ai-optional'
    : acc.vendors.some((v) => v.aiNature === 'rule-based') ? 'rule-based' : null;

  return {
    rank, domain, cctld, ok: true,
    pagesRead: acc.pagesRead,
    vendors: acc.vendors.map((v) => ({ id: v.id, name: v.name, aiNature: v.aiNature, foundOn: v.foundOn })),
    hasVendor: acc.vendors.length > 0,
    strongestNature: nature,
    hasDisclosure: acc.disclosures.length > 0,
    disclosureLangs: acc.disclosures.map((d) => d.lang),
    hasContentMarking: acc.contentSignals.length > 0,
  };
};

const rows = (await readFile(new URL('./sample.csv', import.meta.url), 'utf8'))
  .trim().split('\n').slice(1)
  .map((l) => { const [rank, domain, cctld] = l.split(','); return { rank: +rank, domain, cctld }; });

await writeFile(OUT, '');
let done = 0;
let cursor = 0;
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < rows.length) {
    const row = rows[cursor++];
    let res;
    try { res = await studyOne(row); }
    catch (e) { res = { ...row, ok: false, error: `crash: ${e.message}`.slice(0, 60) }; }
    await appendFile(OUT, JSON.stringify(res) + '\n');
    if (++done % 25 === 0) console.log(`  ${done}/${rows.length}`);
  }
});
await Promise.all(workers);
console.log(`DONE ${done}/${rows.length}`);
process.exit(0);
