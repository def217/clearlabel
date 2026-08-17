/**
 * Shared suppression-list helpers for outbound mail tooling.
 *
 * study/suppression.jsonl holds one JSON line per opt-out:
 *   {"id":"<domain>","reason":"opt-out","at":"<ISO>"}
 * The file may not exist, which is treated as an empty list.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SUPPRESSION_FILE = join(HERE, '..', 'study', 'suppression.jsonl');

export const loadSuppression = async () => {
  let body;
  try {
    body = await readFile(SUPPRESSION_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
  const domains = new Set();
  for (const line of body.split('\n').filter(Boolean)) {
    try {
      const o = JSON.parse(line);
      if (o && o.id) domains.add(String(o.id).trim().toLowerCase());
    } catch { /* ignore malformed suppression lines */ }
  }
  return domains;
};

export const domainOf = (addr) => {
  const s = String(addr).trim();
  const at = s.lastIndexOf('@');
  return (at === -1 ? s : s.slice(at + 1)).toLowerCase();
};
