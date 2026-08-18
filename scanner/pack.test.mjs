import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPack } from './pack.mjs';

const scan = {
  url: 'https://example-shop.eu/contact',
  scannedAt: '2026-08-03T12:00:00.000Z',
  vendors: [
    { id: 'chatbase', name: 'Chatbase', aiNature: 'ai-native', aiProduct: 'Chatbase', vendorDocs: 'https://www.chatbase.co/docs', consolePath: 'Chatbot → Settings' },
  ],
  disclosures: [{ lang: 'en' }],
  contentSignals: [],
  overall: 'action-required',
  findings: [],
};

const NOW = new Date('2026-08-03T12:00:00.000Z');

const evidenceOf = (pack) => pack.find((f) => f.name === '06-compliance-evidence-record.md');

test('two-arg output is identical to three-arg call with empty branding', () => {
  const two = buildPack(scan, NOW);
  assert.deepEqual(buildPack(scan, NOW, {}), two);
  assert.deepEqual(buildPack(scan, NOW, { agencyName: '' }), two);
  assert.deepEqual(buildPack(scan, NOW, { agencyName: '   ' }), two);
});

test('agencyName present adds a first cover and a Prepared-by line', () => {
  const pack = buildPack(scan, NOW, { agencyName: 'Acme Agency' });
  assert.equal(pack[0].name, '00-cover.md');
  assert.ok(pack[0].content.includes('# Article 50 Compliance Pack'));
  assert.ok(pack[0].content.includes('**Prepared by:** Acme Agency'));
  assert.ok(pack[0].content.includes('**Client site:** https://example-shop.eu/contact'));
  assert.ok(pack[0].content.includes('**Scan date:** 2026-08-03'));
  assert.ok(pack[0].content.includes('06-compliance-evidence-record.md'));
  assert.ok(evidenceOf(pack).content.includes('Prepared by Acme Agency for example-shop.eu'));
});

test('agencyName absent adds no cover', () => {
  const pack = buildPack(scan, NOW);
  assert.ok(!pack.some((f) => f.name === '00-cover.md'));
});

test('agencyName newlines are stripped', () => {
  const pack = buildPack(scan, NOW, { agencyName: '  Agency\nName  ' });
  assert.ok(evidenceOf(pack).content.includes('Prepared by Agency Name for example-shop.eu'));
});

test('agencyName is capped at 120 characters', () => {
  const pack = buildPack(scan, NOW, { agencyName: 'A'.repeat(200) });
  const match = evidenceOf(pack).content.match(/Prepared by (.+) for example-shop\.eu/);
  assert.ok(match);
  assert.equal(match[1], 'A'.repeat(120));
});
