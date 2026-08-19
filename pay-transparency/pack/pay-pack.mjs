/** Builds the Pay Transparency Job-Ad Kit document set from pay-pack-data.json. */
//
// Pure functions, no I/O. Every legal fact and every document sentence comes
// ONLY from pay-pack-data.json, which is sourced from
// ops/paytransparency-legal-table.md (Directive (EU) 2023/970); nothing is
// added from model memory.
//
// Conservative choices:
// - Placeholders are filled with the buyer's currency and range, or kept as
//   bracketed prompts when empty, so the template never asserts a value the
//   buyer did not choose.
// - The four documents carry the exact Art 5(1)/5(2)/7(5) wording held in the
//   legal table; no additional legal claim is introduced.

const cleanOrgName = (raw) =>
  String(raw ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 120);

const SAMPLE_BANNER = "> SAMPLE. Built from a demo scan, not from your site. Buy the pack to generate these documents from your own scan.";

// Inserts the sample banner as its own line directly under the doc's H1, with
// a blank line on both sides so it never lazily absorbs the line that follows
// (a markdown blockquote otherwise swallows an immediately-following line).
const withSampleBanner = (content) => {
  const i = content.indexOf("\n");
  const h1 = i === -1 ? content : content.slice(0, i);
  const rest = i === -1 ? "" : content.slice(i + 1).replace(/^\n+/, "");
  return `${h1}\n\n${SAMPLE_BANNER}\n\n${rest}`;
};

// Sample zips must not pass as real compliance evidence. Stamp every .md file;
// this pack has no CSV/JSON artifacts to exempt, but the check is kept for
// parity with the other two generators.
const stampSample = (f) => (f.name.endsWith(".md") ? { ...f, content: withSampleBanner(f.content) } : f);

export const buildPayPack = (data, opts = {}) => {
  const org = cleanOrgName(opts.orgName);
  const currency = String(opts.currency ?? "").trim() || "[CURRENCY]";
  const range = String(opts.range ?? "").trim() || "[RANGE]";
  const date = (opts.now ?? new Date()).toISOString().slice(0, 10);

  const fill = (s) =>
    String(s ?? "")
      .replace(/\{\{CURRENCY\}\}/g, currency)
      .replace(/\{\{RANGE\}\}/g, range)
      .replace(/\{\{ORG\}\}/g, org || "[ORGANISATION]")
      .replace(/\{\{DATE\}\}/g, date);

  const preparedFor = org ? `Prepared for ${org}\n\n` : "";
  const disclaimer = data.disclaimer ?? "";

  const rangeClause = [
    `# 01 · ${data.rangeClause.heading}`,
    "",
    `${preparedFor}## English`,
    "",
    fill(data.rangeClause.en),
    "",
    "## Deutsch",
    "",
    fill(data.rangeClause.de),
    "",
    "## Français",
    "",
    fill(data.rangeClause.fr),
    "",
    "---",
    disclaimer,
    "",
  ].join("\n");

  const genderNeutral = [
    `# 02 · ${data.genderNeutralStatement.heading}`,
    "",
    `${preparedFor}${fill(data.genderNeutralStatement.body)}`,
    "",
    "---",
    disclaimer,
    "",
  ].join("\n");

  const interviewer = [
    `# 03 · ${data.interviewerOnePager.heading}`,
    "",
    `${preparedFor}## ${data.interviewerOnePager.mayNotAskHeading}`,
    "",
    fill(data.interviewerOnePager.mayNotAsk),
    "",
    `## ${data.interviewerOnePager.mustReachHeading}`,
    "",
    fill(data.interviewerOnePager.mustReach),
    "",
    "---",
    disclaimer,
    "",
  ].join("\n");

  const contract = [
    `# 04 · ${data.contractChecklist.heading}`,
    "",
    `${preparedFor}${fill(data.contractChecklist.paySecrecy)}`,
    "",
    "---",
    disclaimer,
    "",
  ].join("\n");

  const docs = [
    { name: "01-salary-range-clause.md", content: rangeClause },
    { name: "02-gender-neutral-pay-criteria.md", content: genderNeutral },
    { name: "03-interviewer-one-pager.md", content: interviewer },
    { name: "04-contract-checklist.md", content: contract },
  ];
  return opts.sample ? docs.map(stampSample) : docs;
};
