#!/usr/bin/env node
/**
 * Verify the contact address a site actually publishes, instead of guessing
 * info@<domain> (which hard-bounced ~31% of the time and damaged sender
 * reputation).
 *
 * Usage:
 *   node tools/verify-addresses.mjs --in <csv-or-jsonl> --out study/verified-addresses.jsonl \
 *     [--limit N] [--concurrency 3] [--verbose]
 *
 * The pure helpers and the single network touchpoint live in
 * verify-addresses-lib.mjs and are re-exported here so tests can import them
 * from this module without any I/O.
 */
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  decodeEntities,
  extractEmails,
  rankCandidates,
  parseInput,
  seenDomains,
  normalizeDomain,
  classifyProvider,
  pageCategoryOf,
  domainOfEmail,
  fetchPage,
  fetchPageViaProxy,
  hasMailServer,
  isBotWall,
  proxyUrlFor,
  createProxyBudget,
  PROXY_MAX_REQUESTS,
  PROXY_MIN_GAP_MS,
  BOT_WALL_MARKERS,
  verifyDomain,
} from './verify-addresses-lib.mjs';

export {
  decodeEntities,
  extractEmails,
  rankCandidates,
  parseInput,
  seenDomains,
  normalizeDomain,
  classifyProvider,
  pageCategoryOf,
  domainOfEmail,
  fetchPage,
  fetchPageViaProxy,
  hasMailServer,
  isBotWall,
  proxyUrlFor,
  createProxyBudget,
  PROXY_MAX_REQUESTS,
  PROXY_MIN_GAP_MS,
  BOT_WALL_MARKERS,
  verifyDomain,
};

// ---- CLI ------------------------------------------------------------------

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

const dedupe = (arr) => [...new Set(arr)];

const mapPool = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const width = Math.min(Math.max(1, limit), items.length);
  const runners = Array.from({ length: width }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const inFile = arg(argv, 'in');
  const outFile = arg(argv, 'out');
  if (!inFile || !outFile) {
    console.error('usage: node tools/verify-addresses.mjs --in <csv|jsonl> --out <jsonl> [--limit N] [--concurrency N] [--verbose]');
    process.exit(1);
  }
  const limit = Number(arg(argv, 'limit'));
  const concurrency = Math.max(1, Number(arg(argv, 'concurrency') ?? 3) || 3);
  const verbose = argv.includes('--verbose');

  const domains = dedupe(parseInput(await readFile(inFile, 'utf8')));
  const seen = seenDomains(await readIfExists(outFile));
  const todo = domains.filter((d) => !seen.has(d));
  const batch = todo.slice(0, Number.isFinite(limit) && limit > 0 ? limit : todo.length);

  if (verbose) console.error(`input=${domains.length} already-done=${domains.length - todo.length} to-scan=${batch.length}`);

  await mkdir(dirname(outFile), { recursive: true });

  // One shared reader-proxy budget for the whole run (30 requests, 2s apart),
  // so no domain alone can exhaust the proxy quota.
  const proxyBudget = createProxyBudget();

  // Domains are deduped, so no two workers ever hit the same host concurrently.
  const results = await mapPool(batch, concurrency, async (domain) => {
    const rec = await verifyDomain(domain, { verbose, proxyBudget });
    // Append + flush per domain: a crash loses nothing already written.
    await appendFile(outFile, JSON.stringify(rec) + '\n');
    if (verbose) console.error(rec.email ? `  ok ${domain} -> ${rec.email}` : `  none ${domain} (${rec.reason})`);
    return rec;
  });

  const found = results.filter((r) => r.email).length;
  const none = results.filter((r) => !r.email).length;
  const errors = results.filter((r) => !r.email && r.reason === 'fetch-fail').length;
  console.error(`scanned=${results.length} found=${found} none=${none} errors=${errors}`);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().catch((err) => { console.error('fatal:', err.message); process.exit(1); });
