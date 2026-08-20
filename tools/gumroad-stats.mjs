#!/usr/bin/env node
/**
 * Sales stats via the Gumroad API v2. https://app.gumroad.com/api
 *
 * Reads GUMROAD_ACCESS_TOKEN from ../.env (never committed, never printed).
 * Product names come from each sale's `product_name` field directly, so no
 * separate /v2/products call is made. Revenue is gross: sums `price` (cents)
 * as returned, with no netting for refunds/chargebacks and no exclusion of
 * Gumroad test purchases (sale.test === true).
 *
 * Usage:
 *   node tools/gumroad-stats.mjs           # human-readable summary
 *   node tools/gumroad-stats.mjs --json    # {fetchedAt, totalSales,
 *                                           #  totalRevenueEur, byProduct, lastSaleAt}
 *
 * Exit 0 on success; exit 1 with one stderr line on missing token, HTTP
 * failure, or an API-level {success:false}.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { loadEnv } from './env.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = 'https://api.gumroad.com/v2';
const MAX_PAGES = 20;

const round2 = (n) => Math.round(n * 100) / 100;

const buildSalesUrl = (token, pageKey) => {
  const url = new URL(`${API}/sales`);
  url.searchParams.set('access_token', token);
  if (pageKey) url.searchParams.set('page_key', pageKey);
  return url;
};

const nextSalesUrl = (token, json) => {
  if (json.next_page_url) {
    const url = new URL(json.next_page_url);
    if (!url.searchParams.get('access_token')) {
      url.searchParams.set('access_token', token);
    }
    return url;
  }
  if (json.next_page_key) return buildSalesUrl(token, json.next_page_key);
  return null;
};

const fetchJson = async (url) => {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`request failed: ${err.message}`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`${res.status} unauthorized (check GUMROAD_ACCESS_TOKEN)`);
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const json = await res.json().catch(() => null);
  if (!json || json.success !== true) {
    throw new Error(`api error: ${json?.message ?? 'malformed response'}`);
  }
  return json;
};

const fetchAllSales = async (token) => {
  const sales = [];
  let url = buildSalesUrl(token);
  for (let page = 0; page < MAX_PAGES && url; page += 1) {
    const json = await fetchJson(url);
    sales.push(...(json.sales ?? []));
    url = nextSalesUrl(token, json);
  }
  return sales;
};

const aggregate = (sales) => {
  const byProductCents = new Map();
  let totalCents = 0;
  let lastSaleAt = null;

  for (const sale of sales) {
    const cents = Number(sale.price) || 0;
    totalCents += cents;

    const name = sale.product_name || sale.product_permalink || sale.product_id || 'unknown';
    const prev = byProductCents.get(name) ?? { count: 0, cents: 0 };
    byProductCents.set(name, { count: prev.count + 1, cents: prev.cents + cents });

    const ts = sale.created_at ?? sale.timestamp ?? null;
    if (ts && (!lastSaleAt || new Date(ts) > new Date(lastSaleAt))) {
      lastSaleAt = new Date(ts).toISOString();
    }
  }

  const byProduct = {};
  for (const [name, v] of byProductCents) {
    byProduct[name] = { count: v.count, revenueEur: round2(v.cents / 100) };
  }

  return { totalSales: sales.length, totalRevenueEur: round2(totalCents / 100), byProduct, lastSaleAt };
};

const printHuman = (stats) => {
  console.log(`total sales: ${stats.totalSales}`);
  console.log(`total revenue: EUR ${stats.totalRevenueEur.toFixed(2)}`);
  const products = Object.entries(stats.byProduct);
  if (products.length === 0) {
    console.log('by product: (none)');
  } else {
    console.log('by product:');
    for (const [name, p] of products) {
      const label = p.count === 1 ? 'sale' : 'sales';
      console.log(`  ${name}: ${p.count} ${label}, EUR ${p.revenueEur.toFixed(2)}`);
    }
  }
  console.log(`last sale: ${stats.lastSaleAt ?? 'none'}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const env = await loadEnv(HERE);
  if (!env.GUMROAD_ACCESS_TOKEN) {
    console.error('gumroad: missing GUMROAD_ACCESS_TOKEN in .env');
    process.exit(1);
  }

  const sales = await fetchAllSales(env.GUMROAD_ACCESS_TOKEN);
  const stats = aggregate(sales);

  if (args.includes('--json')) {
    console.log(JSON.stringify({ fetchedAt: new Date().toISOString(), ...stats }));
    return;
  }

  printHuman(stats);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`gumroad: ${err.message}`);
    process.exit(1);
  });
}
