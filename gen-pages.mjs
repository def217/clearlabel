#!/usr/bin/env node
// WARNING before regenerating:
// - TODAY constant rewrites every emitted "Last reviewed" date and sitemap lastmod to the run date.
// - Favicon/brand-svg path data here has drifted from the checked-in vendor pages - diff before overwrite.
// - Chrome (header/footer/head links/Clarity) is synced to site-chrome canonical blocks as of 2026-08-18;
//   if the site chrome changes again, update these templates first.
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
  pl: 'Rozmawiasz z asystentem AI (sztuczna inteligencja). Może on popełniać błędy — w każdej chwili możesz poprosić o rozmowę z człowiekiem.',
  pt: 'Está a falar com um assistente de IA. Ele pode cometer erros — peça para falar com uma pessoa a qualquer momento.',
  sv: 'Du chattar med en AI-assistent. Den kan göra misstag — be när som helst om att få prata med en människa.',
  da: 'Du chatter med en AI-assistent. Den kan begå fejl — bed når som helst om at tale med et menneske.',
  fi: 'Keskustelet tekoälyavustajan kanssa. Se voi tehdä virheitä — voit milloin tahansa pyytää keskustelua ihmisen kanssa.',
  lt: 'Jūs kalbatės su dirbtinio intelekto asistentu. Jis gali klysti — bet kada galite paprašyti, kad atsakytų žmogus.',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* Canonical page chrome — must stay byte-identical to the skip-link/header/
   footer blocks carried by every checked-in *.html (styled by site-chrome.css).
   Root-relative links, so the same markup works at any directory depth. */
const CHROME_HEADER = `<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header" id="top">
  <div class="container">
    <a class="brand" href="/">
      <svg class="brand-mark" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7l4-4Z"/><circle cx="12" cy="7.5" r="1.5"/><path d="m8.75 13.5 2.4 2.5 4.1-4.5"/></svg>
      <span class="brand-name">ClearLabel</span>
    </a>
    <nav aria-label="Primary">
      <ul class="nav-links">
        <li><a href="/#rules">The rules</a></li>
        <li><a href="/#timeline">Dates</a></li>
        <li><a href="/label/">Label images</a></li>
        <li><a href="/study/">Study</a></li>
        <li><a href="/nis2/">NIS2 check</a></li>
        <li><a href="/#pack">Compliance Pack</a></li>
        <li><a href="/#faq">FAQ</a></li>
      </ul>
    </nav>
    <div class="header-cta">
      <a class="btn btn-ink" href="/#scan">Scan a page<span class="free-tag">free</span></a>
    </div>
  </div>
</header>`;

/* Microsoft Clarity — byte-identical to the snippet on every checked-in page. */
const CLARITY = `<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "y4cqleaxfo");
</script>`;

const CHROME_FOOTER = `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <span class="brand">
        <svg class="brand-mark" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7l4-4Z"/><circle cx="12" cy="7.5" r="1.5"/><path d="m8.75 13.5 2.4 2.5 4.1-4.5"/></svg>
        <span class="brand-name">ClearLabel</span>
      </span>
      <p class="footer-disclaimer">EU AI Act Article 50 transparency checks. Information and document drafts only. Not a law firm, not legal advice.</p>
      <a class="footer-mail" href="mailto:info@clearlabel.eu">info@clearlabel.eu</a>
    </div>
    <div class="footer-col">
      <h3>Tools</h3>
      <ul>
        <li><a href="/#scan">Page scanner</a></li>
        <li><a href="/label/">Image label generator</a></li>
        <li><a href="/pack/">Sample Compliance Pack</a></li>
        <li><a href="/guides/chatbot-disclosure/">Guide: chatbot disclosure</a></li>
        <li><a href="/guides/december-2026-deadline/">Guide: the 2 Dec 2026 deadline</a></li>
        <li><a href="/guides/penalties/">Guide: fines &amp; enforcement</a></li>
        <li><a href="/guides/ai-product-content/">Guide: AI product content</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h3>Data</h3>
      <ul>
        <li><a href="/study/">883-site study and method</a></li>
        <li><a href="/vendors/">Vendor fingerprints</a></li>
        <li><a href="https://github.com/def217/clearlabel">Source and dataset on GitHub</a></li>
        <li><a href="/ai-transparency/">How we use AI: our own notice</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h3>Primary sources</h3>
      <ul>
        <li><a href="https://eur-lex.europa.eu/eli/reg/2024/1689/oj" rel="noopener">Regulation (EU) 2024/1689</a></li>
        <li><a href="https://artificialintelligenceact.eu/article/50/" rel="noopener">AI Act Article 50</a></li>
        <li><a href="https://artificialintelligenceact.eu/article/99/" rel="noopener">Article 99 penalties</a></li>
      </ul>
    </div>
    <p class="footer-legal">Vendor fingerprint data is open source under CC-BY-4.0. Questions or corrections: <a href="mailto:info@clearlabel.eu">info@clearlabel.eu</a></p>
  </div>
</footer>`;

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
  const desc = `${a.verdict} Where to put the AI disclosure in ${v.name}, in twelve languages, and the deadlines that actually apply after the Digital Omnibus.`;

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
<link rel="stylesheet" href="/fonts-plex.css">
<link rel="stylesheet" href="/site-chrome.css">
<link rel="stylesheet" href="../styles.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%2322407c'/%3E%3Cpath d='M18.6 12.4 12.4 18.6a1.6 1.6 0 0 1-2.3 0L4.5 13V4.5H13l5.6 5.6a1.6 1.6 0 0 1 0 2.3Z' fill='none' stroke='%23fff' stroke-width='1.7' stroke-linejoin='round'/%3E%3Ccircle cx='8.4' cy='8.4' r='1.15' fill='%23fff'/%3E%3C/svg%3E">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
${CLARITY}
</head>
<body>
${CHROME_HEADER}

<div class="wrap hero" id="main">
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
  <p class="page-meta">Last reviewed ${TODAY}</p>
</div></section>

${CHROME_FOOTER}
<!-- Cloudflare Web Analytics: cookieless, no fingerprinting -->\n<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "621bef7b2c064047a614e54e630b07c8"}'></script>\n</body></html>`;
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
<link rel="stylesheet" href="/fonts-plex.css">
<link rel="stylesheet" href="/site-chrome.css">
<link rel="stylesheet" href="../styles.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%2322407c'/%3E%3Cpath d='M18.6 12.4 12.4 18.6a1.6 1.6 0 0 1-2.3 0L4.5 13V4.5H13l5.6 5.6a1.6 1.6 0 0 1 0 2.3Z' fill='none' stroke='%23fff' stroke-width='1.7' stroke-linejoin='round'/%3E%3Ccircle cx='8.4' cy='8.4' r='1.15' fill='%23fff'/%3E%3C/svg%3E">
${CLARITY}
</head><body>
${CHROME_HEADER}
<div class="wrap hero" id="main">
  <h1>Article 50 by vendor</h1>
  <p class="lede">Whether the AI-disclosure duty applies, and exactly where in each vendor's console the wording goes. ${vendors.length} vendors covered.</p>
</div>
<section><div class="wrap">
${group('ai-native', 'Purpose-built AI agents', 'These are LLM agents by design. If they talk to people in the EU, Article 50(1) applies — there is no configuration that turns that off.')}
${group('ai-optional', 'Chat platforms with an AI mode', 'These ship both human-routed and AI-agent modes. The duty applies if the AI mode is enabled on your workspace, and only you can confirm that.')}
${group('rule-based', 'Scripted widgets', 'Likely outside the AI-system definition, but the "obvious to a reasonably well-informed person" test still applies.')}
</div></section>
${CHROME_FOOTER}
<!-- Cloudflare Web Analytics: cookieless, no fingerprinting -->\n<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "621bef7b2c064047a614e54e630b07c8"}'></script>\n</body></html>`;
};

const main = async () => {
  const db = JSON.parse(await readFile('data/vendors.json', 'utf8'));
  await mkdir('vendors', { recursive: true });
  await Promise.all(db.vendors.map((v) => writeFile(`vendors/${v.id}.html`, page(v, db.vendors))));
  await writeFile('vendors/index.html', hub(db.vendors));

  const urls = [
    { loc: `${BASE}/`, pri: '1.0' },
    { loc: `${BASE}/vendors/`, pri: '0.9' },
    { loc: `${BASE}/study/`, pri: '0.9' },
    { loc: `${BASE}/label/`, pri: '0.9' },
    { loc: `${BASE}/guides/chatbot-disclosure/`, pri: '0.8' },
    { loc: `${BASE}/guides/december-2026-deadline/`, pri: '0.8' },
    { loc: `${BASE}/ai-transparency/`, pri: '0.6' },
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
