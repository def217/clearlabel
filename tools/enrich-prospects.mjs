#!/usr/bin/env node
/**
 * Re-scan each prospect's homepage right before outreach so the disclosure
 * verdict reflects the site today, not whenever the batch study ran.
 * Appends a `fresh` block to every prospect row; the qualify-prospects.mjs
 * fields are carried through untouched.
 *
 * Usage:
 *   node tools/enrich-prospects.mjs --in study/prospects-x.jsonl \
 *     --out study/prospects-x-enriched.jsonl [--limit N] [--delay-ms 2000]
 *
 * Direct fetch only - no r.jina.ai or other proxy. A prior batch run
 * rate-limited the proxy the live product depends on; this tool must not
 * add to that load. Sequential with a delay between domains, not
 * concurrent.
 */
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanHtml } from '../scanner/core.mjs';
import { seenDomains } from './verify-addresses-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(HERE, '..', 'data', 'vendors.json');
const TIMEOUT_MS = 15000;
const DEFAULT_DELAY_MS = 2000;
const UA = 'ClearLabelBot/1.0';

const arg = (argv, name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : null;
};

const readIfExists = async (path) => {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
};

const parseJsonl = (body) => {
  const rows = [];
  let malformed = 0;
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      malformed += 1;
    }
  }
  return { rows, malformed };
};

const fetchHomepage = async (domain) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://${domain}/`, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, html: await res.text() };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
};

const freshScan = async (domain, db) => {
  const scannedAt = new Date().toISOString();
  const page = await fetchHomepage(domain);
  if (!page.ok) return { scannedAt, ok: false, error: page.error };
  const { vendors, disclosures, contentSignals, overall, findings } = scanHtml(page.html, db);
  return { scannedAt, ok: true, overall, vendors, disclosures, contentSignals, findings };
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Explicit --delay-ms 0 is honored; missing/invalid falls back to the default. */
const readDelayMs = (argv) => {
  const raw = arg(argv, 'delay-ms');
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DELAY_MS;
};

const readLimit = (argv, fallback) => {
  const parsed = Number(arg(argv, 'limit'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const inFile = arg(argv, 'in');
  const outFile = arg(argv, 'out');
  if (!inFile || !outFile) {
    console.error('usage: node tools/enrich-prospects.mjs --in <jsonl> --out <jsonl> [--limit N] [--delay-ms 2000]');
    process.exit(1);
  }
  const delayMs = readDelayMs(argv);

  const { rows: prospects, malformed } = parseJsonl(await readFile(inFile, 'utf8'));
  const done = seenDomains(await readIfExists(outFile));
  const todo = prospects.filter((p) => p?.domain && !done.has(String(p.domain).trim().toLowerCase()));
  const skippedExisting = prospects.length - todo.length;
  const batch = todo.slice(0, readLimit(argv, todo.length));

  const db = JSON.parse(await readFile(DB_PATH, 'utf8'));
  await mkdir(dirname(outFile), { recursive: true });

  let freshOk = 0;
  let freshFail = 0;
  for (const [index, prospect] of batch.entries()) {
    const fresh = await freshScan(prospect.domain, db);
    if (fresh.ok) freshOk += 1; else freshFail += 1;
    // Append + flush per domain: a crash mid-run must not lose work already done.
    await appendFile(outFile, `${JSON.stringify({ ...prospect, fresh })}\n`);
    if (index < batch.length - 1) await wait(delayMs);
  }

  console.error(
    `attempted=${batch.length} fresh-ok=${freshOk} fresh-fail=${freshFail} `
    + `skipped-existing=${skippedExisting} malformed-input=${malformed}`
  );
};

main().catch((err) => {
  console.error('fatal:', err.message);
  process.exit(1);
});
