/**
 * Shared logic for verify-addresses.mjs. Pure helpers plus the single network
 * touchpoint (fetchPage) live here so the test file can import them without
 * doing any I/O. Conservative choices are flagged inline with "conservative:".
 */
import { resolveMx, resolve4 } from 'node:dns/promises';

// ---- named constants ------------------------------------------------------
const CANDIDATE_PATHS = [
  '/impressum', '/imprint', '/kontakt', '/contact', '/legal-notice',
  '/mentions-legales', '/about', '/privacy', '/privacy-policy', '/datenschutz',
];
// Contact/legal pages carry the strongest signal, so they form the top tier.
const CONTACT_PATHS = new Set([
  '/impressum', '/imprint', '/kontakt', '/contact', '/legal-notice', '/mentions-legales',
]);
const INFO_PATHS = new Set(['/about', '/privacy', '/privacy-policy', '/datenschutz']);

const MAX_FETCHES_PER_DOMAIN = 6;
const FETCH_TIMEOUT_MS = 10_000;
const SAME_DOMAIN_DELAY_MS = 1_000;
const USER_AGENT = 'ClearLabel-AddressCheck/1.0 (+https://clearlabel.eu)';

// ---- reader-proxy fallback ------------------------------------------------
// The public reader proxy (r.jina.ai) fetches pages behind bot walls and
// returns markdown/plain text. Budget and gap are per-run caps: the proxy
// rate-limits aggressively, so we never exceed them.
const PROXY_PREFIX = 'https://r.jina.ai/';
export const PROXY_MAX_REQUESTS = 30;
export const PROXY_MIN_GAP_MS = 2_000;
const PROXY_VIA = 'reader-proxy';
const CHALLENGE_BODY_MAX_BYTES = 500;
const BOT_WALL_STATUSES = new Set([403, 429, 503]);
// Lower-case markers, matched case-insensitively against a short body.
export const BOT_WALL_MARKERS = [
  'cf-challenge',
  'just a moment',
  'attention required',
  'checking your browser',
  'enable javascript',
  'please enable cookies',
  'access denied',
  'challenge-platform',
];

// Non-exhaustive; just the majors we are most likely to see on contact pages.
const FREEMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'ymail.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'gmx.net', 'web.de',
  'mail.com', 'zoho.com', 'fastmail.com', 'hey.com', 'tutanota.com', 'mail.ru',
  'yandex.com', 'yandex.ru',
]);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const EMAIL_OK_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z0-9.-]+$/;
// Capture up to the closing quote/tag; entities like &#64; live inside and are
// decoded afterwards, so '#' must NOT be excluded from the character class.
const MAILTO_RE = /<a\b[^>]*?\bhref\s*=\s*["']?\s*mailto:([^"'\s>]+)/gi;
// Local parts that are tooling, never a human inbox. Conservative: an exact
// token (or token+/-/./+ suffix) blocks the address; "no-?reply" covers "noreply".
const BLOCKED_LOCAL_RE = /^(?:no-?reply|bounce|mailer-daemon|postmaster|abuse|hostmaster|root)(?:[+.-]|$)/i;

// ---- pure helpers ---------------------------------------------------------

const localPart = (email) => String(email).slice(0, String(email).lastIndexOf('@')).toLowerCase();

const isBlocked = (email) => BLOCKED_LOCAL_RE.test(localPart(email));

const safeCodePoint = (digits, radix) => {
  const n = parseInt(digits, radix);
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
};

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', commat: '@' };

export const decodeEntities = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(h, 16))
  .replace(/&#([0-9]+);/g, (_, d) => safeCodePoint(d, 10))
  .replace(/&([a-z0-9]+);/gi, (m, n) => (n in NAMED_ENTITIES ? NAMED_ENTITIES[n] : m));

const stripScriptStyle = (html) => String(html)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

const stripTags = (html) => String(html).replace(/<[^>]*>/g, ' ');

/** Normalize the common obfuscations into a plain @/. so EMAIL_RE can match. */
const deobfuscate = (text) => String(text)
  .replace(/\s*\[at\]\s*/gi, '@').replace(/\s*\(at\)\s*/gi, '@')
  .replace(/\s*\[dot\]\s*/gi, '.').replace(/\s*\(dot\)\s*/gi, '.')
  // Word forms only in UPPERCASE ("AT"/"DOT"): lower-case "at"/"dot" are common
  // words ("contact us at our office") and would otherwise create false hits.
  .replace(/\s+AT\s+/g, '@').replace(/\s+DOT\s+/g, '.');

export const domainOfEmail = (email) => {
  const at = String(email).lastIndexOf('@');
  return at === -1 ? '' : String(email).slice(at + 1).toLowerCase();
};

export const classifyProvider = (email, scannedDomain) => {
  const d = domainOfEmail(email);
  if (d === String(scannedDomain ?? '').trim().toLowerCase()) return 'same-domain';
  if (FREEMAIL_DOMAINS.has(d)) return 'freemail';
  return 'other';
};

const cleanEmail = (raw) => {
  let s = String(raw ?? '').trim().toLowerCase();
  s = s.replace(/^mailto:/i, '');
  // Drop ?subject=..., #fragment, and comma-separated extra recipients.
  s = s.split(/[,?#]/)[0];
  return s.replace(/[.;:'"\s]+$/, '');
};

const addEmail = (raw, method, results, seen, scannedDomain) => {
  const email = cleanEmail(raw);
  if (!EMAIL_OK_RE.test(email) || isBlocked(email)) return;
  if (seen.has(email)) return;
  seen.add(email);
  results.push({ email, method, provider: classifyProvider(email, scannedDomain) });
};

/**
 * Extract candidate emails from an HTML document.
 * Returns [{ email, method: 'mailto'|'text'|'obfuscated', provider }].
 * Foreign-vendor addresses are NOT dropped here: they are kept but ranked last
 * (see rankCandidates), so they surface only when nothing better exists.
 */
export const extractEmails = (html, { scannedDomain } = {}) => {
  const results = [];
  const seen = new Set();
  const markup = stripScriptStyle(String(html ?? ''));

  // 1. mailto: hrefs (highest confidence) — read before tags are stripped.
  for (const m of markup.matchAll(MAILTO_RE)) {
    addEmail(decodeEntities(m[1]), 'mailto', results, seen, scannedDomain);
  }

  // 2. Plain-text emails from the visible text.
  const text = decodeEntities(stripTags(markup));
  for (const m of text.matchAll(EMAIL_RE)) {
    addEmail(m[0], 'text', results, seen, scannedDomain);
  }

  // 3. Obfuscated forms ("[at]", "(at)", "AT"/"DOT", entity-encoded @).
  const deobf = deobfuscate(text);
  for (const m of deobf.matchAll(EMAIL_RE)) {
    addEmail(m[0], 'obfuscated', results, seen, scannedDomain);
  }

  return results;
};

export const pageCategoryOf = (path) => {
  const p = String(path ?? '').split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '') || '/';
  if (p === '/') return 'info'; // homepage ranks with privacy/about
  if (CONTACT_PATHS.has(p)) return 'contact';
  if (INFO_PATHS.has(p)) return 'info';
  return 'other';
};

const PROVIDER_RANK = { 'same-domain': 3, freemail: 2, other: 1 };
const PAGE_RANK = { contact: 2, info: 1, other: 0 };
const methodRank = (m) => (m === 'mailto' ? 2 : 1);

/**
 * Sort candidates best-first without mutating the input. Order is provider,
 * then page tier, then method, which encodes the required preference:
 *   same-domain mailto on contact > same-domain text on contact >
 *   same-domain on privacy/about/homepage > freemail on contact > ...
 */
export const rankCandidates = (candidates) => (candidates ?? []).slice().sort((a, b) => {
  const ka = [PROVIDER_RANK[a.provider] ?? 0, PAGE_RANK[a.pageCategory] ?? 0, methodRank(a.method)];
  const kb = [PROVIDER_RANK[b.provider] ?? 0, PAGE_RANK[b.pageCategory] ?? 0, methodRank(b.method)];
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return kb[i] - ka[i];
  }
  return 0;
});

const confidenceOf = (c) => {
  if (c.provider === 'other') return 'low';
  if (c.method === 'mailto' && c.provider === 'same-domain') return 'high';
  if (c.provider === 'same-domain') return 'medium';
  if (c.method === 'mailto') return 'medium'; // freemail mailto
  return 'low';
};

export const normalizeDomain = (raw) => {
  let s = String(raw ?? '').trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // strip any scheme
  s = s.replace(/^www\./, '');
  s = s.split(/[/?#]/)[0]; // drop path/query/fragment
  s = s.replace(/^\.+|\.+$/g, '');
  return DOMAIN_RE.test(s) ? s : null;
};

/** Domains already recorded in an output JSONL (any status) — for idempotency. */
export const seenDomains = (jsonlText) => {
  const seen = new Set();
  for (const line of String(jsonlText ?? '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const d = JSON.parse(t)?.domain;
      if (d) seen.add(String(d).trim().toLowerCase());
    } catch { /* ignore malformed lines */ }
  }
  return seen;
};

/** Parse a CSV (first column, or a "domain" header) or JSONL ({domain}). */
export const parseInput = (text) => {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let isJsonl = false;
  try {
    const o = JSON.parse(lines[0]);
    isJsonl = o && typeof o === 'object' && !Array.isArray(o) && 'domain' in o;
  } catch { isJsonl = false; }

  if (isJsonl) {
    const out = [];
    for (const line of lines) {
      try {
        const d = normalizeDomain(JSON.parse(line)?.domain);
        if (d) out.push(d);
      } catch { /* ignore malformed line */ }
    }
    return out;
  }
  return parseCsv(lines);
};

const parseCsv = (lines) => {
  const first = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const hasHeader = first.includes('domain');
  const col = hasHeader ? first.indexOf('domain') : 0;
  const rows = hasHeader ? lines.slice(1) : lines;
  const out = [];
  for (const line of rows) {
    const d = normalizeDomain(line.split(',')[col]);
    if (d) out.push(d);
  }
  return out;
};

/**
 * True when a fetch should be retried through the reader proxy: a network
 * error, an explicit bot-wall status (403/429/503), or a short body (under
 * 500 bytes) carrying a known challenge marker. Pure: no I/O.
 */
export const isBotWall = (page, error) => {
  if (error) return true;
  if (!page) return false;
  if (BOT_WALL_STATUSES.has(page.status)) return true;
  const body = String(page.html ?? '');
  if (Buffer.byteLength(body, 'utf8') >= CHALLENGE_BODY_MAX_BYTES) return false;
  const lower = body.toLowerCase();
  return BOT_WALL_MARKERS.some((marker) => lower.includes(marker));
};

/** Build the reader-proxy URL, keeping the original scheme inside. */
export const proxyUrlFor = (url) => `${PROXY_PREFIX}${url}`;

// ---- network / per-domain -------------------------------------------------

export const hasMailServer = async (domain) => {
  const d = String(domain ?? '').trim().toLowerCase();
  if (!d) return false;
  try {
    const mx = await resolveMx(d);
    // A null MX (".") means "no mail"; treat it as absent.
    if (mx.some((r) => r.exchange && r.exchange !== '.' && r.exchange !== '')) return true;
  } catch { /* no MX — fall through to the A-record check */ }
  try {
    const a = await resolve4(d);
    return a.length > 0;
  } catch {
    return false;
  }
};

export const fetchPage = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    });
    const html = await res.text();
    return { status: res.status, html, finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Fetch a URL through the public reader proxy (r.jina.ai). Responses are
 * markdown/plain text, not HTML, so callers must run email extraction on the
 * text as-is rather than requiring an HTML parse. Returns the same
 * { status, html, finalUrl } shape as fetchPage for a uniform caller.
 */
export const fetchPageViaProxy = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(proxyUrlFor(url), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/markdown,text/plain,text/html;q=0.8',
      },
    });
    const text = await res.text();
    return { status: res.status, html: text, finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Per-run proxy throttle. Encapsulates mutable counters in a closure (no shared
 * object mutation) and serializes reservations so the minimum gap holds even
 * across concurrent workers. `sleep`/`now` are injectable for tests.
 */
export const createProxyBudget = ({
  max = PROXY_MAX_REQUESTS,
  minGapMs = PROXY_MIN_GAP_MS,
  sleep: sleepImpl = sleep,
  now = Date.now,
} = {}) => {
  let used = 0;
  let lastAt = -Infinity;
  let chain = Promise.resolve();
  const reserve = () => {
    const run = chain.then(async () => {
      if (used >= max) return false;
      const elapsed = now() - lastAt;
      if (elapsed < minGapMs) await sleepImpl(minGapMs - elapsed);
      used += 1;
      lastAt = now();
      return true;
    });
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
  return { reserve, used: () => used };
};

const nullResult = (domain, reason) => ({
  domain,
  email: null,
  reason,
  checkedAt: new Date().toISOString(),
});

const tryFetch = async (fetchImpl, url) => {
  try {
    return { page: await fetchImpl(url), error: null };
  } catch (error) {
    return { page: null, error };
  }
};

const confidentHit = (candidates) =>
  candidates.some((c) => c.provider === 'same-domain' && c.method === 'mailto' && c.pageCategory === 'contact');

/**
 * Verify one domain. Never throws: any failure becomes a null-email line.
 * `fetchPage`/`fetchViaProxy`/`hasMailServer` are injectable so tests can
 * supply stubs; `proxyBudget` carries the per-run proxy throttle across domains.
 */
export const verifyDomain = async (domain, {
  fetchPage: fetchImpl = fetchPage,
  fetchViaProxy: proxyFetchImpl = fetchPageViaProxy,
  hasMailServer: mxImpl = hasMailServer,
  proxyBudget = createProxyBudget(),
  sleep: sleepImpl = sleep,
  verbose = false,
} = {}) => {
  try {
    const candidates = [];
    let fetched = 0;
    let anyContent = false;
    let anyNetworkError = false;

    // Fetch one URL; when it hits a bot wall, retry that URL exactly once via
    // the reader proxy (budget permitting). Returns { page, error, via } where
    // `via` is PROXY_VIA only when the returned page came from the proxy.
    const fetchOne = async (url) => {
      const { page, error } = await tryFetch(fetchImpl, url);
      if (!isBotWall(page, error)) return { page, error, via: null };
      const reserved = await proxyBudget.reserve();
      if (!reserved) return { page, error, via: null };
      const { page: proxied, error: proxyError } = await tryFetch(proxyFetchImpl, url);
      if (proxyError || !proxied || proxied.status < 200 || proxied.status >= 300) {
        return { page, error, via: null };
      }
      return { page: proxied, error: null, via: PROXY_VIA };
    };

    for (const path of CANDIDATE_PATHS) {
      if (fetched >= MAX_FETCHES_PER_DOMAIN) break;
      const url = `https://${domain}${path}`;
      fetched += 1;
      const { page, error, via } = await fetchOne(url);
      if (error) {
        anyNetworkError = true;
        if (verbose) console.error(`  ${domain}: ${path} -> ${error.message}`);
      } else if (page.status < 200 || page.status >= 300) {
        if (verbose) console.error(`  ${domain}: ${path} -> HTTP ${page.status}`);
      } else {
        anyContent = true;
        if (verbose && via) console.error(`  ${domain}: ${path} -> reader-proxy`);
        for (const c of extractEmails(page.html, { scannedDomain: domain })) {
          candidates.push({
            ...c,
            sourceUrl: via ? url : page.finalUrl,
            pageCategory: pageCategoryOf(path),
            ...(via ? { via } : {}),
          });
        }
        if (confidentHit(candidates)) break;
      }
      if (fetched < MAX_FETCHES_PER_DOMAIN) await sleepImpl(SAME_DOMAIN_DELAY_MS);
    }

    // Homepage fallback when no candidate path yielded a page at all.
    if (!anyContent) {
      if (fetched > 0) await sleepImpl(SAME_DOMAIN_DELAY_MS);
      const homeUrl = `https://${domain}/`;
      const { page, error, via } = await fetchOne(homeUrl);
      if (error) anyNetworkError = true;
      else if (page.status >= 200 && page.status < 300) {
        anyContent = true;
        for (const c of extractEmails(page.html, { scannedDomain: domain })) {
          candidates.push({
            ...c,
            sourceUrl: via ? homeUrl : page.finalUrl,
            pageCategory: 'info',
            ...(via ? { via } : {}),
          });
        }
      }
    }

    if (!anyContent) return nullResult(domain, anyNetworkError ? 'fetch-fail' : 'no-contact-page');
    if (candidates.length === 0) return nullResult(domain, 'no-email-found');

    for (const c of rankCandidates(candidates)) {
      // MX checks stay pure DNS — never routed through the proxy.
      if (await mxImpl(domainOfEmail(c.email))) {
        return {
          domain,
          email: c.email,
          sourceUrl: c.sourceUrl,
          method: c.method,
          confidence: confidenceOf(c),
          provider: c.provider,
          mx: true,
          ...(c.via ? { via: c.via } : {}),
          checkedAt: new Date().toISOString(),
        };
      }
    }
    return nullResult(domain, 'mx-fail');
  } catch {
    // Any unexpected failure (DNS/TLS/timeout/weird HTML) is a null line.
    return nullResult(domain, 'fetch-fail');
  }
};
