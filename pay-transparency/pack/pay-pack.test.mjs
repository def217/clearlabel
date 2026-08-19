// pay-pack.test.mjs
// node --test suite for pay-pack.mjs. May use node: imports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayPack } from "./pay-pack.mjs";

const data = {
  disclaimer: "This document is a drafting aid produced by ClearLabel. It is not legal advice.",
  rangeClause: {
    heading: "Compliant salary-range clause",
    en: "The initial pay for this position is {{CURRENCY}} {{RANGE}}, set on objective, gender-neutral criteria.",
    de: "Das Einstiegsgehalt fur diese Stelle betragt {{CURRENCY}} {{RANGE}}.",
    fr: "La remuneration initiale pour ce poste est de {{CURRENCY}} {{RANGE}}.",
  },
  genderNeutralStatement: {
    heading: "Gender-neutral pay-criteria statement",
    body: "{{ORG}} sets the initial pay and any range for this role using objective, gender-neutral criteria.",
  },
  interviewerOnePager: {
    heading: "Interviewer one-pager",
    mayNotAskHeading: "What you may not ask (Art 5(2))",
    mayNotAsk: "Do not ask applicants about their pay history.",
    mustReachHeading: "What must reach the applicant before the interview (Art 5(1))",
    mustReach: "The applicant has the right to receive information about the initial pay or its range.",
  },
  contractChecklist: {
    heading: "Contract checklist: remove pay-secrecy clauses",
    paySecrecy: "Workers shall not be prevented from disclosing their pay.",
  },
};

const NOW = new Date("2026-08-19T12:00:00.000Z");

const SAMPLE_BANNER = "> SAMPLE. Built from a demo scan, not from your site. Buy the pack to generate these documents from your own scan.";

test("builder returns four files in order", () => {
  const pack = buildPayPack(data, { now: NOW });
  assert.deepEqual(
    pack.map((f) => f.name),
    [
      "01-salary-range-clause.md",
      "02-gender-neutral-pay-criteria.md",
      "03-interviewer-one-pager.md",
      "04-contract-checklist.md",
    ],
  );
  assert.ok(pack.every((f) => typeof f.content === "string" && f.content.length > 0));
});

test("sample:true stamps every emitted .md file with the banner", () => {
  const pack = buildPayPack(data, { now: NOW, currency: "EUR", range: "45,000 - 55,000", sample: true });
  assert.equal(pack.length, 4);
  for (const f of pack) {
    assert.ok(f.name.endsWith(".md"), `unexpected non-md file ${f.name}`);
    assert.ok(f.content.includes(SAMPLE_BANNER), `${f.name} missing sample banner`);
  }
});

test("sample option absent leaves the pack without any banner (licensed path unaffected)", () => {
  const pack = buildPayPack(data, { now: NOW, currency: "EUR", range: "45,000 - 55,000" });
  for (const f of pack) {
    assert.ok(!f.content.includes("SAMPLE. Built from a demo scan"));
  }
});

test("sample:false is byte-identical to opts without a sample key", () => {
  const opts = { now: NOW, orgName: "Acme GmbH", currency: "EUR", range: "45,000 - 55,000" };
  assert.deepEqual(buildPayPack(data, { ...opts, sample: false }), buildPayPack(data, opts));
});

test("sample banner does not disturb the Prepared-for line placement", () => {
  const pack = buildPayPack(data, { now: NOW, orgName: "Acme GmbH", sample: true });
  const genderNeutral = pack.find((f) => f.name === "02-gender-neutral-pay-criteria.md");
  assert.ok(genderNeutral.content.includes("Prepared for Acme GmbH"));
  assert.ok(genderNeutral.content.includes(SAMPLE_BANNER));
});
