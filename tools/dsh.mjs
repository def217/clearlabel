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
 *   node tools/dsh.mjs --prompt "..."            # one-shot, waits for reply
 *   node tools/dsh.mjs --file p.txt --out r.md
 *   node tools/dsh.mjs --health
 */
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const BASE = process.env.DSH_URL ?? 'http://127.0.0.1:3080/api';
const POLL_MS = 2500;
const DEFAULT_TIMEOUT_MS = 300000;

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

/** Send a prompt and wait for the turn to finish. Returns the assistant text. */
export const ask = async (prompt, { sessionId, timeoutMs = DEFAULT_TIMEOUT_MS, onEvent } = {}) => {
  const sid = sessionId ?? (await createSession());
  await rpc('session.prompt', {
    sessionId: sid,
    content: [{ type: 'text', text: prompt }],
    mode: 'queue',
  });

  const deadline = Date.now() + timeoutMs;
  let lastSeq = -1;
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
      if (ev.type === 'turn/end') {
        return { sessionId: sid, text: answer };
      }
    }
  }
  throw new Error(`dsh: timed out after ${timeoutMs}ms`);
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
  const prompt = arg('file') ? await readFile(arg('file'), 'utf8') : arg('prompt');
  if (!prompt) {
    console.error('usage: node tools/dsh.mjs --prompt "..." | --file p.txt [--out r.md] | --health');
    process.exit(1);
  }
  const verbose = process.argv.includes('--verbose');
  const { text } = await ask(prompt, {
    timeoutMs: Number(arg('timeout', String(DEFAULT_TIMEOUT_MS))),
    onEvent: verbose ? (e) => console.error(`  · ${e.type}`) : undefined,
  });
  const out = arg('out');
  if (out) { await writeFile(out, text); console.error(`wrote ${out} (${text.length} chars)`); }
  else console.log(text);
};

if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
