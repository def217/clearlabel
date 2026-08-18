# Legal pages copy. Source of truth for /privacy/ and /terms/ builds.
# Drafted 2026-08-18 by Fable (legal-copy lane). Clarity section: pick ONE variant after research.
# Style: no em-dashes, plain human voice, short sentences. Site tone.

---

## PAGE 1: /privacy/ "Privacy policy"

Title tag: Privacy policy. ClearLabel
H1: Privacy policy
Effective line: Effective 18 August 2026. This page says what data moves where when you use clearlabel.eu, in plain words.

### Who runs this site

ClearLabel (clearlabel.eu). Contact: info@clearlabel.eu. Write to that address for anything in this policy, including exercising your rights.

### The short version

- No accounts, no sign-up, nothing to log into.
- We do not sell data, run ads, or profile anyone.
- Payments never touch us. Gumroad handles checkout as the seller of record.
- The free scanner analyses pages inside your browser. The address you scan is fetched through public read-only relays, and we never receive or store it.

### The free page scanner

The scan itself runs in your browser. Our servers never see the address you type, and we keep no record of it.

To read a page your browser cannot fetch directly, the scanner requests it through up to three public fetch relays: r.jina.ai (Jina AI), api.allorigins.win (AllOrigins), and whateverorigin.org. The relay sees the address you scan and your IP address, the same as any website you visit sees them. The relays return the page's public HTML and are not told who you are beyond that request. If you scan optional extra paths such as /contact, the same applies to those. If you would rather not use relays at all, you can check a page by hand with our guides instead.

### Visit analytics

We use two measurement tools. Neither sets cookies. Neither stores anything on your device.

- Cloudflare Web Analytics counts visits in aggregate. It sets no cookies and stores no identifier on your device.
- Microsoft Clarity shows us where people click and scroll, so we can see where the site confuses visitors. We set Clarity's consent signal to denied on every page, for everyone, so it runs in cookieless mode worldwide. It sets no cookies and stores nothing on your device. Text you type into forms is masked. In this mode Microsoft cannot stitch your page views into a session. Microsoft handles this data as an independent controller under its own privacy statement (https://privacy.microsoft.com/privacystatement).

Legal basis: our legitimate interest in understanding whether the site works (Art. 6(1)(f) GDPR). Neither tool follows you across other websites. If you object to this measurement, tell us at info@clearlabel.eu, or block the clarity.ms and cloudflareinsights.com domains in your browser; the site works fine without them.

### Buying the Compliance Pack

Checkout runs on Gumroad, Inc., which sells our products as merchant of record. Gumroad collects your payment details and email under its own privacy policy (link: https://gumroad.com/privacy). What we receive from Gumroad: your email address, what you bought, and your licence key status. We use that to deliver the product, honour the licence, and answer support mail. Legal basis: performance of the purchase and our legitimate interest in supporting it (Art. 6(1)(b) and (f) GDPR). We keep purchase records while the product is supported.

### Email

If you write to info@clearlabel.eu, we keep the thread as long as the conversation needs, at most two years after the last message, then delete it. Legal basis: answering you (Art. 6(1)(f) GDPR).

### Hosting

The site is served by GitHub Pages (GitHub, Inc.). Like any host, GitHub sees connection data such as your IP address in its server logs under its own privacy statement. Our DNS runs on Cloudflare.

### Who else handles data

- GitHub, Inc. (hosting)
- Cloudflare, Inc. (DNS, visit counting)
- Gumroad, Inc. (checkout, as independent merchant of record under its own terms)
- Microsoft Corporation (Clarity interaction analytics, as an independent controller under its own privacy statement)
- Fetch relays used by the scanner at your request: Jina AI, AllOrigins, WhateverOrigin

Some of these companies process data in the United States. Where they do, we rely on the safeguards they publish, such as EU-US Data Privacy Framework participation or standard contractual clauses. Each provider's own privacy policy has the details.

### Your rights

GDPR gives you the right to ask what we hold about you, to have it corrected or deleted, to restrict or object to processing, and to receive a copy in a portable format. In practice we hold very little: usually nothing unless you bought the pack or wrote to us. Mail info@clearlabel.eu and we answer within a month. You can also complain to your national data protection authority.

### Changes

If this policy changes, the new version appears here with a new effective date. This version: 18 August 2026.

---

## PAGE 2: /terms/ "Terms of use"

Title tag: Terms of use. ClearLabel
H1: Terms of use
Effective line: Effective 18 August 2026.

### Who we are

ClearLabel (clearlabel.eu). Contact: info@clearlabel.eu.

### What this site is

ClearLabel offers a free browser-based scanner that checks public pages for EU AI Act Article 50 transparency signals, free guides, an open vendor fingerprint dataset, and a paid document bundle called the Article 50 Compliance Pack, sold for a one-time price through Gumroad.

### Information, not legal advice

Everything on this site, free or paid, is general information and document drafting help. It is not legal advice, and using the site creates no lawyer-client relationship. We are not a law firm. Laws and official guidance change, and how Article 50 applies to your product depends on facts we cannot see from outside. For decisions that matter, have a qualified lawyer review your setup.

### The scanner is a signal, not a certificate

The scanner runs pattern checks on a page's public HTML. It can miss disclosures that exist, and it can flag things that turn out to be fine. A green result is not proof of compliance, and a red one is not proof of a violation. Treat every result as a starting point for your own check.

### The Compliance Pack licence

When you buy the Article 50 Compliance Pack you get a licence for one business entity. You may use, edit, and adapt the documents for that entity's own compliance work, including sharing them inside the entity and with its advisers. You may not resell, redistribute, sublicense, or publish the documents or derivatives of them. Each purchase comes with a licence key that identifies your licence.

### Buying, refunds, withdrawal

Sales run through Gumroad, Inc. as merchant of record, under Gumroad's terms (https://gumroad.com/terms) and its checkout flow, which also handles EU withdrawal and refund requests for digital content. If Gumroad's process leaves your problem unsolved, mail info@clearlabel.eu and we will sort it out directly.

### What we own, what is open

Site content and the Compliance Pack are ours. The vendor fingerprint dataset is open under CC-BY-4.0, as marked. The pack is licensed, not sold.

### Liability

We provide the site and the pack as they are. To the extent the law allows, we are not liable for indirect losses or for decisions made on the basis of information from this site. Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited, including under consumer protection rules that apply to you.

### Changes

We may update these terms. The current version, with its effective date, always lives at this address. This version: 18 August 2026.

---

## BUILD NOTES (for the page-assembly lane, not page content)

- Two new pages: /privacy/index.html and /terms/index.html on the canonical site chrome (copy any guide page as the shell: head links fonts-plex.css, site-chrome.css, styles.css, Clarity snippet, Cloudflare beacon, canonical header/footer byte-identical, id="main").
- DECIDED: Clarity stays on all pages, forced cookieless worldwide. On every page (all 50 after the new two) add, immediately after the existing Clarity IIFE inside the same script tag, the line: window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'denied'}); The snippet's queue stub makes pre-load calls safe. Add the same line to both gen-pages.mjs templates' Clarity constant.
- Sections become h2. "The short version" list stays a list. Keep sentences exactly as written here. No em-dashes anywhere.
- Footer on ALL 48+2 pages: add two links to the legal line area of the canonical footer: "Privacy" -> /privacy/ and "Terms" -> /terms/. Keep the footer byte-identical everywhere, update gen-pages.mjs templates the same way, rerun the chrome identity check.
- Scan form area on home: under the existing "No account, no upload" line add one small line: "Pages fetch through public read-only relays. See the privacy policy." with "privacy policy" linking /privacy/.
- Update sitemap.xml if present with the two URLs.
- Meta descriptions: privacy = "What data moves where when you use clearlabel.eu, in plain words. No accounts, no ads, no data sales."; terms = "The terms for ClearLabel's free scanner and the Article 50 Compliance Pack, in plain words."
- robots: nothing special, indexable.
