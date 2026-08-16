#!/usr/bin/env node
/** Generates one Article 50 guidance page per vendor from data/vendors.json. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://clearlabel.eu';
const TODAY = '2026-08-16';

const DISCLOSURE = {
  en: "You're chatting with an AI assistant. It can make mistakes — ask for a human at any time.",
  de: 'Sie chatten mit einem KI-Assistenten. Er kann Fehler machen — fragen Sie jederzeit nach einem Menschen.',
  fr: 'Vous discutez avec un assistant IA. Il peut se tromper — demandez un conseiller humain à tout moment.',
  es: 'Estás hablando con un asistente de IA. Puede cometer errores — pide hablar con una persona cuando quieras.',
  it: 'Stai parlando con un assistente IA. Può commettere errori — puoi chiedere un operatore umano in qualsiasi momento.',
  nl: 'Je chat met een AI-assistent. Deze kan fouten maken — vraag altijd om een medewerker.',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const APPLIES = {
  'ai-native': {
    verdict: 'Yes — this is an AI system by design.',
    tone: 'v-action-required',
    body: 'is an LLM-based agent. There is no configuration in which it is not an AI system. If it speaks to people in the EU, Article 50(1) requires you to tell them they are dealing with an AI, clearly and no later than the first interaction.',
  },
  'ai-optional': {
    verdict: 'Only if the AI mode is switched on — and you are the one who has to check.',
    tone: 'v-check-required',
    body: 'ships both human-routed and AI-agent modes. An outside scan cannot see which one your workspace runs. If the AI answers first, Article 50(1) applies to you as the deployer, not to the vendor. If a human always answers, it does not. Either way, write down which it is and when you checked — that record is your evidence.',
  },
  'rule-based': {
    verdict: 'Probably not as an AI system — but the "obvious" test can still catch you.',
    tone: 'v-check-required',
    body: 'runs scripted flows rather than a language model, so it is likely outside the definition of an AI system. Article 50(1) still turns on whether interaction with an AI is obvious to a reasonably well-informed person. A scripted widget presenting a human first name and a headshot is the scenario the test exists for.',
  },
};

const page = (v, all) => {
  const a = APPLIES[v.aiNature] ?? APPLIES['ai-optional'];
  const related = all.filter((o) => o.id !== v.id && o.aiNature === v.aiNature).slice(0, 6);
  const rows = Object.entries(DISCLOSURE)
    .map(([lang, text]) => `<tr><td style="width:54px"><code>${lang}</code></td><td>${esc(text)}</td></tr>`)
    .join('');
  const faq = [
    [`Does ${v.name} need an AI disclosure under the EU AI Act?`, `${a.verdict} ${v.name} ${a.body}`],
    ['Is my vendor responsible, or am I?', `You are. Article 50(1) places the duty on the provider of the AI system and, for deepfakes and public-interest text under 50(4), on the deployer. In practice, if you enabled the AI mode in ${v.name} and pointed it at your customers, the exposure is yours.`],
    ['When did this start applying?', 'Article 50(1) has applied since 2 August 2026. The machine-readable marking duty in Article 50(2) has a transition to 2 December 2026 for systems already on the market. The Digital Omnibus deferred most high-risk obligations to 2 December 2027 but did not defer Article 50.'],
  ];
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([q, ans]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: ans },
    })),
  };
  const title = `${v.name} and EU AI Act Article 50 — what you must disclose`;
  const desc = `${a.verdict} Where to put the AI disclosure in ${v.name}, in six languages, and the deadlines that actually apply after the Digital Omnibus.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}/vendors/${v.id}.html">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="stylesheet" href="../styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏷️</text></svg>">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head>
<body>
<header class="top"><div class="wrap topbar">
  <a class="brand" href="../">
    <svg class="tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.4" fill="currentColor"/></svg>
    ClearLabel</a>
  <nav class="topnav"><a href="../#scan">Free scan</a><a href="./">All vendors</a><a href="../#pack">Compliance Pack</a></nav>
</div></header>

<div class="wrap hero">
  <p style="font-size:.85rem;color:var(--muted);margin-bottom:14px"><a href="../">ClearLabel</a> → <a href="./">Vendors</a> → ${esc(v.name)}</p>
  <h1>${esc(v.name)} and EU AI&nbsp;Act Article&nbsp;50</h1>
  <p class="lede">${esc(a.verdict)}</p>
</div>

<div class="wrap">
  <div class="verdict ${a.tone}" style="margin-bottom:26px">
    <div class="vi">${v.aiNature === 'ai-native' ? '\u{1F534}' : '\u{1F7E0}'}</div>
    <div><h3>Does the disclosure duty apply?</h3>
    <p>${esc(v.name)} ${esc(a.body)}</p></div>
  </div>
  ${v.aiProduct ? `<p class="rule"><strong>AI product to check:</strong> ${esc(v.aiProduct)}. ${esc(v.note ?? '')}</p>` : `<p class="rule">${esc(v.note ?? '')}</p>`}
</div>

<section>
  <div class="wrap">
    <h2>Where the disclosure goes in ${esc(v.name)}</h2>
    <div class="card" style="margin-bottom:20px">
      <div class="num">CONSOLE PATH</div>
      <p style="margin-bottom:0;font-size:1.03rem">${esc(v.consolePath ?? v.disclosureHook)}</p>
    </div>
    <p>Article 50(1) requires the information to be given <strong>clearly and distinguishably, at the latest at the time of the first interaction</strong>. A line buried in your privacy policy does not satisfy that. It has to be where the conversation starts.</p>

    <h3 style="margin-top:26px">Wording you can paste in</h3>
    <div class="tablewrap"><table class="detected" style="width:100%;border-collapse:collapse;font-size:.93rem"><tbody>${rows}</tbody></table></div>
    <p style="font-size:.88rem;color:var(--muted);margin-top:12px">Serve the language your customer is browsing in. Article 50 also requires the disclosure to meet accessibility requirements, so do not deliver it as an image.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <h2>Deadlines that actually apply</h2>
    <p class="rule"><strong>2 August 2026 — in force.</strong> Art. 50(1) AI-interaction disclosure. Art. 50(4) deepfake and public-interest text disclosure.</p>
    <p class="rule"><strong>2 December 2026.</strong> Art. 50(2) machine-readable marking of synthetic audio, image, video and text, for systems already on the market before 2 Aug 2026.</p>
    <p class="rule"><strong>2 December 2027 — deferred.</strong> Most standalone high-risk (Annex III) duties, pushed back 16 months by the Digital Omnibus approved on 29 June 2026. <strong>Article 50 was not deferred.</strong></p>
    <p>Penalties for transparency breaches sit under Art. 99(4): up to €15m or 3% of worldwide annual turnover, whichever is higher, with the actual amounts set by each member state.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <div class="offer">
      <h3 style="margin-top:0">Check what your live site is actually doing</h3>
      <p>The scan reads your public HTML, fingerprints ${esc(v.name)} and 35 other vendors, and looks for disclosure wording in ten EU languages. Free, no signup, runs in your browser.</p>
      <a class="btn" href="../#scan" style="display:inline-block;text-decoration:none">Scan your site free</a>
    </div>
  </div>
</section>

${related.length ? `<section class="tight"><div class="wrap"><h2>Same situation, other vendors</h2><div class="grid3">${related
    .map((r) => `<div class="card"><h3 style="margin-bottom:6px"><a href="./${r.id}.html" style="text-decoration:none">${esc(r.name)}</a></h3><p style="font-size:.89rem;color:var(--muted);margin:0">${esc(r.aiProduct ?? r.aiNature)}</p></div>`)
    .join('')}</div></div></section>` : ''}

<section class="tight"><div class="wrap">
  <h2>Questions</h2>
  ${faq.map(([q, ans]) => `<details><summary>${esc(q)}</summary><div class="body"><p>${esc(ans)}</p></div></details>`).join('')}
</div></section>

<footer><div class="wrap">
  <p><strong>ClearLabel</strong> — EU AI Act Article 50 transparency checks. Information and document drafts only. Not legal advice, not a law firm.</p>
  <p>Last reviewed ${TODAY} · <a href="https://github.com/def217/clearlabel">Open dataset on GitHub</a> · <a href="https://artificialintelligenceact.eu/article/50/">Article 50 text</a></p>
</div></footer>
</body></html>`;
};

const hub = (vendors) => {
  const group = (nature, heading, blurb) => {
    const list = vendors.filter((v) => v.aiNature === nature);
    if (!list.length) return '';
    return `<h2 style="margin-top:34px">${heading}</h2><p style="color:var(--muted);max-width:65ch">${blurb}</p>
      <div class="grid3" style="margin-top:16px">${list
        .map((v) => `<div class="card"><h3 style="margin-bottom:5px"><a href="./${v.id}.html" style="text-decoration:none">${esc(v.name)}</a></h3>
          <p style="font-size:.88rem;color:var(--muted);margin:0">${esc(v.aiProduct ?? 'Disclosure placement and wording')}</p></div>`)
        .join('')}</div>`;
  };
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI chat vendors and EU AI Act Article 50 — disclosure guide by vendor</title>
<meta name="description" content="Where the AI disclosure goes in Intercom, Zendesk, Crisp, Tidio, Gorgias, HubSpot, Chatbase and 29 more — plus whether Article 50(1) applies to each.">
<link rel="canonical" href="${BASE}/vendors/">
<link rel="stylesheet" href="../styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏷️</text></svg>">
</head><body>
<header class="top"><div class="wrap topbar">
  <a class="brand" href="../"><svg class="tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.4" fill="currentColor"/></svg>ClearLabel</a>
  <nav class="topnav"><a href="../#scan">Free scan</a><a href="../#pack">Compliance Pack</a></nav>
</div></header>
<div class="wrap hero">
  <h1>Article 50 by vendor</h1>
  <p class="lede">Whether the AI-disclosure duty applies, and exactly where in each vendor's console the wording goes. ${vendors.length} vendors covered.</p>
</div>
<section><div class="wrap">
${group('ai-native', 'Purpose-built AI agents', 'These are LLM agents by design. If they talk to people in the EU, Article 50(1) applies — there is no configuration that turns that off.')}
${group('ai-optional', 'Chat platforms with an AI mode', 'These ship both human-routed and AI-agent modes. The duty applies if the AI mode is enabled on your workspace, and only you can confirm that.')}
${group('rule-based', 'Scripted widgets', 'Likely outside the AI-system definition, but the "obvious to a reasonably well-informed person" test still applies.')}
</div></section>
<footer><div class="wrap"><p><strong>ClearLabel</strong> — Information only, not legal advice. <a href="https://github.com/def217/clearlabel">Open dataset on GitHub</a></p></div></footer>
</body></html>`;
};

const main = async () => {
  const db = JSON.parse(await readFile('data/vendors.json', 'utf8'));
  await mkdir('vendors', { recursive: true });
  await Promise.all(db.vendors.map((v) => writeFile(`vendors/${v.id}.html`, page(v, db.vendors))));
  await writeFile('vendors/index.html', hub(db.vendors));

  const urls = [
    { loc: `${BASE}/`, pri: '1.0' },
    { loc: `${BASE}/vendors/`, pri: '0.9' },
    ...db.vendors.map((v) => ({ loc: `${BASE}/vendors/${v.id}.html`, pri: '0.8' })),
  ];
  await writeFile(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><priority>${u.pri}</priority></url>`)
      .join('\n')}\n</urlset>\n`
  );
  await writeFile('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
  console.log(`generated ${db.vendors.length} vendor pages + hub + sitemap (${urls.length} urls)`);
};

main().catch((e) => { console.error(e); process.exit(1); });
