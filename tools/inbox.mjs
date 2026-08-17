#!/usr/bin/env node
/**
 * Inbound mail via IMAP (Hostinger mailbox info@clearlabel.eu).
 *
 * Reads IMAP_HOST / IMAP_PORT / IMAP_USER / IMAP_PASS from ../.env, the same
 * way tools/send-mail.mjs reads its Cloudflare credentials. IMAP_PORT defaults
 * to 993 when unset.
 *
 * Usage:
 *   node tools/inbox.mjs --list             # UNSEEN messages, one JSON line each (does not mark seen)
 *   node tools/inbox.mjs --read <uid>       # full parsed JSON for one message, then marks it \Seen
 *   node tools/inbox.mjs --health           # connect and print mailbox message count
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 993;
const TEXT_LIMIT = 4000;

const loadEnv = async () => {
  const body = await readFile(join(HERE, '..', '.env'), 'utf8');
  return Object.fromEntries(
    body.split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  );
};

const newClient = (env) =>
  new ImapFlow({
    host: env.IMAP_HOST,
    port: Number(env.IMAP_PORT) || DEFAULT_PORT,
    secure: true,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASS },
    logger: false,
  });

const firstAddress = (field) => field?.value?.[0]?.address ?? field?.text ?? '';

const asIso = (v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString() : v ?? '');

const asString = (v) => (Array.isArray(v) ? v.join(' ') : v ?? '');

const summarize = (parsed) => ({
  from: firstAddress(parsed.from),
  subject: parsed.subject ?? '',
  date: asIso(parsed.date),
  messageId: parsed.messageId ?? '',
  references: asString(parsed.references),
  text: (parsed.text ?? '').slice(0, TEXT_LIMIT),
});

const listUnseen = async (client) => {
  await client.mailboxOpen('INBOX');
  for await (const msg of client.fetch({ seen: false }, { source: true, uid: true }, { uid: true })) {
    const parsed = await simpleParser(msg.source);
    console.log(JSON.stringify({ uid: msg.uid, ...summarize(parsed) }));
  }
};

const readOne = async (client, uid) => {
  await client.mailboxOpen('INBOX');
  const msg = await client.fetchOne(uid, { source: true, uid: true }, { uid: true });
  if (!msg) {
    console.error(`inbox: no message with uid ${uid}`);
    process.exit(1);
  }
  const parsed = await simpleParser(msg.source);
  console.log(JSON.stringify({ uid, ...parsed }, null, 2));
  await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
};

const health = async (client) => {
  const mailbox = await client.mailboxOpen('INBOX');
  console.log(`messages: ${mailbox.exists}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const env = await loadEnv();
  if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASS) {
    console.error('inbox: IMAP_* env missing (see OWNER-ACTIONS)');
    process.exit(1);
  }

  const client = newClient(env);
  try {
    await client.connect();
  } catch (err) {
    console.error(`inbox: connect failed: ${err.message}`);
    process.exit(1);
  }

  try {
    if (args.includes('--health')) {
      await health(client);
    } else if (args.includes('--list')) {
      await listUnseen(client);
    } else if (args.includes('--read')) {
      const uid = Number(args[args.indexOf('--read') + 1]);
      if (!Number.isInteger(uid) || uid < 1) {
        console.error('usage: node tools/inbox.mjs --read <uid>');
        process.exit(1);
      }
      await readOne(client, uid);
    } else {
      console.error('usage: node tools/inbox.mjs --list | --read <uid> | --health');
      process.exit(1);
    }
  } finally {
    await client.logout().catch(() => {});
  }
};

main().catch((err) => {
  console.error(`inbox: fatal: ${err.message}`);
  process.exit(1);
});
