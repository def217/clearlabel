import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNis2Pack } from './nis2-pack.mjs';

const answers = {
  sectorName: 'Energy',
  subsectorName: 'Electricity',
  sizeBand: 'large',
  captures: ['DNS service provider', 'TLD name registry'],
};

const essential = {
  status: 'essential',
  reasons: [
    'Energy is an Annex I type that exceeds the medium-enterprise ceilings (large) → essential (Art. 3(1)(a)).',
  ],
  obligations: ['Risk-management measures (Art. 21).'],
};

const important = {
  status: 'important',
  reasons: [
    'Medium-sized Annex I entity (50-249 staff) → important, not essential (Art. 3(2)), unless caught by Art. 3(1)(b)-(f).',
  ],
  obligations: ['Risk-management measures (Art. 21).'],
};

const FIXED = new Date('2026-08-18T12:00:00.000Z');

test('builder returns six files in order', () => {
  const pack = buildNis2Pack(answers, essential, FIXED);
  assert.deepEqual(
    pack.map((f) => f.name),
    [
      '00-START-HERE.md',
      '01-risk-management-checklist.md',
      '02-incident-reporting-runbook.md',
      '03-registration-info-sheet.md',
      '04-management-accountability.md',
      '05-evidence-record.md',
    ],
  );
  assert.ok(pack.every((f) => typeof f.content === 'string' && f.content.length > 0));
});

test('ctx values appear: sector and subsector names', () => {
  const pack = buildNis2Pack(answers, essential, FIXED);
  const all = pack.map((f) => f.content).join('\n');
  assert.ok(all.includes('Energy'));
  assert.ok(all.includes('Electricity'));
  assert.ok(all.includes('DNS service provider, TLD name registry'));
});

test('orgName present adds a Prepared-for line under titles', () => {
  const pack = buildNis2Pack({ ...answers, orgName: 'Acme Energy BV' }, essential, FIXED);
  assert.ok(pack[0].content.includes('Prepared for Acme Energy BV'));
  assert.ok(pack[1].content.includes('Prepared for Acme Energy BV'));
  assert.ok(pack[5].content.includes('Prepared for Acme Energy BV'));
});

test('orgName absent renders no Prepared-for line anywhere', () => {
  const pack = buildNis2Pack(answers, essential, FIXED);
  const all = pack.map((f) => f.content).join('\n');
  assert.ok(!all.includes('Prepared for'));
});

test('checklist contains all ten Art. 21(2) measures (a)-(j)', () => {
  const pack = buildNis2Pack(answers, essential, FIXED);
  const content = pack[1].content;
  for (const id of ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)', '(j)']) {
    assert.ok(content.includes(id), `missing measure ${id}`);
  }
  assert.ok(content.includes('policies on risk analysis and information system security'));
  assert.ok(content.includes('multi-factor authentication or continuous authentication solutions'));
  assert.ok(content.includes('without undue delay, all necessary, appropriate and proportionate corrective measures'));
});

test('runbook contains 24, 72 and one month after the submission', () => {
  const pack = buildNis2Pack(answers, essential, FIXED);
  const content = pack[2].content;
  assert.ok(content.includes('24'));
  assert.ok(content.includes('72'));
  assert.ok(content.includes('one month after the submission'));
  assert.ok(content.includes('the CSIRT or, where applicable, the competent authority'));
});

test('fines line matches verdict status', () => {
  const essentialEvidence = buildNis2Pack(answers, essential, FIXED)[5].content;
  const importantEvidence = buildNis2Pack(answers, important, FIXED)[5].content;
  assert.ok(essentialEvidence.includes('EUR 10 000 000'));
  assert.ok(!essentialEvidence.includes('EUR 7 000 000'));
  assert.ok(importantEvidence.includes('EUR 7 000 000'));
  assert.ok(!importantEvidence.includes('EUR 10 000 000'));
});

test('fixed date is deterministic and appears in output', () => {
  const a = buildNis2Pack(answers, essential, FIXED);
  const b = buildNis2Pack(answers, essential, FIXED);
  assert.deepEqual(a, b);
  assert.ok(a[0].content.includes('2026-08-18'));
});

test('two-arg call defaults to a current ISO date string', () => {
  const pack = buildNis2Pack(answers, essential);
  assert.equal(pack.length, 6);
  assert.match(pack[0].content, /Generated \d{4}-\d{2}-\d{2} by ClearLabel/);
});
