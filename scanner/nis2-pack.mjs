/** Builds the NIS2 Starter Pack document set from a scope-quiz verdict. */
//
// Pure functions, no I/O. Every legal fact comes ONLY from ops/nis2-legal-table.md
// (Directive (EU) 2022/2555); nothing is added from model memory.
//
// Conservative choices:
// - The fines amounts are reproduced with the table's own "…" ellipsis verbatim
//   (the table abbreviates the important-tier turnover clause), never reconstructed.
// - The Art. 23 report-content items (early-warning indicators, notification
//   contents, final-report i-iv) are rendered as bracketed fill-in prompts, not
//   asserted as verbatim directive text, because the legal table carries only the
//   Art. 23 deadlines and significance test.
// - An "edge" verdict has no single fines tier; the evidence record shows both
//   tiers and says the classification must be verified first.

const DISCLAIMER =
  'This document is a drafting aid produced by ClearLabel. It is not legal advice and ClearLabel is not a law firm. Review it against your own circumstances and, where your exposure is material, have a qualified adviser in your member state confirm it.';

const SAMPLE_BANNER = '> SAMPLE. Built from a demo scan, not from your site. Buy the pack to generate these documents from your own scan.';

// Inserts the sample banner as its own line directly under the doc's H1, with
// a blank line on both sides so it never lazily absorbs the line that follows
// (a markdown blockquote otherwise swallows an immediately-following line).
const withSampleBanner = (content) => {
  const i = content.indexOf('\n');
  const h1 = i === -1 ? content : content.slice(0, i);
  const rest = i === -1 ? '' : content.slice(i + 1).replace(/^\n+/, '');
  return `${h1}\n\n${SAMPLE_BANNER}\n\n${rest}`;
};

// Sample zips must not pass as real compliance evidence. Stamp every .md file;
// the CSV and JSON artifacts are exempt.
const stampSample = (f) => (f.name.endsWith('.md') ? { ...f, content: withSampleBanner(f.content) } : f);

const SIZE_BAND_LABELS = Object.freeze({
  'micro-small': 'Micro or small (below the medium-enterprise floor)',
  medium: 'Medium-sized',
  large: 'Large (exceeds the medium-enterprise ceilings)',
});

const STATUS_LABELS = Object.freeze({
  essential: 'Essential entity',
  important: 'Important entity',
  edge: 'Edge — classification to verify',
});

// Article 34(4)-(5) amounts, verbatim from the table's fines section. The table
// itself uses "EUR", the "…" ellipsis, and "1,4 %" with a comma decimal.
const FINES = Object.freeze({
  essential:
    'a maximum of at least EUR 10 000 000 or of a maximum of at least 2 % of the total worldwide annual turnover in the preceding financial year of the undertaking … whichever is higher.',
  important:
    'a maximum of at least EUR 7 000 000 or of a maximum of at least 1,4 % of the total worldwide annual turnover … whichever is higher.',
});

const FINES_NOTE = 'These are floor maxima — Member States may go higher (Art. 34(4)-(5)).';

// The ten Article 21(2) measures, verbatim from the table, with a plain-language
// "what this means for a small team" line per measure.
const MEASURES = Object.freeze([
  {
    id: '(a)',
    text: 'policies on risk analysis and information system security',
    plain: 'Write down what could go wrong with your systems and data, and the rules you follow to keep them secure.',
  },
  {
    id: '(b)',
    text: 'incident handling',
    plain: 'Have a plan for when something goes wrong: who to call, what to say, and what to record.',
  },
  {
    id: '(c)',
    text: 'business continuity, such as backup management and disaster recovery, and crisis management',
    plain: 'Keep backups you can actually restore, and know how the business keeps running (and who decides) during a crisis.',
  },
  {
    id: '(d)',
    text: 'supply chain security, including security-related aspects concerning relationships between each entity and its direct suppliers or service providers',
    plain: 'Check the security of the suppliers and cloud services you depend on, and put security terms in those contracts.',
  },
  {
    id: '(e)',
    text: 'security in network and information systems acquisition, development and maintenance, including vulnerability handling and disclosure',
    plain: 'Build security into buying, building and maintaining systems, and have a way to receive and fix vulnerability reports.',
  },
  {
    id: '(f)',
    text: 'policies and procedures to assess the effectiveness of cybersecurity risk-management measures',
    plain: 'Regularly test whether your security measures actually work, and write down the result.',
  },
  {
    id: '(g)',
    text: 'basic cyber hygiene practices and cybersecurity training',
    plain: 'Basic security habits for everyone (passwords, updates, spotting phishing), plus regular training.',
  },
  {
    id: '(h)',
    text: 'policies and procedures regarding the use of cryptography and, where appropriate, encryption',
    plain: 'Use encryption where it matters, and write down where and when you use it.',
  },
  {
    id: '(i)',
    text: 'human resources security, access control policies and asset management',
    plain: 'Control who can access what, manage joiners and leavers, and keep track of devices and data.',
  },
  {
    id: '(j)',
    text: 'multi-factor authentication or continuous authentication solutions, secured voice/video/text communications and secured emergency communication systems, where appropriate',
    plain: 'Turn on multi-factor authentication, and have a secure way to reach your team in an emergency.',
  },
]);

const cleanOrgName = (raw) =>
  String(raw ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);

const sizeLabel = (band) => SIZE_BAND_LABELS[band] ?? String(band ?? '');

const statusLabel = (status) => STATUS_LABELS[status] ?? String(status ?? '');

// "Prepared for <orgName>" line when present; an empty string when absent, so the
// two-argument form leaves no stray line.
const preparedFor = (ctx) => (ctx.orgName ? `Prepared for ${ctx.orgName}\n\n` : '');

const startHere = (ctx) => `# NIS2 Starter Pack — Start here

${preparedFor(ctx)}Generated ${ctx.date} by ClearLabel.

## What was assessed

- **Sector:** ${ctx.sectorName}
${ctx.subsectorName ? `- **Subsector:** ${ctx.subsectorName}\n` : ''}- **Size band:** ${ctx.sizeBand}
- **Size-independent captures:** ${ctx.captures.length ? ctx.captures.join(', ') : 'none'}
- **Verdict:** ${ctx.verdictLabel}

### Why this verdict

${ctx.reasons.map((r) => `- ${r}`).join('\n')}

## What now applies

${ctx.obligations.length ? ctx.obligations.map((o) => `- ${o}`).join('\n') : ctx.status === 'edge'
    ? '- Classification is unresolved (edge). Verify the final tier first; the obligations then follow from that tier.'
    : `- The Article 21 risk-management measures, the Article 23 reporting chain, Article 3(4) registration and Article 20 management duties — files 01-04 walk through each. (Status: ${ctx.status} entity.)`}

## The five steps to use this pack

1. Work through the risk-management checklist (file 01) and fill the Status and Evidence columns for all ten Art. 21(2) measures.
2. Complete the incident-reporting runbook (file 02) — assign who reports, to whom, and who deputises.
3. Fill and submit the registration information (file 03).
4. Have management adopt the accountability one-pager (file 04) and put management members through cybersecurity training.
5. Sign and date the evidence record (file 05), then re-assess at least annually or whenever your circumstances materially change.

---
${DISCLAIMER}
`;

const checklist = (ctx) => `# 01 — Risk-management checklist (Article 21)

${preparedFor(ctx)}Article 21(2) requires an all-hazards approach and, at least, the ten measures below. Work through them and fill the Status and Evidence columns.

## Proportionality (Article 21(1))

Entities take "appropriate and proportionate technical, operational and organisational measures". What is proportionate weighs the state of the art, relevant standards, cost, the entity's exposure to risks, the entity's size, and the likelihood and severity of incidents.

## The ten measures

| Measure (Art. 21(2)) | What this means for a small team | Status | Evidence |
|---|---|---|---|
${MEASURES.map((m) => `| ${m.id} ${m.text} | ${m.plain} | [ ] | |`).join('\n')}

## If you find a gap (Article 21(4))

An entity that finds itself non-compliant takes, "without undue delay, all necessary, appropriate and proportionate corrective measures". Record the gap in the Status column and the corrective action in the Evidence column.

---
${DISCLAIMER}
`;

const runbook = (ctx) => `# 02 — Incident-reporting runbook (Article 23(4))

${preparedFor(ctx)}Reports go to **the CSIRT or, where applicable, the competent authority**.

## Step 0 — Is it significant? (Article 23(3))

An incident is significant if "(a) it has caused or is capable of causing severe operational disruption of the services or financial loss for the entity concerned; (b) it has affected or is capable of affecting other natural or legal persons by causing considerable material or non-material damage."

If neither limb applies, it is not a significant incident under Article 23(3) and the deadlines below do not start to run.

## Step 1 — Early warning (within 24 hours)

Report "without undue delay and in any event within 24 hours of becoming aware of the significant incident".

Capture in the early warning (fill in):

- [initial description of the incident]
- [whether unlawful or malicious acts are suspected]
- [whether a cross-border impact is possible]

## Step 2 — Incident notification (within 72 hours)

Report "without undue delay and in any event within 72 hours of becoming aware of the significant incident".

Capture in the notification (fill in):

- [initial assessment of the incident]
- [its severity and impact]
- [indicators of compromise, where available]

## Step 3 — Intermediate report (on request)

Provide an intermediate update whenever the CSIRT or competent authority asks.

## Step 4 — Final report (one month after the notification)

Report "not later than one month after the submission of the incident notification under point (b)".

The clock runs from the **notification**, not the incident. If the incident is still ongoing at that point, provide a progress report then, and the final report within one month of handling the incident.

Capture in the final report (fill in):

- (i) [detailed description of the incident, its severity and impact]
- (ii) [type of threat or likely root cause]
- (iii) [mitigation measures applied and ongoing]
- (iv) [cross-border impact, if applicable]

## Trust service providers

Trust service providers notify within **24 hours** (Article 23(4) derogation).

## Who reports

| Role | Name | Contact |
|---|---|---|
| National CSIRT (or competent authority) | | |
| Internal reporter | | |
| Deputy reporter | | |

---
${DISCLAIMER}
`;

const registration = (ctx) => `# 03 — Registration information (Article 3(4))

${preparedFor(ctx)}Entities must submit to the competent authorities the details below. Fill them in and keep a dated copy of what you submit.

| Field | Value |
|---|---|
| Name | |
| Address | |
| Contact email | |
| Contact phone | |
| IP ranges | |
| Sector (per Annex) | ${ctx.sectorName} |
| Subsector (per Annex) | ${ctx.subsectorName} |
| Member States where you provide in-scope services (where applicable) | |

---
${DISCLAIMER}
`;

const accountability = (ctx) => `# 04 — Management accountability (Article 20)

${preparedFor(ctx)}## What management must do

- **Approve** the risk-management measures.
- **Oversee** their implementation.
- **Answer for them:** management bodies "can be held liable for infringements" of Article 21.

## Training

Members of management bodies are required to follow cybersecurity training. Entities are encouraged to offer similar training to all employees regularly.

## Template — board resolution

> **TEMPLATE — adapt, then adopt at a management-body meeting and minute the decision.**
>
> Resolved that [ENTITY NAME] adopts the risk-management measures set out in the NIS2 risk-management checklist (file 01) as its Article 21 measures, that management oversees their implementation, and that members of the management body complete cybersecurity training. Management will review these measures at least annually and whenever circumstances materially change.

---
${DISCLAIMER}
`;

const finesExposure = (ctx) => {
  if (ctx.status === 'essential') {
    return `As an **essential** entity, infringements of Articles 21/23 can attract fines of "${FINES.essential}" ${FINES_NOTE}`;
  }
  if (ctx.status === 'important') {
    return `As an **important** entity, infringements of Articles 21/23 can attract fines of "${FINES.important}" ${FINES_NOTE}`;
  }
  return [
    'Classification is unresolved (**edge**) — the fines tier depends on the final classification, so verify that first.',
    `- Essential: "${FINES.essential}"`,
    `- Important: "${FINES.important}"`,
    FINES_NOTE,
  ].join('\n');
};

const evidence = (ctx) => `# 05 — Compliance evidence record

${preparedFor(ctx)}_Complete, sign and keep this with your quiz answers and pack._

**Organisation:** [LEGAL ENTITY NAME]
**Record created:** ${ctx.date}
**Responsible person:** [NAME, ROLE]

## 1. What we assessed

- **Sector:** ${ctx.sectorName}
${ctx.subsectorName ? `- **Subsector:** ${ctx.subsectorName}\n` : ''}- **Size band:** ${ctx.sizeBand}
- **Size-independent captures:** ${ctx.captures.length ? ctx.captures.join(', ') : 'none'}
- **Verdict:** ${ctx.verdictLabel}

### Verdict reasons

${ctx.reasons.map((r) => `- ${r}`).join('\n')}

## 2. Fines exposure

${finesExposure(ctx)}

## 3. Signature

Signed: ______________________  Date: ______________

## 4. Re-assessment

Re-assess at least annually, and again whenever your sector, size, captures or services materially change, and file a new record.

---
${DISCLAIMER}
`;

export const buildNis2Pack = (answers, verdict, now = new Date(), options = {}) => {
  const ctx = {
    sectorName: answers?.sectorName ?? '',
    subsectorName: answers?.subsectorName ?? '',
    sizeBand: sizeLabel(answers?.sizeBand),
    captures: answers?.captures ?? [],
    orgName: cleanOrgName(answers?.orgName),
    status: verdict?.status ?? '',
    verdictLabel: statusLabel(verdict?.status),
    reasons: verdict?.reasons ?? [],
    obligations: verdict?.obligations ?? [],
    date: now.toISOString().slice(0, 10),
  };
  const docs = [
    { name: '00-START-HERE.md', content: startHere(ctx) },
    { name: '01-risk-management-checklist.md', content: checklist(ctx) },
    { name: '02-incident-reporting-runbook.md', content: runbook(ctx) },
    { name: '03-registration-info-sheet.md', content: registration(ctx) },
    { name: '04-management-accountability.md', content: accountability(ctx) },
    { name: '05-evidence-record.md', content: evidence(ctx) },
  ];
  return options.sample ? docs.map(stampSample) : docs;
};
