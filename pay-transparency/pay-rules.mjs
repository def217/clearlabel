// pay-rules.mjs
//
// Pure, dependency-free decision logic for the pay-transparency job-ad scanner.
// Browser-compatible (no node: imports, no I/O). Every legal fact and every
// customer-facing message traces ONLY to ops/paytransparency-legal-table.md
// (Directive (EU) 2023/970, CELEX:32023L0970); nothing is added from model
// memory.
//
// Conservative choices:
// - A salary range is "found" only when an explicit numeric range appears or a
//   salary keyword co-occurs with a currency amount. A lone "€5" in non-job
//   text is not treated as a salary signal.
// - Pay-history detection flags current/previous pay requests. A plain
//   "salary expectations" / "Gehaltsvorstellung" phrase is NOT flagged unless
//   the same sentence also references current or previous pay (legal-table rule).
// - Gender-title detection is conservative: it flags only a small fixed list of
//   gendered noun forms, and returns "unknown" (no finding) when there is no
//   title text to assess. When unsure, it reports no finding.

// Single source for every assessAd() message string.
export const MESSAGES = Object.freeze({
  salaryRange: Object.freeze({
    ok: "A pay or range signal was found. Publishing the initial pay or its range in the ad is the simplest compliant route.",
    advice: "No salary range detected. The range does not have to be in the ad itself, but it must reach applicants before the interview. Publishing it in the ad is the simplest compliant route.",
  }),
  payHistory: Object.freeze({
    ok: "No pay-history question detected.",
    flag: "This ad appears to ask about current or previous pay. Employers may not ask applicants about their pay during their current or previous employment (Art 5(2)).",
  }),
  genderNeutralTitle: Object.freeze({
    ok: "No gendered job title detected.",
    flag: "A gendered job title was detected. Job vacancy notices and job titles must be gender-neutral (Art 5(3)).",
    unknown: "Job title neutrality was not assessed. No gendered title was detected in the text provided.",
  }),
});

// Normalise accents away and lower-case, so cues match both accented and
// unaccented spellings (rémunération vs remuneration, retribución vs retribucion).
const normalize = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wordRe = (word) => new RegExp(`\\b${escapeRe(normalize(word))}\\b`, "i");

const hasWord = (text, word) => wordRe(word).test(normalize(text));

const includesNorm = (text, phrase) => normalize(text).includes(normalize(phrase));

// --- salary / range signals -------------------------------------------------

// Single-word salary keywords across EN/DE/FR/ES/IT (normalised ASCII forms).
const SALARY_WORDS = [
  "salary", "salaries", "compensation", "remuneration", "wage", "wages",
  "gehalt", "gehaltsspanne", "gehaltsband", "vergutung", "entgelt",
  "salaire", "salario", "retribucion", "stipendio", "retribuzione",
];

// Multi-word salary keywords ("pay range" etc.) checked as phrases.
const SALARY_PHRASES = [
  "pay range", "pay ranges", "salary range", "salary ranges",
  "salary band", "compensation range", "salary scale",
];

// A numeric token: 45, 45.000, 45,000, 1.234.567, 45.5, 45k.
const NUM = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;
// An amount: optional currency on either side, optional k (thousands) suffix.
const AMOUNT = String.raw`(?:(?:€|EUR|eur|Eur)\s*)?(?:${NUM})(?:\s*[kK])?(?:\s*(?:€|EUR|eur|Eur))?`;
const RANGE_SEP = String.raw`\s*(?:-|–|to|bis|à|a|hasta)\s*`;
const RANGE_RE = new RegExp(`(${AMOUNT})${RANGE_SEP}(${AMOUNT})`, "g");
const AMOUNT_RE = new RegExp(AMOUNT, "g");

const collect = (text, re) => {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    out.push(m[0]);
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
};

const hasCurrencyMarker = (s) => /€|EUR|\d\s*[kK]/i.test(s);

export function detectSalaryRange(text) {
  const t = String(text ?? "");
  if (!t.trim()) return { found: false, matches: [] };

  const ranges = collect(t, RANGE_RE).filter(hasCurrencyMarker);
  const salaryWords = SALARY_WORDS.filter((w) => hasWord(t, w));
  const salaryPhrases = SALARY_PHRASES.filter((p) => includesNorm(t, p));
  const hasSalarySignal = salaryWords.length > 0 || salaryPhrases.length > 0;
  const amounts = hasSalarySignal ? collect(t, AMOUNT_RE).filter(hasCurrencyMarker) : [];

  const found = ranges.length > 0 || (hasSalarySignal && amounts.length > 0);
  const matches = [...new Set([...ranges, ...salaryWords, ...salaryPhrases, ...amounts])];
  return { found, matches };
}

// --- pay-history questions --------------------------------------------------

// Requests for current or previous pay. Cue phrases are matched after accent
// normalisation, so they are listed here in their normalised (ASCII) form.
const HISTORY_CUES = [
  // EN
  "current salary", "current salaries", "current pay", "current compensation",
  "current remuneration", "current wage",
  "salary history", "pay history", "wage history", "compensation history",
  "most recent salary", "most recent pay", "most recent compensation",
  "previous salary", "previous pay", "prior salary", "prior pay",
  "past salary", "past pay", "last salary", "last pay", "recent salary",
  // DE
  "aktuelles gehalt", "aktuellen gehalt", "aktueller gehalt",
  "bisheriges gehalt", "bisherigen gehalt", "gehaltsnachweis", "gehaltsnachweise",
  "letztes gehalt", "fruheres gehalt", "vorheriges gehalt",
  "aktueller verdienst", "bisheriger verdienst",
  // FR
  "salaire actuel", "historique de salaire", "historique salarial",
  "salaire precedent", "dernier salaire", "ancien salaire",
  "remuneration actuelle", "remuneration precedente",
  // ES
  "salario actual", "salario anterior", "ultimo salario",
  "historial salarial", "historial de salario",
  "retribucion actual", "retribucion anterior",
  // IT
  "stipendio attuale", "ultimo stipendio", "stipendio precedente",
  "storia retributiva", "storico retributivo",
  "retribuzione attuale", "retribuzione precedente",
];

// Expectation phrases: NOT flagged on their own.
const EXPECTATION_PHRASES = [
  "salary expectations", "salary expectation", "expected salary",
  "pay expectations", "compensation expectations",
  "gehaltsvorstellung", "gehaltsvorstellungen", "gehaltswunsch", "erwartetes gehalt",
  "salaire attendu", "pretentions salariales", "pretensiones salariales", "salaire souhaite",
  "expectativas salariales", "salario deseado",
  "aspettative retributive", "aspettativa salariale", "ral desiderato",
];

// Current/previous-pay references. Used only to upgrade an expectation phrase
// into a flag when the same sentence also references current or previous pay.
const CURRENT_PREV_RE =
  /\b(current|previous|prior|past|history|historical|most recent|last|recent|existing|aktuell|aktuelle|aktueller|aktuelles|bisherig|bisherige|bisheriger|bisheriges|nachweis|actuel|actuelle|precedent|precedente|historique|dernier|derniere|anterior|ultimo|historial|attuale|precedente|storia|storico)\b/i;

export function detectPayHistoryAsk(text) {
  const t = String(text ?? "");
  if (!t.trim()) return { found: false, matches: [] };

  const direct = HISTORY_CUES.filter((cue) => includesNorm(t, cue));

  const sentences = t.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const viaExpectation = [];
  for (const sentence of sentences) {
    const hasExpectation = EXPECTATION_PHRASES.some((p) => includesNorm(sentence, p));
    if (hasExpectation && CURRENT_PREV_RE.test(normalize(sentence))) {
      viaExpectation.push(...EXPECTATION_PHRASES.filter((p) => includesNorm(sentence, p)));
    }
  }

  const found = direct.length > 0 || viaExpectation.length > 0;
  const matches = [...new Set([...direct, ...viaExpectation])];
  return { found, matches };
}

// --- gender-neutral titles --------------------------------------------------

const DE_NEUTRAL_MARKER_RE =
  /(?:m\/w\/(?:d|x|divers)|w\/m\/(?:d|x)|d\/m\/w|all\s+genders)/i;

const DE_GENDERED_NOUNS = [
  "kaufmann", "kauffrau", "verkaufer", "verkauferin", "kellner", "kellnerin",
  "sekretar", "sekretarin", "krankenschwester", "krankenpfleger",
  "friseur", "friseurin", "putzfrau", "hausmann", "hausfrau",
  "verkaufsleiter", "verkaufsleiterin",
];

const EN_GENDERED_TITLES = [
  "salesman", "saleswoman", "saleslady", "salesgirl", "handyman", "waitress",
  "stewardess", "hostess", "actress", "businessman", "businesswoman",
  "chairman", "chairwoman", "spokesman", "spokeswoman", "foreman", "forewoman",
  "fireman", "policeman", "policewoman", "postman", "mailman", "deliveryman",
  "repairman", "cameraman", "workman", "anchorman", "anchorwoman", "barman", "barmaid",
];

const findRaw = (text, word) => {
  const m = wordRe(word).exec(String(text ?? ""));
  return m ? m[0] : word;
};

export function checkGenderNeutralTitle(text) {
  const t = String(text ?? "").trim();
  if (!t) return { finding: "unknown", detail: "No title text to assess." };

  const firstLine = t.split(/\n+/)[0].trim();
  const scope = firstLine || t;

  const deNouns = DE_GENDERED_NOUNS.filter((n) => hasWord(scope, n));
  const enTitles = EN_GENDERED_TITLES.filter((n) => hasWord(scope, n));
  const hasNeutralMarker = DE_NEUTRAL_MARKER_RE.test(scope);

  if (deNouns.length > 0) {
    if (hasNeutralMarker) {
      return {
        finding: "ok",
        detail: "A gendered noun form appears with a neutrality marker (m/w/d or similar), so no gendered-title finding.",
      };
    }
    return {
      finding: "flag",
      detail: `Gendered job title detected ("${findRaw(scope, deNouns[0])}") without a neutrality marker. Directive (EU) 2023/970 Art 5(3) requires job titles and vacancy notices to be gender-neutral.`,
    };
  }

  if (enTitles.length > 0) {
    return {
      finding: "flag",
      detail: `Gendered job title detected ("${findRaw(scope, enTitles[0])}"). Art 5(3) requires job titles and vacancy notices to be gender-neutral.`,
    };
  }

  return { finding: "ok", detail: "No gendered job title detected." };
}

// --- combined assessment ----------------------------------------------------

export function assessAd(text) {
  const range = detectSalaryRange(text);
  const history = detectPayHistoryAsk(text);
  const title = checkGenderNeutralTitle(text);

  return [
    {
      check: "Salary range",
      status: range.found ? "ok" : "advice",
      message: range.found ? MESSAGES.salaryRange.ok : MESSAGES.salaryRange.advice,
    },
    {
      check: "Pay history",
      status: history.found ? "flag" : "ok",
      message: history.found ? MESSAGES.payHistory.flag : MESSAGES.payHistory.ok,
    },
    {
      check: "Gender-neutral title",
      status: title.finding === "flag" ? "flag" : "ok",
      message: MESSAGES.genderNeutralTitle[title.finding] ?? MESSAGES.genderNeutralTitle.ok,
    },
  ];
}
