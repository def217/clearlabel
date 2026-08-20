#!/usr/bin/env node
/**
 * Join batch scan results with verified contact addresses into a qualified
 * prospect list: sites with an AI chat vendor detected but no AI-disclosure
 * wording, minus anyone already suppressed or already sent to.
 *
 * Usage:
 *   node tools/qualify-prospects.mjs --results "study/results*.jsonl" \
 *     [--verified "study/verified-*.jsonl"] --out study/prospects-<name>.jsonl \
 *     [--csv study/prospects-<name>.csv]
 *
 * --results and --verified may each repeat and each value may be a glob
 * (expanded with fs.readdirSync, no dependency) or a literal file path.
 * Domains are deduped across files, first occurrence wins.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, basename, join } from 'node:path';
import { loadSuppression } from './suppression.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SENT_LOG = join(HERE, '..', 'study', 'sent-log.jsonl');

// ---- args -------------------------------------------------------------

const collectArg = (argv, name) => {
  const flag = `--${name}`;
  const out = [];
  argv.forEach((value, i) => {
    if (value === flag && argv[i + 1] !== undefined) out.push(argv[i + 1]);
  });
  return out;
};

const arg = (argv, name) => collectArg(argv, name).at(-1) ?? null;

// ---- glob expansion (no dependency) ------------------------------------

const globToRegExp = (pattern) => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
};

/** A pattern with no `*`/`?` in its basename is a literal path. */
const expandPattern = (pattern) => {
  const dir = dirname(pattern);
  const base = basename(pattern);
  if (!/[*?]/.test(base)) return [pattern];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    console.error(`warn: no such directory for pattern: ${pattern}`);
    return [];
  }
  const re = globToRegExp(base);
  return entries.filter((name) => re.test(name)).sort().map((name) => join(dir, name));
};

const expandAll = (patterns) => [...new Set(patterns.flatMap(expandPattern))];

// ---- JSONL reading -------------------------------------------------------

const readJsonl = async (file) => {
  let body;
  try {
    body = await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`warn: file not found: ${file}`);
      return { records: [], malformed: 0 };
    }
    throw err;
  }
  const records = [];
  let malformed = 0;
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      malformed += 1;
    }
  }
  return { records, malformed };
};

const normalizeDomain = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

// ---- pipeline -------------------------------------------------------------

const qualifies = (row) => row.ok === true && row.hasVendor === true && row.hasDisclosure === false;

const loadQualifyingRows = async (files) => {
  let rowsRead = 0;
  let malformed = 0;
  const qualifying = [];
  for (const file of files) {
    const page = await readJsonl(file);
    malformed += page.malformed;
    for (const record of page.records) {
      rowsRead += 1;
      const domain = normalizeDomain(record?.domain);
      if (!domain) { malformed += 1; continue; } // no usable domain, unusable row
      if (qualifies(record)) qualifying.push({ ...record, domain });
    }
  }
  return { qualifying, rowsRead, malformed };
};

const dedupeByDomain = (rows) => {
  const seen = new Set();
  const deduped = [];
  let dupes = 0;
  for (const row of rows) {
    if (seen.has(row.domain)) { dupes += 1; continue; }
    seen.add(row.domain);
    deduped.push(row);
  }
  return { deduped, dupes };
};

const loadSentDomains = async () => {
  const { records } = await readJsonl(SENT_LOG);
  return new Set(records.map((r) => normalizeDomain(r?.id)).filter(Boolean));
};

/** Same domain-match rule send-mail.mjs uses against its ledger/suppression. */
const dropSuppressedAndSent = (rows, suppressed, sent) => {
  const survivors = [];
  let suppressedCount = 0;
  let sentCount = 0;
  for (const row of rows) {
    if (suppressed.has(row.domain)) { suppressedCount += 1; continue; }
    if (sent.has(row.domain)) { sentCount += 1; continue; }
    survivors.push(row);
  }
  return { survivors, suppressedCount, sentCount };
};

/** First occurrence wins, same rule as the results dedupe above. */
const loadVerifiedByDomain = async (files) => {
  let malformed = 0;
  const byDomain = new Map();
  for (const file of files) {
    const page = await readJsonl(file);
    malformed += page.malformed;
    for (const record of page.records) {
      const domain = normalizeDomain(record?.domain);
      if (!domain || byDomain.has(domain)) continue;
      byDomain.set(domain, record);
    }
  }
  return { byDomain, malformed };
};

const toProspect = (row, verified, qualifiedAt) => ({
  domain: row.domain,
  cctld: row.cctld ?? null,
  rank: row.rank ?? null,
  vendors: row.vendors ?? [],
  strongestNature: row.strongestNature ?? null,
  disclosureLangs: row.disclosureLangs ?? [],
  hasContentMarking: row.hasContentMarking ?? false,
  email: verified?.email ?? null,
  emailConfidence: verified?.confidence ?? null,
  emailMethod: verified?.method ?? null,
  emailProvider: verified?.provider ?? null,
  emailSource: verified?.sourceUrl ?? null,
  commercialScore: null,
  commercialNotes: null,
  qualifiedAt,
});

const toCsvLine = (row) => `${row.domain},${row.cctld ?? ''}`;

// ---- main -------------------------------------------------------------

const main = async () => {
  const argv = process.argv.slice(2);
  const resultsPatterns = collectArg(argv, 'results');
  const verifiedPatterns = collectArg(argv, 'verified');
  const outFile = arg(argv, 'out');
  const csvFile = arg(argv, 'csv');

  if (resultsPatterns.length === 0 || !outFile) {
    console.error('usage: node tools/qualify-prospects.mjs --results <glob> [--verified <glob>] --out <jsonl> [--csv <csv>]');
    process.exit(1);
  }

  const resultsFiles = expandAll(resultsPatterns);
  const verifiedFiles = expandAll(verifiedPatterns);

  const { qualifying, rowsRead, malformed: malformedResults } = await loadQualifyingRows(resultsFiles);
  const { deduped, dupes } = dedupeByDomain(qualifying);

  const suppressed = await loadSuppression();
  const sent = await loadSentDomains();
  const { survivors, suppressedCount, sentCount } = dropSuppressedAndSent(deduped, suppressed, sent);

  const { byDomain: verified, malformed: malformedVerified } = await loadVerifiedByDomain(verifiedFiles);

  const qualifiedAt = new Date().toISOString();
  const prospects = survivors.map((row) => toProspect(row, verified.get(row.domain), qualifiedAt));
  const withEmail = prospects.filter((p) => p.email).length;

  await mkdir(dirname(outFile), { recursive: true });
  const body = prospects.map((p) => JSON.stringify(p)).join('\n');
  await writeFile(outFile, prospects.length ? `${body}\n` : '');

  // CSV feeds verify-addresses.mjs next, so only the rows still lacking a
  // working address belong in it.
  if (csvFile) {
    const unverified = prospects.filter((p) => !p.email);
    await mkdir(dirname(csvFile), { recursive: true });
    await writeFile(csvFile, ['domain,cctld', ...unverified.map(toCsvLine)].join('\n') + '\n');
  }

  console.error(
    `files-read=${resultsFiles.length + verifiedFiles.length} (results=${resultsFiles.length} verified=${verifiedFiles.length}) `
    + `rows=${rowsRead} qualified=${qualifying.length} deduped=${dupes} `
    + `suppressed-dropped=${suppressedCount} sent-dropped=${sentCount} `
    + `with-email=${withEmail} without-email=${prospects.length - withEmail} `
    + `written=${prospects.length} malformed=${malformedResults + malformedVerified}`
  );
};

main().catch((err) => {
  console.error('fatal:', err.message);
  process.exit(1);
});
