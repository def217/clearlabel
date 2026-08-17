/** Builds the Article 50 Compliance Pack document set from a scan result. */

export const DISCLOSURE = {
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

const DISCLAIMER =
  'This document is a drafting aid produced by ClearLabel. It is not legal advice and ClearLabel is not a law firm. Review it against your own circumstances and, where your exposure is material, have a qualified adviser in your member state confirm it.';

const host = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const startHere = (ctx) => `# Article 50 Compliance Pack — ${ctx.site}

Generated ${ctx.date} by ClearLabel.

## What was found on your site

${ctx.vendors.length
    ? ctx.vendors.map((v) => `- **${v.name}** — ${v.aiNature}${v.aiProduct ? ` (AI product: ${v.aiProduct})` : ''}`).join('\n')
    : '- No conversational-AI vendor was fingerprinted on the scanned page.'}

Disclosure wording detected in page copy: ${ctx.disclosures.length ? ctx.disclosures.map((d) => d.lang).join(', ') : '**none**'}

## Do these six things

1. Add the disclosure wording (file 01) to each vendor listed above, at the exact console path in file 02.
2. Publish the AI Transparency Notice (file 03) at \`/ai-transparency\` and link it from your footer.
3. Fill the remaining columns of the AI system register (file 04) — it is pre-filled with what we detected.
4. Adopt the synthetic-content labelling policy (file 05) before **2 December 2026**.
5. Sign and date the evidence record (file 06). Under Article 4 the documentation is what an authority asks for.
6. Re-scan after you deploy, and keep the new result with the evidence record.

## The dates that apply

| Date | Obligation | Status |
|---|---|---|
| 2 Aug 2026 | Art. 50(1) AI-interaction disclosure; Art. 50(4) deepfake and public-interest text | **In force** |
| 2 Dec 2026 | Art. 50(2) machine-readable marking of synthetic content | Transition ends |
| 2 Dec 2027 | Most standalone high-risk (Annex III) duties | Deferred by Digital Omnibus |

Penalties for transparency breaches: Art. 99(4), up to €15m or 3% of worldwide annual turnover, whichever is higher. Amounts are set nationally.

---
${DISCLAIMER}
`;

const wording = (ctx) => `# 01 — Disclosure wording

Set this as the **opening message** of every AI assistant on ${ctx.site}. Article 50(1) requires the
information to be clear, distinguishable, and given no later than the first interaction. A line in
your privacy policy does not satisfy it.

${Object.entries(DISCLOSURE).map(([lang, text]) => `## ${lang.toUpperCase()}\n\n> ${text}\n`).join('\n')}

## Rules for using these

- Serve the language the customer is browsing in.
- Do not render the disclosure as an image — Article 50 requires it to meet accessibility requirements.
- Keep the offer of a human route. It is not legally required by Article 50, but it is what turns a
  bare disclosure into something a regulator reads as good faith.
- If you rely on the "obvious from the circumstances" exemption instead, write down your reasoning in
  file 06. That reasoning is the thing you will be asked to produce.

---
${DISCLAIMER}
`;

const steps = (ctx) => `# 02 — Where to paste it, per vendor

${ctx.vendors.length
    ? ctx.vendors
        .map(
          (v) => `## ${v.name}

- **Console path:** ${v.consolePath ?? v.disclosureHook}
- **AI nature:** ${v.aiNature}${v.aiProduct ? `\n- **AI product to check:** ${v.aiProduct}` : ''}
- **Applies?** ${
            v.aiNature === 'ai-native'
              ? 'Yes. This is an LLM agent by design — there is no configuration in which it is not an AI system.'
              : v.aiNature === 'ai-optional'
                ? 'Only if the AI mode is enabled on your workspace. Confirm this, then record the answer in file 06.'
                : 'Likely outside the AI-system definition, but confirm the operator name and greeting do not read as human.'
          }
- **Vendor docs:** ${v.vendorDocs}
${v.note ? `- **Note:** ${v.note}` : ''}
`
        )
        .join('\n')
    : 'No vendor was detected on the scanned page. Re-scan your /contact and /help pages — widgets usually live there rather than on the homepage.'}

---
${DISCLAIMER}
`;

const notice = (ctx) => `# 03 — AI Transparency Notice

Publish at \`https://${ctx.host}/ai-transparency\` and link it from your footer.

---

## How we use AI on this website

_Last updated: ${ctx.date}_

### Talking to an AI

${ctx.vendors.length
    ? `Parts of our customer support on this website are handled by automated AI assistants. When you open our chat, you may be speaking with an AI system rather than a member of our team. We tell you this at the start of every conversation.

We use the following tools for this:

${ctx.vendors.map((v) => `- ${v.name}${v.aiProduct ? ` (${v.aiProduct})` : ''}`).join('\n')}`
    : 'Where any part of our customer contact is handled by an automated AI assistant, we tell you at the start of the conversation.'}

You can ask to be transferred to a person at any point in the conversation.

### AI can get things wrong

Our AI assistants can produce inaccurate answers. Nothing an AI assistant tells you overrides our
published terms, prices or policies. If an answer matters to your decision, ask us to confirm it.

### AI-generated content

Where we publish text, images, audio or video that has been generated or materially altered by AI,
we label it as such and, where technically feasible, mark it in a machine-readable format.

### Your rights

You can contact us at [YOUR CONTACT EMAIL] with any question about how we use AI, including a request
to have a human review anything an AI assistant told you.

### Why we publish this

This notice is given under Article 50 of Regulation (EU) 2024/1689 (the AI Act), which requires
providers and deployers of AI systems to inform people when they are interacting with an AI.

---
${DISCLAIMER}
`;

const register = (ctx) => {
  const header = [
    'system_name', 'vendor', 'purpose', 'role_under_ai_act', 'ai_nature',
    'risk_tier', 'art_50_applies', 'disclosure_implemented', 'disclosure_location',
    'owner', 'date_reviewed', 'notes',
  ].join(',');
  const cell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = ctx.vendors.length
    ? ctx.vendors.map((v) =>
        [
          v.aiProduct ?? v.name, v.name, 'Customer support / website chat', 'Deployer', v.aiNature,
          'Limited risk (transparency)', v.aiNature === 'ai-native' ? 'Yes' : 'CONFIRM',
          'NO - TO DO', v.consolePath ?? v.disclosureHook, '[OWNER NAME]', ctx.date, v.note ?? '',
        ].map(cell).join(',')
      )
    : [['[ADD YOUR AI SYSTEMS]', '', '', 'Deployer', '', '', '', '', '', '', ctx.date, ''].map(cell).join(',')];
  const extras = [
    ['ChatGPT / Copilot (staff use)', 'OpenAI / Microsoft', 'Staff productivity', 'Deployer', 'ai-native',
      'Minimal risk', 'No - not customer facing', 'n/a', 'n/a', '[OWNER NAME]', ctx.date,
      'Art.4 AI literacy still applies to staff use'].map(cell).join(','),
  ];
  return [header, ...rows, ...extras].join('\n') + '\n';
};

const policy = (ctx) => `# 05 — Synthetic content labelling policy

_${ctx.site} — adopted ${ctx.date}_

## Scope

This policy covers any image, audio, video or published text that is generated or materially
altered by an AI system and released under our name.

## Deadline

Article 50(2) requires providers of generative AI systems to mark outputs in a machine-readable
format. Systems already on the market before 2 August 2026 have a transition period ending
**2 December 2026** under the Digital Omnibus. Article 50(4) already requires deployers to disclose
deepfakes, and AI-generated text published to inform the public on matters of public interest.

## Rules

1. **Visible labelling.** Any AI-generated image, audio or video published on our channels carries a
   visible label ("AI-generated" or equivalent in the language of publication).
2. **Machine-readable marking.** Where our tooling supports it, we preserve C2PA Content Credentials
   or IPTC \`digitalSourceType\` metadata. We do not strip provenance metadata during processing.
3. **Text.** AI-drafted text published to inform the public on matters of public interest is either
   labelled, or reviewed and editorially owned by a named person — which is the exemption Article 50(4)
   provides. We record which of the two applies.
4. **Assistive editing.** Routine retouching, colour correction and similar assistive edits that do not
   substantially alter the content are out of scope, consistent with the Article 50(2) carve-out.
5. **Suppliers.** Agencies and freelancers must tell us when deliverables are AI-generated, and must not
   remove provenance metadata. This is added to our supplier terms.

## Ownership

Policy owner: [NAME, ROLE]. Reviewed at least annually and whenever we adopt a new generative tool.

---
${DISCLAIMER}
`;

const evidence = (ctx) => `# 06 — Compliance evidence record

_This is the document an authority asks for. Article 4 makes documentation the primary evidence that
you took the obligation seriously. Complete it, sign it, and keep it with your scan results._

**Organisation:** [LEGAL ENTITY NAME]
**Website in scope:** ${ctx.site}
**Record created:** ${ctx.date}
**Responsible person:** [NAME, ROLE]

## 1. What we assessed

An automated scan of \`${ctx.site}\` on ${ctx.date} fingerprinted the following conversational-AI tooling:

${ctx.vendors.length ? ctx.vendors.map((v) => `- ${v.name} — ${v.aiNature}${v.aiProduct ? ` — ${v.aiProduct}` : ''}`).join('\n') : '- None detected on the scanned page.'}

Disclosure wording present in page copy at time of scan: ${ctx.disclosures.length ? ctx.disclosures.map((d) => d.lang).join(', ') : '**none detected**'}

## 2. Determinations

| Question | Answer | Who decided | Date |
|---|---|---|---|
| Is an AI mode enabled on each tool above? | [YES/NO per tool] | [NAME] | ${ctx.date} |
| Does Art. 50(1) apply to us? | [YES/NO] | [NAME] | ${ctx.date} |
| Are we relying on the "obvious from the circumstances" exemption? | [YES/NO] | [NAME] | ${ctx.date} |
| If yes, on what reasoning? | [WRITE THE REASONING HERE — this is the part that gets tested] | [NAME] | ${ctx.date} |
| Do we publish AI-generated content? | [YES/NO] | [NAME] | ${ctx.date} |

## 3. Actions taken

| Action | Owner | Target date | Completed |
|---|---|---|---|
| Disclosure wording added to each AI assistant | [NAME] | [DATE] | [ ] |
| AI Transparency Notice published at /ai-transparency | [NAME] | [DATE] | [ ] |
| AI system register completed | [NAME] | [DATE] | [ ] |
| Synthetic-content labelling policy adopted | [NAME] | 2026-12-02 | [ ] |
| Staff briefed on AI literacy (Art. 4) | [NAME] | [DATE] | [ ] |
| Re-scan run and filed after deployment | [NAME] | [DATE] | [ ] |

## 4. Review

This record is reviewed whenever we add or reconfigure an AI system, and at least annually.

Signed: ______________________  Date: ______________

---
${DISCLAIMER}
`;

export const buildPack = (scan, now = new Date()) => {
  const ctx = {
    site: scan.url,
    host: host(scan.url),
    date: now.toISOString().slice(0, 10),
    vendors: scan.vendors ?? [],
    disclosures: scan.disclosures ?? [],
  };
  return [
    { name: '00-START-HERE.md', content: startHere(ctx) },
    { name: '01-disclosure-wording.md', content: wording(ctx) },
    { name: '02-where-to-paste-it.md', content: steps(ctx) },
    { name: '03-ai-transparency-notice.md', content: notice(ctx) },
    { name: '04-ai-system-register.csv', content: register(ctx) },
    { name: '05-synthetic-content-policy.md', content: policy(ctx) },
    { name: '06-compliance-evidence-record.md', content: evidence(ctx) },
    { name: 'scan-result.json', content: JSON.stringify(scan, null, 2) },
  ];
};
