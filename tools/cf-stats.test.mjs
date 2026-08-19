import test from 'node:test';
import assert from 'node:assert/strict';

import { renderTable } from './cf-stats.mjs';

test('renderTable: label left-aligned, numbers right-aligned, with header', () => {
  const rows = [
    { label: '(direct)', total: 402, yesterday: 96 },
    { label: 'google.com', total: 118, yesterday: 3 },
  ];
  assert.equal(
    renderTable('referrer', rows),
    [
      'referrer    total  yesterday',
      '(direct)      402         96',
      'google.com    118          3',
    ].join('\n'),
  );
});

test('renderTable: columns align regardless of value width', () => {
  const rows = [
    { label: 'a.example', total: 5, yesterday: 1 },
    { label: 'long-referrer.example.com', total: 12345, yesterday: 6789 },
  ];
  const lines = renderTable('referrer', rows).split('\n');
  assert.equal(lines.length, 3);
  assert.equal(new Set(lines.map((l) => l.length)).size, 1, 'every line is the same width');
  assert.ok(lines[0].startsWith('referrer'), 'header row present');
  assert.ok(lines[0].endsWith('yesterday'), 'rightmost column has no trailing spaces');
});

test('renderTable: empty rows still emit a header', () => {
  assert.equal(renderTable('path', []), 'path  total  yesterday');
});
