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
