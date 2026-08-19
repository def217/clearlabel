#!/usr/bin/env node
/**
 * Dashboard stats via the Cloudflare GraphQL Analytics API.
 * https://developers.cloudflare.com/analytics/graphql-api/
 *
 * Reads CF_ACCOUNT_ID and CF_READ_TOKEN from ../.env (never committed).
 *
 * Visitors come from the Account-scoped rumPageloadEventsAdaptiveGroups dataset
 * for clearlabel.eu's Web Analytics site tag. Email delivery stats live under a
 * Zone-scoped dataset (emailSendingAdaptiveGroups under viewer.zones), so they
 * require a Zone-scoped token permission and are reported as unavailable until
 * the token is widened.
 *
 * Usage:
 *   node tools/cf-stats.mjs [--days N]            # trailing N-day window, default 7
 *   node tools/cf-stats.mjs --sources [--days N]  # + referrer/path top-10 tables
 *
 * Without --sources it prints a single JSON object to stdout:
 *   {"visitors": <number>, "sinceDate": "YYYY-MM-DD", "untilDate": "YYYY-MM-DD",
 *    "email": <object-or-null>, "emailNote": <string-or-null>}
 *
 * With --sources it prints that same JSON line, then two aligned text tables —
 * the top-10 referrers and top-10 request paths by trailing-window pageloads,
 * each with a total and a yesterday column — to spot a traffic spike's source.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { loadEnv } from './env.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = 'https://api.cloudflare.com/client/v4';

// Verified real Cloudflare Web Analytics site tag for clearlabel.eu (matched to
// the requestHost dimension against the live account). A different value
// recorded elsewhere in project notes, 621bef7b2c064047a614e54e630b07c8, is
// stale/wrong and must NOT be used.
const SITE_TAG = '5d2a256b83a042c0b69a0758613518ac';

const EMAIL_UNAVAILABLE_NOTE = 'email stats unavailable: CF_READ_TOKEN needs a Zone-scoped Email/Analytics read permission with clearlabel.eu selected as a Zone Resource';

const VISITORS_QUERY = `query($accountTag: String!, $siteTag: String!, $since: Date!, $until: Date!) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      rumPageloadEventsAdaptiveGroups(
        filter: {siteTag: $siteTag, date_geq: $since, date_leq: $until}
        limit: 1
      ) {
        count
        sum { visits }
      }
    }
  }
}`;

const EMAIL_QUERY = `query($zoneTag: String!, $since: Date!, $until: Date!) {
  viewer {
    zones(filter: {zoneTag: $zoneTag}) {
      emailSendingAdaptiveGroups(filter: {date_geq: $since, date_leq: $until}, limit: 100) {
        count
        dimensions { status }
      }
    }
  }
}`;

// ---- traffic sources -------------------------------------------------------
// Grouped by the two dimensions the Cloudflare dashboard's own Web Analytics
// query (GetRumAnalyticsTopNs) uses: refererHost for the top referrers and
// requestPath for the top paths, ordered by count_DESC where `count` is the
// number of pageloads in each group. The schema splits a full referer into
// refererHost + refererPath, so host-only is the natural "where from" answer.
// To re-verify against the live schema instead of trusting these names,
// introspect the API with the token:
//   query { __type(name: "RumPageloadEventsAdaptiveGroupsDimensions") {
//     fields { name } } }
// and confirm refererHost/requestPath (dimensions) and count (metric).
const SOURCES_QUERY = `query($accountTag: String!, $siteTag: String!, $since: Date!, $until: Date!, $yesterday: Date!) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      referers: rumPageloadEventsAdaptiveGroups(
        filter: {siteTag: $siteTag, date_geq: $since, date_leq: $until}
        limit: 10
        orderBy: [count_DESC]
      ) {
        count
        dimensions { refererHost }
      }
      referersYesterday: rumPageloadEventsAdaptiveGroups(
        filter: {siteTag: $siteTag, date_geq: $yesterday, date_leq: $yesterday}
        limit: 10
        orderBy: [count_DESC]
      ) {
        count
        dimensions { refererHost }
      }
      paths: rumPageloadEventsAdaptiveGroups(
        filter: {siteTag: $siteTag, date_geq: $since, date_leq: $until}
        limit: 10
        orderBy: [count_DESC]
      ) {
        count
        dimensions { requestPath }
      }
      pathsYesterday: rumPageloadEventsAdaptiveGroups(
        filter: {siteTag: $siteTag, date_geq: $yesterday, date_leq: $yesterday}
        limit: 10
        orderBy: [count_DESC]
      ) {
        count
        dimensions { requestPath }
      }
    }
  }
}`;

const isoDate = (t) => new Date(t).toISOString().slice(0, 10);

const graphql = async (env, query, variables) => {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_READ_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors?.length) {
    throw new Error(JSON.stringify(json.errors ?? json).slice(0, 300));
  }
  return json.data;
};

const refererLabel = (v) => (v && v.trim() ? v : '(direct)');

const rowsFor = (groups, dimKey, labelFor = (v) => v) => {
  const rows = [];
  for (const g of groups ?? []) {
    rows.push({ label: labelFor(g.dimensions?.[dimKey] ?? ''), total: g.count ?? 0 });
  }
  return rows;
};

const withYesterday = (totalRows, groups, dimKey, labelFor) => {
  const yesterday = new Map();
  for (const g of groups ?? []) {
    const label = labelFor(g.dimensions?.[dimKey] ?? '');
    yesterday.set(label, (yesterday.get(label) ?? 0) + (g.count ?? 0));
  }
  return totalRows.map((r) => ({ ...r, yesterday: yesterday.get(r.label) ?? 0 }));
};

const renderTable = (labelHeader, rows) => {
  const labelW = Math.max(labelHeader.length, ...rows.map((r) => r.label.length));
  const totalW = Math.max('total'.length, ...rows.map((r) => String(r.total).length));
  const yesterdayW = Math.max('yesterday'.length, ...rows.map((r) => String(r.yesterday).length));
  const lines = [
    `${labelHeader.padEnd(labelW)}  ${'total'.padStart(totalW)}  ${'yesterday'.padStart(yesterdayW)}`,
  ];
  for (const r of rows) {
    lines.push(
      `${r.label.padEnd(labelW)}  ${String(r.total).padStart(totalW)}  ${String(r.yesterday).padStart(yesterdayW)}`,
    );
  }
  return lines.join('\n');
};

const renderSourcesSection = (refererRows, pathRows, sinceDate, untilDate, yesterdayDate) => [
  `traffic sources (top 10 by pageloads ${sinceDate}..${untilDate}; yesterday ${yesterdayDate})`,
  '',
  renderTable('referrer', refererRows),
  '',
  renderTable('path', pathRows),
].join('\n');

const fetchSources = async (env, sinceDate, untilDate, yesterdayDate) => {
  const data = await graphql(env, SOURCES_QUERY, {
    accountTag: env.CF_ACCOUNT_ID,
    siteTag: SITE_TAG,
    since: sinceDate,
    until: untilDate,
    yesterday: yesterdayDate,
  });
  const acc = data.viewer.accounts[0];
  const refererRows = withYesterday(
    rowsFor(acc.referers, 'refererHost', refererLabel),
    acc.referersYesterday,
    'refererHost',
    refererLabel,
  );
  const pathRows = withYesterday(
    rowsFor(acc.paths, 'requestPath'),
    acc.pathsYesterday,
    'requestPath',
    (v) => v,
  );
  return renderSourcesSection(refererRows, pathRows, sinceDate, untilDate, yesterdayDate);
};

const main = async () => {
  const args = process.argv.slice(2);
  const env = await loadEnv(HERE);
  if (!env.CF_ACCOUNT_ID || !env.CF_READ_TOKEN) {
    console.error('cf-stats: missing CF_ACCOUNT_ID or CF_READ_TOKEN in .env');
    process.exit(1);
  }

  const daysIx = args.indexOf('--days');
  const n = daysIx === -1 ? 7 : Number(args[daysIx + 1]);
  const days = Number.isInteger(n) && n > 0 ? n : 7;

  const untilDate = isoDate(Date.now());
  const sinceDate = isoDate(Date.now() - (days - 1) * 86_400_000);

  let visitors = null;
  try {
    const data = await graphql(env, VISITORS_QUERY, {
      accountTag: env.CF_ACCOUNT_ID,
      siteTag: SITE_TAG,
      since: sinceDate,
      until: untilDate,
    });
    visitors = data.viewer.accounts[0].rumPageloadEventsAdaptiveGroups[0]?.sum?.visits ?? 0;
  } catch (err) {
    console.error(`cf-stats: visitors query failed: ${err.message}`);
  }

  let email = null;
  let emailNote = null;
  try {
    const zoneRes = await fetch(`${API}/zones?name=clearlabel.eu`, {
      headers: { Authorization: `Bearer ${env.CF_READ_TOKEN}` },
    });
    const zoneJson = await zoneRes.json().catch(() => ({}));
    const zone = Array.isArray(zoneJson.result) ? zoneJson.result[0] : undefined;
    if (!zone) {
      emailNote = EMAIL_UNAVAILABLE_NOTE;
    } else {
      const data = await graphql(env, EMAIL_QUERY, {
        zoneTag: zone.id,
        since: sinceDate,
        until: untilDate,
      });
      const groups = data.viewer.zones[0].emailSendingAdaptiveGroups ?? [];
      const byStatus = {};
      for (const g of groups) {
        const status = g.dimensions?.status ?? 'unknown';
        byStatus[status] = (byStatus[status] ?? 0) + (g.count ?? 0);
      }
      email = byStatus;
    }
  } catch (err) {
    console.error(`cf-stats: email stats unavailable: ${err.message}`);
    emailNote = `email stats unavailable: ${err.message}`;
  }

  console.log(JSON.stringify({ visitors, sinceDate, untilDate, email, emailNote }));

  if (args.includes('--sources')) {
    const yesterdayDate = isoDate(Date.now() - 86_400_000);
    try {
      console.log();
      console.log(await fetchSources(env, sinceDate, untilDate, yesterdayDate));
    } catch (err) {
      console.error(`cf-stats: sources query failed: ${err.message}`);
    }
  }
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`cf-stats: fatal: ${err.message}`);
    process.exit(1);
  });
}

export { renderTable };
