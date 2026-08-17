#!/usr/bin/env node
/**
 * DeepSeek dispatch harness.
 * Lets the orchestrator hand mechanical work to a cheaper model instead of
 * doing it inline. Reads the key from .env; never logs it.
 *
 *   node tools/ds.mjs --prompt "..." [--system "..."] [--model flash|pro]
 *   node tools/ds.mjs --file prompt.txt --out result.md
 *   node tools/ds.mjs --batch items.jsonl --out results.jsonl --concurrency 4
 *     (each line: {"id":"...","system":"...","prompt":"..."})
 */
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = 'https://api.deepseek.com/chat/completions';
const MODELS = { flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' };

const loadKey = async () => {
  const raw = await readFile(join(HERE, '..', '.env'), 'utf8');
  const line = raw.split('\n').find((l) => l.trim().startsWith('DEEPSEEK_API_KEY='));
  if (!line) throw new Error('DEEPSEEK_API_KEY not found in .env');
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
};

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/** One completion. Retries on 429/5xx with backoff. */
/* deepseek-v4-pro is a reasoning model: its hidden reasoning tokens are drawn from
   the same max_tokens budget, so a low cap silently returns an empty `content`.
   Give reasoning models far more headroom. */
const DEFAULT_MAX = { 'deepseek-v4-pro': 16000, pro: 16000 };

export const ask = async (key, { system, prompt, model = 'flash', temperature = 0.3, maxTokens }) => {
  maxTokens = maxTokens ?? DEFAULT_MAX[model] ?? 4000;
  const body = {
    model: MODELS[model] ?? model,
    messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      const choice = json.choices?.[0] ?? {};
      const text = choice.message?.content ?? '';
      if (!text && choice.finish_reason === 'length') {
        throw new Error('DeepSeek returned no content: max_tokens exhausted by reasoning. Raise --max-tokens.');
      }
      return { text, usage: json.usage ?? null, finish: choice.finish_reason };
    }
    if (res.status !== 429 && res.status < 500) {
      throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 1200 * 2 ** attempt));
  }
  throw new Error('DeepSeek: retries exhausted');
};

const mapPool = async (items, limit, worker) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) await worker(items[cursor++]);
  });
  await Promise.all(runners);
};

const main = async () => {
  const key = await loadKey();
  const model = arg('model', 'flash');
  const out = arg('out');
  const batch = arg('batch');

  if (batch) {
    const lines = (await readFile(batch, 'utf8')).split('\n').filter((l) => l.trim());
    const items = lines.map((l) => JSON.parse(l));
    if (out) await writeFile(out, '');
    let done = 0, tokens = 0;
    await mapPool(items, Number(arg('concurrency', '4')), async (item) => {
      try {
        const r = await ask(key, { ...item, model: item.model ?? model });
        tokens += r.usage?.total_tokens ?? 0;
        const rec = JSON.stringify({ id: item.id, ok: true, text: r.text });
        out ? await appendFile(out, rec + '\n') : console.log(rec);
      } catch (e) {
        const rec = JSON.stringify({ id: item.id, ok: false, error: e.message });
        out ? await appendFile(out, rec + '\n') : console.log(rec);
      }
      if (++done % 5 === 0) console.error(`  ${done}/${items.length}`);
    });
    console.error(`DONE ${done}/${items.length}, ~${tokens} tokens`);
    return;
  }

  const prompt = arg('file') ? await readFile(arg('file'), 'utf8') : arg('prompt');
  if (!prompt) {
    console.error('usage: node tools/ds.mjs --prompt "..." | --file f.txt | --batch items.jsonl');
    process.exit(1);
  }
  const r = await ask(key, { system: arg('system'), prompt, model, maxTokens: arg('max-tokens') ? Number(arg('max-tokens')) : undefined });
  if (out) { await writeFile(out, r.text); console.error(`wrote ${out} (${r.usage?.total_tokens ?? '?'} tokens)`); }
  else console.log(r.text);
};

// argv[1] is a raw path; import.meta.url is percent-encoded, so compare as URLs.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
