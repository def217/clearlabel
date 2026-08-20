#!/usr/bin/env node
/** Assemble outreach draft JSONL (send-mail batch format) from enriched prospect records plus a copy markdown template. Mechanical slot filling; copy lives in the markdown, not code. Usage:
 *   node tools/assemble-wave.mjs --in <prospects.jsonl> --copy <copy.md> --out <batch.jsonl> [--seed a@x,b@y] [--limit N]
 * SEED MODE: first two qualifying prospects, one line per seed address, "to" = seed, subject prefixed "[SEED] ".
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// ---- constants -----------------------------------------------------------
const AI_NATIVE_PHRASE = 'a chat product built on an AI model';
const AI_OPTIONAL_PHRASE = 'a chat tool whose AI mode depends on your configuration';
const UNVERIFIED_LIST = 'whether the AI mode is actually enabled, disclosure shown inside the chat window itself after it opens, and pages we could not read';
const CONSOLE_HINT_FALLBACK = "your vendor's chat settings usually have a greeting or bot-name field where the disclosure goes";
const SEED_CAP = 2;
const SEED_PREFIX = '[SEED] ';
const SUBJECT_KEYS = Object.freeze(['1', '2', '3']);
const BODY_KEYS = Object.freeze(['A', 'B', 'C']);
const PLACEHOLDER_RE = /\{[^{}]*\}/;
const SKIP_REASONS = Object.freeze(['no-fresh', 'fresh-not-ok', 'no-vendor', 'has-disclosures', 'no-email']);

// ---- args ----------------------------------------------------------------
const collectArg = (argv, name) => {
  const flag = `--${name}`;
  const out = [];
  argv.forEach((value, i) => {
    if (value === flag && argv[i + 1] !== undefined) out.push(argv[i + 1]);
  });
  return out;
};
const arg = (argv, name) => collectArg(argv, name).at(-1) ?? null;

// ---- copy parsing --------------------------------------------------------
const parseCopy = (md) => {
  const subjects = {};
  const bodies = {};
  let footer = '';
  let current = null;
  let buf = [];
  const flush = () => {
    if (current === 'footer') footer = buf.join('\n').trim();
    else if (current?.startsWith('body-')) bodies[current.slice(5)] = buf.join('\n').trim();
    buf = [];
  };
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      const heading = line.slice(3).trim();
      const bodyMatch = heading.match(/^Body ([ABC])/);
      if (/^Subject variants/.test(heading)) current = 'subjects';
      else if (bodyMatch) current = `body-${bodyMatch[1]}`;
      else if (/^Footer/.test(heading)) current = 'footer';
      else current = null;
      continue;
    }
    if (/^\s*---\s*$/.test(line)) { flush(); current = null; continue; }
    if (current === null) continue;
    if (current === 'subjects') {
      const match = line.match(/^S([123]):\s*(.*)$/);
      if (match) subjects[match[1]] = match[2].trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return Object.freeze({ subjects, bodies, footer });
};
const validateCopy = (copy) => {
  for (const key of SUBJECT_KEYS) if (!copy.subjects[key]) throw new Error(`copy missing S${key}`);
  for (const key of BODY_KEYS) if (!copy.bodies[key]) throw new Error(`copy missing Body ${key}`);
  if (!copy.footer) throw new Error('copy missing Footer');
};

// ---- slot filling ---------------------------------------------------------
const pagePhrase = (pagesRead) => {
  const pages = Array.isArray(pagesRead) ? pagesRead.filter((p) => typeof p === 'string') : [];
  const path = [...pages].reverse().find((p) => p.trim() !== '' && p.trim() !== '/');
  return path ? `homepage and ${path.trim()}` : 'homepage';
};
const consoleHint = (consolePath) => {
  const path = typeof consolePath === 'string' ? consolePath.trim() : '';
  const stripped = path.replace(/\.+$/, '').trim();
  return stripped ? stripped[0].toLowerCase() + stripped.slice(1) : CONSOLE_HINT_FALLBACK;
};
const buildSlots = (row) => {
  const fresh = row.fresh;
  const vendor = fresh.vendors[0];
  return Object.freeze({
    '{domain}': row.domain ?? '',
    '{vendor}': vendor?.name && typeof vendor.name === 'string' ? vendor.name : '',
    '{aiNature-phrase}': vendor?.aiNature === 'ai-native' ? AI_NATIVE_PHRASE : AI_OPTIONAL_PHRASE,
    '{page}': pagePhrase(fresh.pagesRead),
    '{unverified-list}': UNVERIFIED_LIST,
    '{console-hint}': consoleHint(vendor?.consolePath),
  });
};
const fillSlots = (template, slots) => {
  let out = template;
  for (const token of Object.keys(slots)) out = out.split(token).join(slots[token]);
  return out;
};
const collapseBlankLines = (text) => text.replace(/\n{3,}/g, '\n\n');
const buildMessage = (row, index, copy) => {
  const slots = buildSlots(row);
  const subject = fillSlots(copy.subjects[SUBJECT_KEYS[index % 3]], slots);
  const body = fillSlots(copy.bodies[BODY_KEYS[index % 3]], slots);
  const footer = fillSlots(copy.footer, slots);
  if (PLACEHOLDER_RE.test(`Subject: ${subject}\n\n${body}\n\n${footer}`)) return null;
  return Object.freeze({ subject, body, footer });
};

// ---- filtering ------------------------------------------------------------
const classify = (row) => {
  const fresh = row?.fresh;
  if (!fresh) return 'no-fresh';
  if (!fresh.ok) return 'fresh-not-ok';
  if (!Array.isArray(fresh.vendors) || fresh.vendors.length < 1) return 'no-vendor';
  if (fresh.disclosures && fresh.disclosures.length > 0) return 'has-disclosures';
  if (typeof row.email !== 'string' || row.email.trim() === '') return 'no-email';
  return null;
};
const readJsonl = async (file) => {
  const records = [];
  let malformed = 0;
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    try { records.push(JSON.parse(line)); } catch { malformed += 1; }
  }
  return { records, malformed };
};

// ---- main -----------------------------------------------------------------
const main = async () => {
  const argv = process.argv.slice(2);
  const inFile = arg(argv, 'in');
  const copyFile = arg(argv, 'copy');
  const outFile = arg(argv, 'out');
  const seedArg = arg(argv, 'seed');
  const limitArg = arg(argv, 'limit');
  if (!inFile || !copyFile || !outFile) {
    console.error('usage: node tools/assemble-wave.mjs --in <prospects.jsonl> --copy <copy.md> --out <batch.jsonl> [--seed <a@x,b@y>] [--limit N]');
    process.exit(1);
  }

  const seedEmails = (seedArg ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const parsedLimit = limitArg === null ? null : Number.parseInt(limitArg, 10);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
  const seedMode = seedEmails.length > 0;
  const cap = seedMode ? SEED_CAP : (limit ?? Infinity);

  const copy = parseCopy(await readFile(copyFile, 'utf8'));
  validateCopy(copy);
  const { records, malformed } = await readJsonl(inFile);

  const skipped = Object.fromEntries(SKIP_REASONS.map((r) => [r, 0]));
  let qualified = 0;
  let capped = 0;
  let skippedSlot = 0;
  let written = 0;
  const chosen = [];
  for (const row of records) {
    const reason = classify(row);
    if (reason) { skipped[reason] += 1; continue; }
    qualified += 1;
    if (chosen.length < cap) chosen.push(row); else capped += 1;
  }

  const lines = [];
  chosen.forEach((row, index) => {
    const built = buildMessage(row, index, copy);
    if (built === null) { skippedSlot += 1; return; }
    for (const to of (seedMode ? seedEmails : [row.email])) {
      const subject = seedMode ? `${SEED_PREFIX}${built.subject}` : built.subject;
      const text = collapseBlankLines(`Subject: ${subject}\n\n${built.body}\n\n${built.footer}`);
      lines.push(JSON.stringify({ id: row.domain, ok: true, to, text }));
      written += 1;
    }
  });

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, lines.length ? `${lines.join('\n')}\n` : '');

  console.error(
    `rows=${records.length} qualified=${qualified} skipped-no-fresh=${skipped['no-fresh']} `
    + `skipped-fresh-not-ok=${skipped['fresh-not-ok']} skipped-no-vendor=${skipped['no-vendor']} `
    + `skipped-has-disclosures=${skipped['has-disclosures']} skipped-no-email=${skipped['no-email']} `
    + `skipped-slot=${skippedSlot} capped=${capped} malformed=${malformed} written=${written}`
  );
};

main().catch((err) => {
  console.error('fatal:', err.message);
  process.exit(1);
});
