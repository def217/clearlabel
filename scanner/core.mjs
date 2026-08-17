/**
 * ClearLabel detection core.
 * Pure functions, no I/O, no Node built-ins - shared verbatim by the CLI scanner
 * and the browser app so both always produce identical verdicts.
 */

const CONFIDENCE = Object.freeze({ HIGH: 'high', MEDIUM: 'medium', LOW: 'low' });

export const STATUS = Object.freeze({
  ACTION_REQUIRED: 'action-required',
  CHECK_REQUIRED: 'check-required',
  LIKELY_OK: 'likely-ok',
  NO_SIGNAL: 'no-signal',
});

const MAX_SNIPPET = 120;

const compile = (patterns) =>
  patterns
    .map((p) => {
      try {
        return new RegExp(p, 'i');
      } catch {
        return null;
      }
    })
    .filter(Boolean);

/** Strip markup so phrase matching runs on human-visible copy, not script noise. */
export const toVisibleText = (html) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const detectVendors = (html, vendorDb) =>
  vendorDb.vendors.reduce((found, vendor) => {
    const hit = compile(vendor.patterns).find((re) => re.test(html));
    if (!hit) return found;
    return [
      ...found,
      {
        id: vendor.id,
        name: vendor.name,
        aiNature: vendor.aiNature,
        aiProduct: vendor.aiProduct ?? null,
        vendorDocs: vendor.vendorDocs,
        disclosureHook: vendor.disclosureHook,
        consolePath: vendor.consolePath ?? null,
        note: vendor.note ?? null,
        matchedOn: hit.source,
      },
    ];
  }, []);

export const detectDisclosure = (visibleText, phraseMap) =>
  Object.entries(phraseMap).reduce((found, [lang, phrases]) => {
    const matches = phrases.filter((phrase) => visibleText.includes(phrase));
    if (matches.length === 0) return found;
    const index = visibleText.indexOf(matches[0]);
    const start = Math.max(0, index - 40);
    return [
      ...found,
      { lang, phrases: matches, context: visibleText.slice(start, start + MAX_SNIPPET).trim() },
    ];
  }, []);

export const detectContentSignals = (html, signals) =>
  signals.reduce((found, signal) => {
    if (!compile(signal.patterns).some((re) => re.test(html))) return found;
    return [...found, { id: signal.id, name: signal.name, note: signal.note }];
  }, []);

const strongest = (vendors) => {
  if (vendors.some((v) => v.aiNature === 'ai-native')) return 'ai-native';
  if (vendors.some((v) => v.aiNature === 'ai-optional')) return 'ai-optional';
  if (vendors.some((v) => v.aiNature === 'rule-based')) return 'rule-based';
  return null;
};

const article50one = (nature, hasDisclosure) => {
  if (!nature) {
    return {
      article: '50(1)',
      status: STATUS.NO_SIGNAL,
      confidence: CONFIDENCE.LOW,
      title: 'No conversational AI widget detected in page source',
      detail:
        'No known chat or voice-agent vendor was fingerprinted here. Widgets injected by a tag manager, or present only on other pages, will not show up in this scan.',
    };
  }
  if (nature === 'ai-native' && !hasDisclosure) {
    return {
      article: '50(1)',
      status: STATUS.ACTION_REQUIRED,
      confidence: CONFIDENCE.HIGH,
      title: 'AI agent detected, no AI disclosure wording found on the page',
      detail:
        'An LLM-based assistant is embedded and no AI-disclosure phrase was found in visible page copy in any of the 12 languages checked. Article 50(1) requires the person to be told they are interacting with an AI system, clearly and at the latest at first interaction.',
    };
  }
  if (nature === 'ai-optional' && !hasDisclosure) {
    return {
      article: '50(1)',
      status: STATUS.CHECK_REQUIRED,
      confidence: CONFIDENCE.MEDIUM,
      title: 'Chat vendor with an AI mode detected, no AI disclosure wording found',
      detail:
        'This vendor ships both human-routed and AI-agent modes. If the AI mode is enabled on this workspace, Article 50(1) disclosure applies and none was detected in page copy.',
    };
  }
  if (nature === 'rule-based' && !hasDisclosure) {
    return {
      article: '50(1)',
      status: STATUS.CHECK_REQUIRED,
      confidence: CONFIDENCE.LOW,
      title: 'Scripted chat widget detected, no bot disclosure wording found',
      detail:
        'A scripted widget is present. Article 50(1) bites where an interface could reasonably be taken for a human. Confirm the operator name and greeting do not imply a human agent.',
    };
  }
  return {
    article: '50(1)',
    status: STATUS.LIKELY_OK,
    confidence: CONFIDENCE.MEDIUM,
    title: 'Chat vendor detected and AI-disclosure wording is present on the page',
    detail:
      'Disclosure wording was found in page copy. Article 50(1) requires it to be clear and distinguishable at the latest at first interaction, so confirm it appears inside the chat window itself and not only elsewhere on the page.',
  };
};

const article50two = (contentSignals) => {
  const marked = contentSignals.length > 0;
  return {
    article: '50(2)',
    status: marked ? STATUS.LIKELY_OK : STATUS.CHECK_REQUIRED,
    confidence: CONFIDENCE.LOW,
    title: marked
      ? 'Machine-readable synthetic-content marking detected'
      : 'No machine-readable synthetic-content marking detected',
    detail: marked
      ? contentSignals.map((s) => s.note).join(' ')
      : 'If any image, audio, video or published text on this site is AI-generated, it must carry machine-readable marking. For systems already on the market before 2 August 2026 the transitional deadline is 2 December 2026. This cannot be settled from page source alone - it is a self-declaration.',
  };
};

const rank = [STATUS.ACTION_REQUIRED, STATUS.CHECK_REQUIRED, STATUS.LIKELY_OK, STATUS.NO_SIGNAL];

export const assess = ({ vendors, disclosures, contentSignals }) => {
  const findings = [
    article50one(strongest(vendors), disclosures.length > 0),
    article50two(contentSignals),
  ];
  const overall = rank.find((status) => findings.some((f) => f.status === status));
  return { overall, findings };
};

/** Full pipeline over already-fetched HTML. */
export const scanHtml = (html, db) => {
  const visible = toVisibleText(html);
  const vendors = detectVendors(html, db);
  const disclosures = detectDisclosure(visible, db.disclosurePhrases);
  const contentSignals = detectContentSignals(html, db.contentGenSignals);
  return { vendors, disclosures, contentSignals, ...assess({ vendors, disclosures, contentSignals }) };
};
