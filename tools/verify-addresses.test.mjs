import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractEmails,
  rankCandidates,
  parseInput,
  seenDomains,
  normalizeDomain,
  classifyProvider,
  pageCategoryOf,
  verifyDomain,
  isBotWall,
  proxyUrlFor,
  createProxyBudget,
  PROXY_MAX_REQUESTS,
  PROXY_MIN_GAP_MS,
  BOT_WALL_MARKERS,
} from './verify-addresses.mjs';

// ---- extraction -----------------------------------------------------------

test('extractEmails: mailto href', () => {
  const got = extractEmails(
    '<a href="mailto:kontakt@shop.example.de">Kontakt</a>',
    { scannedDomain: 'shop.example.de' },
  );
  assert.equal(got[0].email, 'kontakt@shop.example.de');
  assert.equal(got[0].method, 'mailto');
  assert.equal(got[0].provider, 'same-domain');
});

test('extractEmails: plain text', () => {
  const got = extractEmails(
    '<p>Email us at info@shop.example.de</p>',
    { scannedDomain: 'shop.example.de' },
  );
  assert.equal(got.some((e) => e.email === 'info@shop.example.de' && e.method === 'text'), true);
});

test('extractEmails: [at]/[dot] obfuscation', () => {
  const got = extractEmails(
    '<p>kontakt [at] shop [dot] de</p>',
    { scannedDomain: 'shop.de' },
  );
  assert.equal(got.some((e) => e.email === 'kontakt@shop.de' && e.method === 'obfuscated'), true);
});

test('extractEmails: (at) obfuscation', () => {
  const got = extractEmails('info (at) shop.example.de', { scannedDomain: 'shop.example.de' });
  assert.equal(got.some((e) => e.email === 'info@shop.example.de' && e.method === 'obfuscated'), true);
});

test('extractEmails: entity-encoded @ in mailto and text', () => {
  const mailto = extractEmails(
    '<a href="mailto:info&#64;shop.example.de">x</a>',
    { scannedDomain: 'shop.example.de' },
  );
  assert.equal(mailto[0].email, 'info@shop.example.de');

  const text = extractEmails('info&commat;shop.example.de', { scannedDomain: 'shop.example.de' });
  assert.equal(text.some((e) => e.email === 'info@shop.example.de'), true);
});

// ---- exclusion ------------------------------------------------------------

test('exclusion: noreply filtered', () => {
  const got = extractEmails(
    '<a href="mailto:noreply@shop.example.de">a</a> <a href="mailto:info@shop.example.de">b</a>',
    { scannedDomain: 'shop.example.de' },
  );
  const emails = got.map((e) => e.email);
  assert.equal(emails.includes('noreply@shop.example.de'), false);
  assert.equal(emails.includes('info@shop.example.de'), true);
});

test('exclusion: script-block emails ignored', () => {
  const got = extractEmails(
    '<script>var e="hidden@shop.example.de";</script><p>info@shop.example.de</p>',
    { scannedDomain: 'shop.example.de' },
  );
  const emails = got.map((e) => e.email);
  assert.equal(emails.includes('hidden@shop.example.de'), false);
  assert.equal(emails.includes('info@shop.example.de'), true);
});

// ---- ranking --------------------------------------------------------------

test('ranking: impressum mailto beats homepage text', () => {
  const list = [
    { email: 'info@shop.example.de', method: 'text', provider: 'same-domain', pageCategory: 'info' },
    { email: 'kontakt@shop.example.de', method: 'mailto', provider: 'same-domain', pageCategory: 'contact' },
  ];
  assert.equal(rankCandidates(list)[0].email, 'kontakt@shop.example.de');
});

test('ranking: foreign-vendor domain penalized below same-domain', () => {
  const list = [
    { email: 'partner@other-company.com', method: 'mailto', provider: 'other', pageCategory: 'contact' },
    { email: 'info@shop.example.de', method: 'text', provider: 'same-domain', pageCategory: 'info' },
  ];
  assert.equal(rankCandidates(list)[0].email, 'info@shop.example.de');
});

test('ranking: freemail ranks above foreign, below same-domain', () => {
  const list = [
    { email: 'partner@other-company.com', method: 'mailto', provider: 'other', pageCategory: 'contact' },
    { email: 'owner@gmail.com', method: 'mailto', provider: 'freemail', pageCategory: 'contact' },
    { email: 'kontakt@shop.example.de', method: 'mailto', provider: 'same-domain', pageCategory: 'contact' },
  ];
  assert.equal(rankCandidates(list)[0].email, 'kontakt@shop.example.de');
  assert.equal(rankCandidates(list)[1].email, 'owner@gmail.com');
});

// ---- input parsing / idempotency -----------------------------------------

test('parseInput: CSV with a domain header column', () => {
  const got = parseInput('name,domain,notes\nShop,HTTPS://WWW.Shop-Example.de/path,hi\n');
  assert.deepEqual(got, ['shop-example.de']);
});

test('parseInput: CSV first column when no header', () => {
  const got = parseInput('shop.example.de,Shop\nother.example.com,Other\n');
  assert.deepEqual(got, ['shop.example.de', 'other.example.com']);
});

test('parseInput: JSONL', () => {
  const got = parseInput(
    '{"domain":"https://www.Shop-Example.de/impressum"}\n{"domain":"Other-Example.com"}\n',
  );
  assert.deepEqual(got, ['shop-example.de', 'other-example.com']);
});

test('seenDomains: idempotent skip logic', () => {
  const seen = seenDomains(
    '{"domain":"a.example.de","email":null}\n{"domain":"b.example.de","email":"x@b.example.de"}\n',
  );
  assert.equal(seen.has('a.example.de'), true);
  assert.equal(seen.has('b.example.de'), true);
  assert.equal(seen.has('c.example.de'), false);
});

// ---- small helpers --------------------------------------------------------

test('normalizeDomain: strips protocol/www/case and rejects junk', () => {
  assert.equal(normalizeDomain('HTTPS://www.Shop-Example.de/impressum'), 'shop-example.de');
  assert.equal(normalizeDomain('Shop-Example.de'), 'shop-example.de');
  assert.equal(normalizeDomain('not a domain'), null);
});

test('classifyProvider', () => {
  assert.equal(classifyProvider('x@shop.example.de', 'shop.example.de'), 'same-domain');
  assert.equal(classifyProvider('x@gmail.com', 'shop.example.de'), 'freemail');
  assert.equal(classifyProvider('x@other.com', 'shop.example.de'), 'other');
});

test('pageCategoryOf', () => {
  assert.equal(pageCategoryOf('/impressum'), 'contact');
  assert.equal(pageCategoryOf('/privacy'), 'info');
  assert.equal(pageCategoryOf('/'), 'info');
});

// ---- reader-proxy fallback ------------------------------------------------

test('bot wall: every marker detected in a short body', () => {
  for (const marker of BOT_WALL_MARKERS) {
    assert.equal(
      isBotWall({ status: 200, html: `<html><body>${marker}</body></html>` }, null),
      true,
      `marker: ${marker}`,
    );
  }
});

test('bot wall: markers match case-insensitively', () => {
  assert.equal(isBotWall({ status: 200, html: '<title>Just a moment...</title>' }, null), true);
  assert.equal(isBotWall({ status: 200, html: '<h1>Attention Required</h1>' }, null), true);
});

test('bot wall: short challenge body detected, short plain page is not', () => {
  assert.equal(isBotWall({ status: 200, html: 'cf-challenge please wait' }, null), true);
  assert.equal(isBotWall({ status: 200, html: 'ok' }, null), false);
});

test('bot wall: plain 200 page is not a bot wall', () => {
  const body = 'This is a normal contact page with real content. '.repeat(40);
  assert.equal(isBotWall({ status: 200, html: body }, null), false);
});

test('bot wall: status codes 403/429/503 trigger regardless of body size', () => {
  const big = 'x'.repeat(2000);
  for (const status of [403, 429, 503]) {
    assert.equal(isBotWall({ status, html: big }, null), true, `status ${status}`);
  }
});

test('bot wall: network error triggers, other statuses do not', () => {
  assert.equal(isBotWall(null, new Error('fetch failed')), true);
  assert.equal(isBotWall({ status: 404, html: 'not found' }, null), false);
});

test('proxyUrlFor: prefixes reader proxy keeping original scheme', () => {
  assert.equal(
    proxyUrlFor('https://example.com/impressum'),
    'https://r.jina.ai/https://example.com/impressum',
  );
  assert.equal(proxyUrlFor('http://example.com/kontakt'), 'https://r.jina.ai/http://example.com/kontakt');
});

test('proxy constants: budget and gap are exported with expected values', () => {
  assert.equal(PROXY_MAX_REQUESTS, 30);
  assert.equal(PROXY_MIN_GAP_MS, 2000);
});

test('proxy budget: enforces max requests', async () => {
  const budget = createProxyBudget({ max: 3, minGapMs: 0, sleep: async () => {} });
  assert.equal(await budget.reserve(), true);
  assert.equal(await budget.reserve(), true);
  assert.equal(await budget.reserve(), true);
  assert.equal(await budget.reserve(), false);
  assert.equal(budget.used(), 3);
});

test('proxy budget: enforces minimum gap between consecutive requests', async () => {
  const sleeps = [];
  let now = 0;
  const budget = createProxyBudget({
    max: 10,
    minGapMs: 2000,
    sleep: async (ms) => { sleeps.push(ms); now += ms; },
    now: () => now,
  });
  await budget.reserve(); // first request: no gap to wait for
  await budget.reserve(); // second request: must wait the full gap
  assert.deepEqual(sleeps, [2000]);
  assert.equal(budget.used(), 2);
});

test('verifyDomain: direct fetch keeps the current record shape (no via field)', async () => {
  const rec = await verifyDomain('shop.example.de', {
    fetchPage: async (url) => ({
      status: 200,
      html: '<a href="mailto:kontakt@shop.example.de">Kontakt</a>',
      finalUrl: url,
    }),
    fetchViaProxy: async () => { throw new Error('proxy should not be called'); },
    hasMailServer: async () => true,
    proxyBudget: createProxyBudget({ max: 0, minGapMs: 0, sleep: async () => {} }),
    sleep: async () => {},
  });
  assert.equal(rec.email, 'kontakt@shop.example.de');
  assert.equal(Object.prototype.hasOwnProperty.call(rec, 'via'), false);
});

test('verifyDomain: bot-wall page is retried once via proxy and marked reader-proxy', async () => {
  const proxyCalls = [];
  const rec = await verifyDomain('shop.example.de', {
    fetchPage: async (url) => (
      url.endsWith('/impressum')
        ? { status: 403, html: '<html><title>Just a moment...</title></html>', finalUrl: url }
        : { status: 404, html: '', finalUrl: url }
    ),
    fetchViaProxy: async (url) => {
      proxyCalls.push(url);
      return { status: 200, html: 'Kontakt: info@shop.example.de', finalUrl: 'https://shop.example.de/impressum' };
    },
    hasMailServer: async () => true,
    proxyBudget: createProxyBudget({ max: 30, minGapMs: 0, sleep: async () => {} }),
    sleep: async () => {},
  });
  assert.equal(rec.email, 'info@shop.example.de');
  assert.equal(rec.via, 'reader-proxy');
  assert.equal(proxyCalls.length, 1, 'bot-walled URL proxied exactly once');
  assert.equal(proxyCalls[0], 'https://shop.example.de/impressum');
});

test('verifyDomain: exhausted proxy budget leaves direct failures alone', async () => {
  const proxyCalls = [];
  const rec = await verifyDomain('shop.example.de', {
    fetchPage: async () => ({ status: 503, html: '', finalUrl: 'https://shop.example.de/impressum' }),
    fetchViaProxy: async (url) => { proxyCalls.push(url); return { status: 200, html: 'x@shop.example.de', finalUrl: url }; },
    hasMailServer: async () => true,
    proxyBudget: createProxyBudget({ max: 0, minGapMs: 0, sleep: async () => {} }),
    sleep: async () => {},
  });
  assert.equal(proxyCalls.length, 0);
  assert.equal(rec.email, null);
  assert.equal(rec.reason, 'no-contact-page');
});
