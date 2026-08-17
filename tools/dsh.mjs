#!/usr/bin/env node
/**
 * Client for the local DeepSeek Harness (dsh) at 127.0.0.1:3080.
 *
 * Protocol, reverse-engineered from the running server (v0.0.1):
 *   POST /api/<method>  with body
 *   { type:"client-request", rpcId:<uuid>, method:<same>, payload:{...} }
 *
 * Methods in use:
 *   session.create  -> { sessionId, agentPreset }
 *   session.prompt  <- { sessionId, content:[{type:"text",text}], mode:"queue"|"steer" }
 *   session.history -> { events:[{event:{type,seq,time,data}}] }
 *
 * NOTE: the harness runs a full coding agent (shell + file edit) with
 * sandbox/mode=workspace-write and approval/policy=ask. Anything needing a
 * privileged action will BLOCK on an approval prompt in the harness UI.
 * For unattended use, keep tasks read-only/analytical.
 *
 * Usage:
 *   node tools/dsh.mjs --prompt "..."                  # one-shot, waits for reply
 *   node tools/dsh.mjs --file p.txt --out r.md
 *   node tools/dsh.mjs --attach <sessionId> [--out r.md]
 *   node tools/dsh.mjs --prompt "..." --timeout <ms>
 *   node tools/dsh.mjs --health
 *
 * Flags:
 *   --prompt <text>    prompt text (use this or --file)
 *   --file <path>      read the prompt from a file
 *   --attach <id>      poll an existing session from its current end (no create/prompt)
 *   --timeout <ms>     poll deadline in milliseconds (default 900000)
 *   --out <path>       also write the result to a file
 *   --verbose          log event types to stderr while polling
 *   --health           print host.describe as JSON and exit
 *
 * Exit codes:
 *   0  done      turn/end reached; assistant text printed (stdout and/or --out)
 *   2  timeout   deadline hit; session keeps running server-side (re-attach with --attach)
 *   3  question  agent asked a question via ask_user_question
 */
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const BASE = process.env.DSH_URL ?? 'http://127.0.0.1:3080/api';
const POLL_MS = 2500;
const DEFAULT_TIMEOUT_MS = 900000;
const QUESTION_TOOL = 'ask_user_question';

export const rpc = async (method, payload = {}) => {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload }),
  });
  if (!res.ok) throw new Error(`dsh ${method}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json.result ?? {};
  if (!result.ok) throw new Error(`dsh ${method}: ${JSON.stringify(result.error).slice(0, 300)}`);
  return result.value;
};

export const createSession = async () => (await rpc('session.create')).sessionId;

const textFrom = (message) =>
  (message?.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

/** Return the ask_user_question arguments for a tool/call event, or null. */
const questionFrom = (ev) => {
  if (ev.type !== 'tool/call') return null;
  const data = ev.data ?? {};
  const name = data.name ?? data.call?.name;
  if (name !== QUESTION_TOOL) return null;
  return data.arguments ?? data.call?.arguments ?? data;
};

/**
 * Send a prompt (or attach to an existing session) and wait for the turn to
 * finish. Returns { sessionId, text }. Throws on timeout (code 2) or question
 * (code 3).
 */
export const ask = async (prompt, { sessionId, timeoutMs = DEFAULT_TIMEOUT_MS, onEvent, onSession, attach = false } = {}) => {
  let sid = sessionId;
  if (attach) {
    if (!sid) throw new Error('dsh: --attach requires a sessionId');
  } else {
    sid = sid ?? (await createSession());
    await rpc('session.prompt', {
      sessionId: sid,
      content: [{ type: 'text', text: prompt }],
      mode: 'queue',
    });
  }
  onSession?.(sid);

  // Start from the beginning, unless attaching: then start from the session's
  // current end so we only observe events that arrive after we attach.
  let lastSeq = -1;
  if (attach) {
    const { events } = await rpc('session.history', { sessionId: sid });
    for (const wrapper of events) {
      const seq = wrapper.event?.seq;
      if (typeof seq === 'number' && seq > lastSeq) lastSeq = seq;
    }
  }

  const deadline = Date.now() + timeoutMs;
  let answer = '';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const { events } = await rpc('session.history', { sessionId: sid });
    for (const wrapper of events) {
      const ev = wrapper.event ?? {};
      if (ev.seq <= lastSeq) continue;
      lastSeq = ev.seq;
      onEvent?.(ev);
      if (ev.type === 'assistant/message') {
        const t = textFrom(ev.data?.message);
        if (t) answer = t;
      }
      // approval/* means the agent wants a privileged action nobody is watching
      if (ev.type?.startsWith('approval/') && ev.data?.status === 'pending') {
        throw new Error('dsh: agent is blocked on an approval prompt in the harness UI');
      }
      const question = questionFrom(ev);
      if (question) {
        throw Object.assign(
          new Error(`DSH-QUESTION session=${sid}\n${JSON.stringify(question, null, 2)}`),
          { code: 3, sessionId: sid, question },
        );
      }
      if (ev.type === 'turn/end') {
        return { sessionId: sid, text: answer };
      }
    }
  }
  throw Object.assign(
    new Error(`DSH-TIMEOUT session=${sid}`),
    { code: 2, sessionId: sid },
  );
};

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const main = async () => {
  if (process.argv.includes('--health')) {
    const h = await rpc('host.describe');
    console.log(JSON.stringify(h, null, 2));
    return;
  }

  const attach = process.argv.includes('--attach');
  const attachId = arg('attach');
  const out = arg('out');
  const verbose = process.argv.includes('--verbose');
  const timeoutMs = Number(arg('timeout', String(DEFAULT_TIMEOUT_MS)));

  let prompt = null;
  if (attach) {
    if (!attachId) {
      console.error('dsh: --attach requires a sessionId');
      process.exit(1);
    }
  } else {
    prompt = arg('file') ? await readFile(arg('file'), 'utf8') : arg('prompt');
    if (!prompt) {
      console.error('usage: node tools/dsh.mjs --prompt "..." | --file p.txt | --attach <id> [--out r.md] [--timeout ms] | --health');
      process.exit(1);
    }
  }

  try {
    const { text } = await ask(prompt, {
      sessionId: attach ? attachId : undefined,
      timeoutMs,
      attach,
      onSession: (sid) => console.error(`dsh: session ${sid}`),
      onEvent: verbose ? (e) => console.error(`  · ${e.type}`) : undefined,
    });
    if (out) { await writeFile(out, text); console.error(`wrote ${out} (${text.length} chars)`); }
    else console.log(text);
  } catch (e) {
    if (e?.code === 2 || e?.code === 3) {
      if (out) await writeFile(out, e.message);
      console.log(e.message);
      process.exit(e.code);
    }
    throw e;
  }
};

const runAsMain =
  typeof process.argv[1] === 'string' &&
  process.argv[1].length > 0 &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (runAsMain) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
