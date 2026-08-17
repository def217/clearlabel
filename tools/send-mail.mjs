#!/usr/bin/env node
/**
 * Outbound mail via Cloudflare Email Service (REST API).
 * https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
 *
 * Reads CF_ACCOUNT_ID and CF_EMAIL_API_TOKEN from ../.env (never committed).
 * The sender address must be verified in the Cloudflare Email Service dashboard.
 *
 * Usage:
 *   node tools/send-mail.mjs --test you@example.com     # one test email to yourself
 *   node tools/send-mail.mjs --batch file.jsonl         # dry-run: print what WOULD send
 *   node tools/send-mail.mjs --batch file.jsonl --send  # actually send the batch
 *   node tools/send-mail.mjs --batch file.jsonl --send --force  # ignore ledger, resend
 *
 * Batch lines are {"id": "<domain>", "ok": true, "text": "Subject: ...\n\n<body>"}
 * (the shape study/outreach-batch.jsonl already uses). Recipient defaults to
 * info@<domain>; a line may override with an explicit "to" field.
 */
import { readFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FROM = 'ClearLabel <info@clearlabel.eu>';
const API = 'https://api.cloudflare.com/client/v4';
const PAUSE_MS = 3000; // no burst sending: 25 mails should take a leisurely minute, not a second
const LEDGER = join(HERE, '..', 'study', 'sent-log.jsonl');

const loadEnv = async () => {
  const body = await readFile(join(HERE, '..', '.env'), 'utf8');
  return Object.fromEntries(
    body.split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  );
};

const splitDraft = (text) => {
  const m = text.match(/^Subject:\s*(.+)\n+([\s\S]+)$/);
  if (!m) return null;
  return { subject: m[1].trim(), body: m[2].trim() };
};

// Ledger of successful sends: one JSON line per send, keyed by draft id.
const loadLedger = async () => {
  let body;
  try {
    body = await readFile(LEDGER, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return new Map();
    throw err;
  }
  const sent = new Map();
  for (const line of body.split('\n').filter(Boolean)) {
    try {
      const o = JSON.parse(line);
      if (o && o.id) sent.set(o.id, o.sentAt);
    } catch { /* ignore malformed ledger lines */ }
  }
  return sent;
};

const appendLedger = (entry) => appendFile(LEDGER, `${JSON.stringify(entry)}\n`);

const ledgerDate = (sentAt) => {
  if (!sentAt) return 'unknown date';
  const d = new Date(sentAt);
  return Number.isNaN(d.getTime()) ? sentAt : d.toISOString().slice(0, 10);
};

const sendOne = async (env, { to, subject, body }) => {
  const res = await fetch(`${API}/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, text: body }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.success !== false, status: res.status, detail: JSON.stringify(json).slice(0, 200) };
};

const main = async () => {
  const args = process.argv.slice(2);
  const env = await loadEnv();
  if (!env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN) {
    console.error('Missing CF_ACCOUNT_ID or CF_EMAIL_API_TOKEN in .env — nothing sent.');
    process.exit(1);
  }

  const testIx = args.indexOf('--test');
  if (testIx !== -1) {
    const to = args[testIx + 1];
    if (!to || !to.includes('@')) {
      console.error('usage: node tools/send-mail.mjs --test you@example.com');
      process.exit(1);
    }
    const r = await sendOne(env, {
      to,
      subject: 'ClearLabel outbox test',
      body: 'This is a deliverability test from info@clearlabel.eu via Cloudflare Email Service. If you can read this, the outbox works.',
    });
    console.log(r.ok ? `sent to ${to}` : `FAILED (${r.status}): ${r.detail}`);
    process.exit(r.ok ? 0 : 1);
  }

  const batchIx = args.indexOf('--batch');
  if (batchIx === -1) {
    console.error('usage: --test <addr> | --batch <file.jsonl> [--send]');
    process.exit(1);
  }
  const live = args.includes('--send');
  const force = args.includes('--force');
  const sent = await loadLedger();
  const lines = (await readFile(args[batchIx + 1], 'utf8')).split('\n').filter(Boolean);

  const drafts = lines
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((d) => d && d.ok && d.text)
    .map((d) => {
      const parts = splitDraft(d.text);
      return parts ? { id: d.id, to: d.to ?? `info@${d.id}`, ...parts } : null;
    })
    .filter(Boolean);

  console.log(`${drafts.length} sendable drafts${live ? '' : ' (DRY RUN — pass --send to actually send)'}`);
  let sentCount = 0;
  let skippedCount = 0;
  for (const draft of drafts) {
    if (!force && sent.has(draft.id)) {
      skippedCount += 1;
      console.log(`skip (already sent ${ledgerDate(sent.get(draft.id))}): ${draft.id}`);
      continue;
    }
    if (!live) {
      sentCount += 1;
      console.log(`would send: ${draft.to} | ${draft.subject}`);
      continue;
    }
    const r = await sendOne(env, draft);
    if (r.ok) {
      // Append immediately: a crash mid-run must not lose already-sent entries.
      await appendLedger({ id: draft.id, to: draft.to, sentAt: new Date().toISOString() });
    }
    console.log(`${r.ok ? 'sent' : `FAILED (${r.status})`}: ${draft.to} | ${draft.subject}${r.ok ? '' : ` | ${r.detail}`}`);
    sentCount += r.ok ? 1 : 0;
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
  console.log(live
    ? `done: ${sentCount} sent, ${skippedCount} skipped`
    : `dry run: ${sentCount} would send, ${skippedCount} would skip`);
};

main().catch((err) => { console.error('fatal:', err.message); process.exit(1); });
