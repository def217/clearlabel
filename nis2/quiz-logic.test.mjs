// quiz-logic.test.mjs
// node --test suite for quiz-logic.mjs. May use node: imports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { evaluate } from "./quiz-logic.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(await readFile(join(here, "nis2-data.json"), "utf8"));

const ANNEX_I = "energy";
const ANNEX_II = "postal-and-courier-services";

const CAVEATS = [
  "EU-level test only — national transposition can extend it",
  "not legal advice",
];

const ans = (overrides = {}) => ({
  sectorId: null,
  subsectorId: null,
  sizeBand: "micro-small",
  captures: [],
  ...overrides,
});

const assertCaveats = (verdict) => {
  assert.ok(verdict.reasons.length > 0, "reasons must be non-empty");
  for (const caveat of CAVEATS) {
    assert.ok(verdict.reasons.includes(caveat), `missing caveat: ${caveat}`);
  }
};

test("no sector, no captures → likely-out", () => {
  const v = evaluate(ans(), data);
  assert.equal(v.status, "likely-out");
  assertCaveats(v);
});

test("Annex I large → essential", () => {
  const v = evaluate(ans({ sectorId: ANNEX_I, sizeBand: "large" }), data);
  assert.equal(v.status, "essential");
  assert.ok(v.obligations.length > 0, "essential verdict must list obligations");
  assertCaveats(v);
});

test("Annex I medium → important", () => {
  const v = evaluate(ans({ sectorId: ANNEX_I, sizeBand: "medium" }), data);
  assert.equal(v.status, "important");
  assertCaveats(v);
});

test("Annex I medium + dns capture → essential", () => {
  const v = evaluate(ans({ sectorId: ANNEX_I, sizeBand: "medium", captures: ["dns"] }), data);
  assert.equal(v.status, "essential");
  assertCaveats(v);
});

test("Annex II large → important", () => {
  const v = evaluate(ans({ sectorId: ANNEX_II, sizeBand: "large" }), data);
  assert.equal(v.status, "important");
  assertCaveats(v);
});

test("micro-small, no captures → likely-out", () => {
  const v = evaluate(ans({ sectorId: ANNEX_I, sizeBand: "micro-small" }), data);
  assert.equal(v.status, "likely-out");
  assertCaveats(v);
});

test("micro-small + trust capture → essential", () => {
  const v = evaluate(ans({ sectorId: ANNEX_I, sizeBand: "micro-small", captures: ["trust"] }), data);
  assert.equal(v.status, "essential");
  assertCaveats(v);
});

test("domainreg + small → in scope (important floor)", () => {
  const v = evaluate(ans({ sectorId: ANNEX_I, sizeBand: "micro-small", captures: ["domainreg"] }), data);
  assert.equal(v.status, "important");
  assertCaveats(v);
});

test("ecomms + medium → essential", () => {
  const v = evaluate(ans({ sectorId: ANNEX_I, sizeBand: "medium", captures: ["ecomms"] }), data);
  assert.equal(v.status, "essential");
  assertCaveats(v);
});
