# ClearLabel — EU AI Act Article 50 transparency check

**Free scanner + open vendor dataset for the AI-disclosure rule that has applied since 2 August 2026.**

👉 **[Run a scan](https://clearlabel.eu/)** — no signup, nothing stored, runs in your browser.

---

## Why this exists

Most EU AI Act tooling is built around **high-risk (Annex III)** obligations. The Digital Omnibus, given final Council approval on **29 June 2026**, deferred most of those to **2 December 2027**.

**Article 50 transparency was not deferred.** It has been binding since **2 August 2026**:

| Date | What applies |
|---|---|
| **2 Aug 2026** | Art. 50(1) — people must be informed they are interacting with an AI system, unless obvious. Art. 50(4) — deepfake and public-interest AI text disclosure. |
| **2 Dec 2026** | Art. 50(2) — machine-readable marking of synthetic audio/image/video/text. Four-month transition for systems already on the market before 2 Aug 2026. |
| **2 Dec 2027** | Most standalone high-risk obligations (deferred by the Digital Omnibus). |

If you enabled an AI agent in Zendesk, Intercom, Gorgias, Tidio, Crisp or HubSpot, **you are the deployer** and the duty is yours, not your vendor's.

## What the scanner does

1. Fetches the public HTML of a URL.
2. Fingerprints known conversational-AI vendors (37 and counting).
3. Searches visible page copy for AI-disclosure wording in **10 EU languages**.
4. Reports per-article findings with an explicit confidence level.

It deliberately **does not** claim you are non-compliant. It reports what the page source does and does not show, and what that means you need to confirm.

### Limits, stated up front

- Homepage-only unless you pass a deeper URL. Widgets usually live on `/contact` or `/help`.
- Cannot see widgets injected later by a tag manager.
- Cannot open your chat widget or read your vendor console, so it cannot tell whether your AI mode is switched on.
- Heuristics, not an audit. Not legal advice.

## The dataset

[`data/vendors.json`](data/vendors.json) — **CC-BY-4.0**. Each vendor carries:

```jsonc
{
  "id": "crisp",
  "name": "Crisp",
  "aiNature": "ai-optional",        // ai-native | ai-optional | rule-based | content-gen
  "aiProduct": "MagicReply / Crisp AI",
  "patterns": ["client\\.crisp\\.chat", "\\$crisp"],
  "disclosureHook": "Operator nickname + welcome message in Crisp settings"
}
```

`aiNature` is what drives the Article 50(1) reasoning:

- **ai-native** — the product is an LLM agent by design. The duty applies.
- **ai-optional** — vendor ships both scripted and AI modes. The duty applies *if* AI mode is on; only the operator can confirm.
- **rule-based** — scripted flows. Art. 50(1) can still bite where the interface reads as human.

**PRs adding vendors are welcome.** Add the fingerprint, the `aiNature`, and where in that vendor's console the disclosure actually goes.

## CLI

```bash
node scanner/scan.mjs example.com
node scanner/scan.mjs @sites.txt > results.jsonl
```

Outputs JSONL. The CLI and the browser app import the **same** [`scanner/core.mjs`](scanner/core.mjs), so verdicts are identical by construction.

## Measured base rate

Scanning 33 EU consumer sites (30 readable) on 16 Aug 2026: **9 sites — 30% — ran a chat widget with no AI-disclosure wording anywhere in page copy.** Raw output in [`research/`](research/).

## Disclaimer

ClearLabel provides structured information and document drafts. It is not a law firm and this is not legal advice. Penalties under Art. 99(4) are set nationally and capped at €15m or 3% of worldwide turnover. For a binding view on your exposure, consult a qualified adviser in your member state.

## Sources

- [AI Act Article 50](https://artificialintelligenceact.eu/article/50/)
- [AI Act Article 99 — penalties](https://artificialintelligenceact.eu/article/99/)
- [AI Act Article 4 — AI literacy](https://artificialintelligenceact.eu/article/4/)
