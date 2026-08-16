#!/usr/bin/env node
/**
 * ClearLabel CLI scanner.
 * Fetches public homepages and runs the shared detection core over the HTML.
 * Usage: node scanner/scan.mjs <url|@file> [...]
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scanHtml } from './core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(HERE, '..', 'data', 'vendors.json');
const TIMEOUT_MS = 20000;
const CONCURRENCY = 6;
const UA = 'ClearLabelBot/1.0 (+https://github.com/def217/clearlabel; EU AI Act Art.50 transparency check)';

const normalise = (raw) => (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);

const fetchPage = async (url, extraHeaders = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', ...extraHeaders },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, html: await res.text(), finalUrl: res.url };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
};

/** Public reader service used only when an origin refuses a direct read. */
const fetchViaReader = (url) => fetchPage(`https://r.jina.ai/${url}`, { 'x-respond-with': 'html' });

const scanOne = async (rawUrl, db) => {
  const url = normalise(rawUrl.trim());
  const direct = await fetchPage(url);
  const page = direct.ok ? direct : await fetchViaReader(url);
  if (!page.ok) return { url, ok: false, error: `${direct.error} (reader fallback: ${page.error})` };
  return { url, finalUrl: page.finalUrl, ok: true, bytes: page.html.length, ...scanHtml(page.html, db) };
};

/** Bounded-concurrency map that preserves input order. */
const mapPool = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
};

const expandArgs = async (args) => {
  const lists = await Promise.all(
    args.map(async (arg) => {
      if (!arg.startsWith('@')) return [arg];
      const body = await readFile(arg.slice(1), 'utf8');
      return body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    })
  );
  return lists.flat();
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('usage: node scanner/scan.mjs <url|@file> [...]');
    process.exit(1);
  }
  const db = JSON.parse(await readFile(DB_PATH, 'utf8'));
  const urls = await expandArgs(args);
  const results = await mapPool(urls, CONCURRENCY, (u) => scanOne(u, db));
  results.forEach((r) => console.log(JSON.stringify(r)));
};

main().catch((err) => {
  console.error('fatal:', err.message);
  process.exit(1);
});
