// pay-rules.test.mjs
// node --test suite for pay-rules.mjs. May use node: imports.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectSalaryRange,
  detectPayHistoryAsk,
  checkGenderNeutralTitle,
  assessAd,
  MESSAGES,
} from "./pay-rules.mjs";

// --- detectSalaryRange -----------------------------------------------------

test("range found: EN ad with €45,000-55,000", () => {
  const r = detectSalaryRange("We are hiring a senior engineer. Salary range €45,000-55,000 per year.");
  assert.equal(r.found, true);
  assert.ok(r.matches.some((m) => m.includes("€45,000-55,000")), "range match missing");
});

test("range absent: plain ad with no pay signal", () => {
  const r = detectSalaryRange("We are looking for a product designer to join our Berlin office.");
  assert.equal(r.found, false);
  assert.deepEqual(r.matches, []);
});

test("k€ form is detected", () => {
  const r = detectSalaryRange("Salary range 45k€ to 55k€ depending on experience.");
  assert.equal(r.found, true);
});

test("DE Gehaltsspanne is detected", () => {
  const r = detectSalaryRange("Gehaltsspanne 45.000–55.000 € brutto pro Jahr.");
  assert.equal(r.found, true);
});

test("range-in-ad is recommended, not mandatory", () => {
  const res = assessAd("We are hiring. Apply today.");
  const range = res.find((r) => r.check === "Salary range");
  assert.equal(range.status, "advice");
  assert.match(range.message, /does not have to be in the ad itself/);
});

// --- detectPayHistoryAsk: expectations are NOT history ----------------------

test("plain salary expectations is not flagged", () => {
  const r = detectPayHistoryAsk("What are your salary expectations for this role?");
  assert.equal(r.found, false);
});

test("plain Gehaltsvorstellung is not flagged", () => {
  const r = detectPayHistoryAsk("Bitte nennen Sie uns Ihre Gehaltsvorstellung.");
  assert.equal(r.found, false);
});

test("expectation tied to current salary is flagged", () => {
  const r = detectPayHistoryAsk("Please share your salary expectations based on your current salary.");
  assert.equal(r.found, true);
  assert.ok(r.matches.some((m) => m === "current salary"), "current-salary cue missing");
});

// --- detectPayHistoryAsk: each language cue --------------------------------

test("EN current salary is flagged", () => {
  assert.equal(detectPayHistoryAsk("Please state your current salary.").found, true);
});

test("EN salary history is flagged", () => {
  assert.equal(detectPayHistoryAsk("Send us your salary history.").found, true);
});

test("EN most recent salary is flagged", () => {
  assert.equal(detectPayHistoryAsk("What was your most recent salary?").found, true);
});

test("DE aktuelles Gehalt is flagged", () => {
  assert.equal(detectPayHistoryAsk("Bitte geben Sie Ihr aktuelles Gehalt an.").found, true);
});

test("DE bisheriges Gehalt is flagged", () => {
  assert.equal(detectPayHistoryAsk("Nennen Sie Ihr bisheriges Gehalt.").found, true);
});

test("DE Gehaltsnachweis is flagged", () => {
  assert.equal(detectPayHistoryAsk("Bitte reichen Sie einen Gehaltsnachweis ein.").found, true);
});

test("FR salaire actuel is flagged", () => {
  assert.equal(detectPayHistoryAsk("Indiquez votre salaire actuel.").found, true);
});

test("FR historique de salaire is flagged", () => {
  assert.equal(detectPayHistoryAsk("Merci de fournir votre historique de salaire.").found, true);
});

test("ES salario actual is flagged", () => {
  assert.equal(detectPayHistoryAsk("Indique su salario actual.").found, true);
});

test("ES historial salarial is flagged", () => {
  assert.equal(detectPayHistoryAsk("Adjunte su historial salarial.").found, true);
});

test("IT stipendio attuale is flagged", () => {
  assert.equal(detectPayHistoryAsk("Indichi il suo stipendio attuale.").found, true);
});

test("IT storia retributiva is flagged", () => {
  assert.equal(detectPayHistoryAsk("Fornisca la sua storia retributiva.").found, true);
});

// --- checkGenderNeutralTitle -------------------------------------------------

test("gendered DE title without marker is flagged", () => {
  const r = checkGenderNeutralTitle("Verkäufer gesucht für unser Team in München.");
  assert.equal(r.finding, "flag");
});

test("DE title with (m/w/d) is ok", () => {
  const r = checkGenderNeutralTitle("Verkäufer (m/w/d) gesucht für unser Team.");
  assert.equal(r.finding, "ok");
});

test("English salesman is flagged", () => {
  const r = checkGenderNeutralTitle("We are hiring a salesman for our retail store.");
  assert.equal(r.finding, "flag");
});

test("neutral title is ok", () => {
  const r = checkGenderNeutralTitle("Software engineer");
  assert.equal(r.finding, "ok");
});

// --- graceful degradation ---------------------------------------------------

test("empty input degrades gracefully", () => {
  assert.deepEqual(detectSalaryRange(""), { found: false, matches: [] });
  assert.deepEqual(detectPayHistoryAsk(""), { found: false, matches: [] });
  assert.equal(checkGenderNeutralTitle("").finding, "unknown");
  assert.equal(checkGenderNeutralTitle("   ").finding, "unknown");
  const res = assessAd("");
  assert.equal(res.length, 3);
  assert.ok(res.every((r) => ["ok", "advice", "flag"].includes(r.status)));
});

test("non-job-ad text degrades gracefully (no throw, ok/unknown statuses)", () => {
  const t = "Our cafe serves espresso and homemade cake. Open every day.";
  assert.doesNotThrow(() => assessAd(t));
  assert.equal(detectSalaryRange(t).found, false);
  assert.equal(detectPayHistoryAsk(t).found, false);
  assert.ok(["ok", "unknown"].includes(checkGenderNeutralTitle(t).finding));
});

// --- assessAd contract ------------------------------------------------------

test("assessAd returns three results with messages from MESSAGES only", () => {
  const res = assessAd("Verkäufer gesucht. Bitte geben Sie Ihr aktuelles Gehalt an. Gehalt €40,000.");
  assert.equal(res.length, 3);
  const known = new Set([
    MESSAGES.salaryRange.ok,
    MESSAGES.salaryRange.advice,
    MESSAGES.payHistory.ok,
    MESSAGES.payHistory.flag,
    MESSAGES.genderNeutralTitle.ok,
    MESSAGES.genderNeutralTitle.flag,
    MESSAGES.genderNeutralTitle.unknown,
  ]);
  for (const r of res) {
    assert.ok(["ok", "advice", "flag"].includes(r.status), `bad status ${r.status}`);
    assert.ok(known.has(r.message), `message not from MESSAGES: ${r.message}`);
  }
});

test("assessAd flags pay-history and title, advises on range", () => {
  const res = assessAd("Verkäufer gesucht. Bitte geben Sie Ihr aktuelles Gehalt an.");
  const byCheck = Object.fromEntries(res.map((r) => [r.check, r.status]));
  assert.equal(byCheck["Pay history"], "flag");
  assert.equal(byCheck["Gender-neutral title"], "flag");
  assert.equal(byCheck["Salary range"], "advice");
});
