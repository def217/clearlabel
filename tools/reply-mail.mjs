#!/usr/bin/env node
/**
 * Reply mail via the Cloudflare Email Service (same endpoint/credentials as
 * tools/send-mail.mjs), from ClearLabel <info@clearlabel.eu>.
 *
 * Usage:
 *   node tools/reply-mail.mjs --to <addr> --subject <s> --body-file <path> \
 *     [--in-reply-to <messageId>] [--references <ids>]
 *
 * When --in-reply-to is given, In-Reply-To and References headers are included
 * in the API payload's `headers` object (verified against the Cloudflare Email
 * Service REST docs: the send endpoint accepts a `headers` object).
 *
 * On success appends {"to","subject","at","summary"} to study/replies-log.jsonl.
 * Refuses to send when the recipient's domain is in study/suppression.jsonl.
 */
import { readFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadSuppression, domainOf } from './suppression.mjs';
import { loadEnv } from './env.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FROM = 'ClearLabel <info@clearlabel.eu>';
const API = 'https://api.cloudflare.com/client/v4';
const REPLIES_LOG = join(HERE, '..', 'study', 'replies-log.jsonl');

const sendOne = async (env, { to, subject, body, inReplyTo, references }) => {
  const payload = { from: FROM, to, subject, text: body };
  if (inReplyTo || references) {
    payload.headers = {};
    if (inReplyTo) {
      payload.headers['In-Reply-To'] = inReplyTo;
      // Include References too; fall back to the messageId when not supplied.
      payload.headers.References = references || inReplyTo;
    } else if (references) {
      payload.headers.References = references;
    }
  }
  const res = await fetch(`${API}/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.success !== false, status: res.status, detail: JSON.stringify(json).slice(0, 200) };
};

const main = async () => {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };
  const to = get('--to');
  const subject = get('--subject');
  const bodyFile = get('--body-file');
  const inReplyTo = get('--in-reply-to');
  const references = get('--references');

  if (!to || !to.includes('@') || !subject || !bodyFile) {
    console.error(
      'usage: node tools/reply-mail.mjs --to <addr> --subject <s> --body-file <path> [--in-reply-to <messageId>] [--references <ids>]'
    );
    process.exit(1);
  }

  const env = await loadEnv(HERE);
  if (!env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN) {
    console.error('Missing CF_ACCOUNT_ID or CF_EMAIL_API_TOKEN in .env — nothing sent.');
    process.exit(1);
  }

  const suppressed = await loadSuppression();
  if (suppressed.has(domainOf(to))) {
    console.error(`refusing to send: ${domainOf(to)} is suppressed`);
    process.exit(1);
  }

  const body = (await readFile(bodyFile, 'utf8')).trim();
  if (!body) {
    console.error('reply-mail: body-file is empty');
    process.exit(1);
  }

  const r = await sendOne(env, { to, subject, body, inReplyTo, references });
  if (!r.ok) {
    console.error(`reply-mail: FAILED (${r.status}): ${r.detail}`);
    process.exit(1);
  }

  await appendFile(REPLIES_LOG, `${JSON.stringify({
    to,
    subject,
    at: new Date().toISOString(),
    summary: body.slice(0, 120),
  })}\n`);

  console.log(`sent: ${to} | ${subject}`);
};

main().catch((err) => {
  console.error(`reply-mail: fatal: ${err.message}`);
  process.exit(1);
});
