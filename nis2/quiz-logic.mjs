// quiz-logic.mjs
//
// Pure, dependency-free decision logic for the NIS2 scope quiz.
// Browser-compatible (no node: imports, no I/O). Every legal fact comes ONLY
// from ops/nis2-legal-table.md (Directive (EU) 2022/2555); nothing is added
// from model memory.
//
// Conservative choices:
// - A missing or unrecognised sizeBand falls back to "micro-small" (the size floor).
// - `subsectorId` does not change the verdict: the table varies status only by
//   Annex, size band, and size-independent captures.
// - ecomms capture combined with an Annex II sector is reported as "edge"
//   (a conflicting combination), since ecomms providers are an Annex I type.

const STATUS = Object.freeze({
  ESSENTIAL: "essential",
  IMPORTANT: "important",
  LIKELY_OUT: "likely-out",
  EDGE: "edge",
});

const SIZE_BAND = Object.freeze({
  MICRO_SMALL: "micro-small",
  MEDIUM: "medium",
  LARGE: "large",
});

const CAPTURE = Object.freeze({
  ECOMMS: "ecomms",
  TRUST: "trust",
  TLD: "tld",
  DNS: "dns",
  DOMAINREG: "domainreg",
  SOLE_PROVIDER: "soleProvider",
  PUBLIC_ADMIN: "publicAdmin",
  CRITICAL_2557: "critical2557",
});

const ANNEX_I = 1;
const ANNEX_II = 2;

const VALID_SIZE_BANDS = new Set(Object.values(SIZE_BAND));

// Captures that make an entity essential regardless of size or sector:
// Art. 3(1)(b) (trust / TLD / DNS), Art. 3(1)(d) (central-government public
// administration), Art. 3(1)(f) (critical entities under Directive 2022/2557).
const ESSENTIAL_ANY_SIZE_CAPTURES = Object.freeze([
  CAPTURE.TRUST,
  CAPTURE.TLD,
  CAPTURE.DNS,
  CAPTURE.PUBLIC_ADMIN,
  CAPTURE.CRITICAL_2557,
]);

const CAPTURE_ARTICLE = Object.freeze({
  [CAPTURE.TRUST]: "Art. 3(1)(b)",
  [CAPTURE.TLD]: "Art. 3(1)(b)",
  [CAPTURE.DNS]: "Art. 3(1)(b)",
  [CAPTURE.PUBLIC_ADMIN]: "Art. 3(1)(d)",
  [CAPTURE.CRITICAL_2557]: "Art. 3(1)(f)",
});

const CAVEAT_EU_ONLY = "EU-level test only — national transposition can extend it";
const CAVEAT_NOT_ADVICE = "not legal advice";

const findSector = (data, sectorId) =>
  sectorId ? data.sectors.find((sector) => sector.id === sectorId) ?? null : null;

const hasAnyCapture = (captures, ids) => ids.some((id) => captures.has(id));

const captureLabel = (id, data) =>
  data.sizeIndependentCaptures.find((capture) => capture.id === id)?.label ?? id;

const sizeStatus = (annex, sizeBand) => {
  if (annex === ANNEX_I) {
    if (sizeBand === SIZE_BAND.LARGE) return STATUS.ESSENTIAL;
    if (sizeBand === SIZE_BAND.MEDIUM) return STATUS.IMPORTANT;
    return STATUS.LIKELY_OUT;
  }
  if (annex === ANNEX_II) {
    if (sizeBand === SIZE_BAND.LARGE || sizeBand === SIZE_BAND.MEDIUM) {
      return STATUS.IMPORTANT;
    }
    return STATUS.LIKELY_OUT;
  }
  return STATUS.LIKELY_OUT;
};

const makeVerdict = (status, reasons, obligations) => ({
  status,
  reasons: [...reasons, CAVEAT_EU_ONLY, CAVEAT_NOT_ADVICE],
  obligations,
});

const obligationsFor = (status, data, captures) => {
  const reporting = data.reporting ?? {};
  const fines = status === STATUS.ESSENTIAL
    ? data.fines.essential
    : data.fines.important;
  const trustNote = captures.has(CAPTURE.TRUST)
    ? ` Trust service providers: notification within ${reporting.trustProviderNotificationHours} hours (Art. 23(4) derogation).`
    : "";
  return [
    "Risk-management measures (Art. 21).",
    `Incident reporting (Art. 23(4)): early warning within ${reporting.earlyWarningHours} hours; incident notification within ${reporting.notificationHours} hours; final report ${reporting.finalReportAnchor}.${trustNote}`,
    `Registration info (Art. 3(4)): ${data.registration ?? ""}`,
    "Management accountability (Art. 20).",
    `Fines: ${fines}`,
  ];
};

const classifyEssentialCapture = (sector, captures, data) => {
  const names = ESSENTIAL_ANY_SIZE_CAPTURES
    .filter((id) => captures.has(id))
    .map((id) => `${captureLabel(id, data)} (${CAPTURE_ARTICLE[id]})`);
  // Conservative: trust is classified essential for qualified providers (Art. 3(1)(b));
  // publicAdmin for central government (Art. 3(1)(d)). The capture labels in
  // nis2-data.json carry the verify-notes for the non-qualified / regional variants.
  return makeVerdict(
    STATUS.ESSENTIAL,
    [
      `${names.join(", ")} → essential regardless of size.`,
      `Selected sector: ${sector.name} (Annex ${sector.annex}).`,
      "If the capture's verify-note applies to you (non-qualified trust provider, regional public administration), confirm the exact classification with the capture's cited article.",
    ],
    obligationsFor(STATUS.ESSENTIAL, data, captures),
  );
};

const classifyEcomms = (sector, sizeBand, captures, data) => {
  if (sector.annex !== ANNEX_I) {
    return makeVerdict(STATUS.EDGE, [
      "The ecomms capture identifies a public electronic communications provider — an Annex I 'Digital infrastructure' type — but an Annex II sector was selected; this is a conflicting combination, verify the entity's actual type.",
    ], []);
  }
  if (sizeBand === SIZE_BAND.MEDIUM) {
    return makeVerdict(STATUS.ESSENTIAL, [
      "Public electronic communications network/service provider that is medium-sized → essential (Art. 3(1)(c)); in scope regardless of size (Art. 2(2)(a)).",
    ], obligationsFor(STATUS.ESSENTIAL, data, captures));
  }
  if (sizeBand === SIZE_BAND.LARGE) {
    return makeVerdict(STATUS.ESSENTIAL, [
      "Annex I type that exceeds the medium-enterprise ceilings (large) → essential (Art. 3(1)(a)); in scope regardless of size (Art. 2(2)(a)).",
    ], obligationsFor(STATUS.ESSENTIAL, data, captures));
  }
  return makeVerdict(STATUS.IMPORTANT, [
    "Public e-comms provider is in scope regardless of size (Art. 2(2)(a)) but is small (below medium), so it is important rather than essential (Art. 3(2)).",
  ], obligationsFor(STATUS.IMPORTANT, data, captures));
};

const classifySoleProvider = (sector, captures, data) =>
  makeVerdict(STATUS.IMPORTANT, [
    "Sole provider in a Member State of a service essential to critical societal or economic activity is in scope regardless of size (Art. 2(2)(b)).",
    "Essential status depends on Member State designation under Art. 3(1)(e); by default it is important (Art. 3(2)) — verify whether the Member State designated it essential.",
  ], obligationsFor(STATUS.IMPORTANT, data, captures));

const classifyDomainreg = (sector, sizeBand, captures, data) => {
  const status = sizeStatus(sector.annex, sizeBand) === STATUS.LIKELY_OUT
    ? STATUS.IMPORTANT
    : sizeStatus(sector.annex, sizeBand);
  const reason = status === STATUS.ESSENTIAL
    ? `${sector.name} (Annex ${sector.annex}) is large → essential (Art. 3(1)(a)).`
    : `${sector.name} (Annex ${sector.annex}) in scope, not essential → important (Art. 3(2)).`;
  return makeVerdict(status, [
    "Domain name registration service providers are in scope regardless of size (Art. 2(4)).",
    reason,
  ], obligationsFor(status, data, captures));
};

const classifyBySize = (sector, sizeBand, captures, data) => {
  const status = sizeStatus(sector.annex, sizeBand);
  if (status === STATUS.ESSENTIAL) {
    return makeVerdict(STATUS.ESSENTIAL, [
      `${sector.name} is an Annex I type that exceeds the medium-enterprise ceilings (large) → essential (Art. 3(1)(a)).`,
    ], obligationsFor(STATUS.ESSENTIAL, data, captures));
  }
  if (status === STATUS.IMPORTANT) {
    const reason = sector.annex === ANNEX_I
      ? "Medium-sized Annex I entity (50-249 staff) → important, not essential (Art. 3(2)), unless caught by Art. 3(1)(b)-(f)."
      : "Annex II entity that is medium-sized or larger → important (Art. 3(2)).";
    return makeVerdict(STATUS.IMPORTANT, [reason], obligationsFor(STATUS.IMPORTANT, data, captures));
  }
  return makeVerdict(STATUS.LIKELY_OUT, [
    "Below the medium-enterprise size floor (Art. 2(1)); Member States may still designate individual entities under Art. 2(2)(b)-(e).",
  ], []);
};

export const evaluate = (answers, data) => {
  const sectorId = answers?.sectorId ?? null;
  const sector = findSector(data, sectorId);
  const captures = new Set(answers?.captures ?? []);
  const sizeBand = VALID_SIZE_BANDS.has(answers?.sizeBand)
    ? answers.sizeBand
    : SIZE_BAND.MICRO_SMALL;

  if (sectorId && !sector) {
    return makeVerdict(STATUS.EDGE, [
      `sectorId "${sectorId}" does not match an Annex I/II sector in the data; verify the entity's sector.`,
    ], []);
  }

  if (!sector && captures.size === 0) {
    return makeVerdict(STATUS.LIKELY_OUT, [
      "NIS2 applies to entities of a type referred to in Annex I or II; no Annex I/II sector was selected and no size-independent capture applies (Art. 2(1)).",
    ], []);
  }

  if (!sector) {
    return makeVerdict(STATUS.EDGE, [
      "A size-independent capture applies only to an entity that is a type in Annex I or II (Art. 2(2)-(4)); select the sector to classify.",
    ], []);
  }

  if (hasAnyCapture(captures, ESSENTIAL_ANY_SIZE_CAPTURES)) {
    return classifyEssentialCapture(sector, captures, data);
  }
  if (captures.has(CAPTURE.ECOMMS)) {
    return classifyEcomms(sector, sizeBand, captures, data);
  }
  if (captures.has(CAPTURE.SOLE_PROVIDER)) {
    return classifySoleProvider(sector, captures, data);
  }
  if (captures.has(CAPTURE.DOMAINREG)) {
    return classifyDomainreg(sector, sizeBand, captures, data);
  }
  return classifyBySize(sector, sizeBand, captures, data);
};
