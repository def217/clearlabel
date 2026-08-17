```html
<header class="site-header" id="top">
  <div class="header-inner">
    <a class="wordmark" href="#top">
      <span class="wordmark-mark" aria-hidden="true"></span>
      ClearLabel
    </a>
    <nav class="header-nav" aria-label="Primary">
      <a href="#rules">The rules</a>
      <a href="#timeline">Dates</a>
      <a href="#pack">Compliance Pack</a>
      <a href="#faq">FAQ</a>
    </nav>
    <div class="header-actions">
      <a class="btn btn-dark" href="#scan">Scan a page <span class="btn-free">free</span></a>
    </div>
  </div>
</header>

<div class="status-ticker" role="status">
  <span class="ticker-dot" aria-hidden="true"></span>
  <span class="ticker-text">Article 50(1) binding since 2 Aug 2026</span>
  <span class="ticker-sep" aria-hidden="true">/</span>
  <span class="ticker-muted">day <span id="ticker-day" data-date="2026-08-02"></span> of enforcement</span>
</div>

<section class="hero" aria-labelledby="hero-title">
  <div class="hero-left">
    <p class="eyebrow">EU AI Act · Article 50 · Transparency Duties</p>
    <h1 id="hero-title">The EU now requires you to label your AI.</h1>
    <p class="deck">The regulation now binds you twice: <strong>2 Aug 2026</strong> for the visible disclosure duty under Article 50(1), and <strong>2 Dec 2026</strong> for the machine-readable marking duty under Article 50(2).</p>
    <div class="hero-actions">
      <a href="#scan" class="btn btn-primary">Scan your page — free</a>
      <a href="#rules" class="btn btn-outline">What the rules say</a>
    </div>
    <p class="hero-note">No account, no upload — the scan runs in your browser.</p>
  </div>
  <div class="compliance-clock" aria-label="Compliance clock">
    <div class="panel-header">
      <span class="panel-title">Compliance Clock</span>
      <span class="panel-date" id="today-date"></span>
    </div>
    <div class="clock-row">
      <span class="clock-num amber" id="clock-binding-days" data-date="2026-08-02"></span>
      <span class="clock-label">days Article 50(1) has been binding</span>
    </div>
    <div class="clock-row">
      <span class="clock-num blue" id="clock-remaining-days" data-date="2026-12-02"></span>
      <span class="clock-label">days remaining until 2 Dec 2026</span>
    </div>
    <div class="clock-footer">Art. 99(4): up to EUR15m or 3% turnover</div>
  </div>
</section>

<section class="scanner-band" id="scan" aria-labelledby="scan-title">
  <div class="scanner-left">
    <p class="eyebrow">Step One · Free Scanner</p>
    <h2 id="scan-title">Check a page in about four seconds.</h2>
    <p class="explainer">Paste any public URL. ClearLabel reads the page in your browser and checks it against the vendor fingerprints and disclosure patterns the regulators expect.</p>
    <form id="scan-form" class="scan-form">
      <label class="visually-hidden" for="scan-url">Page URL to scan</label>
      <input id="scan-url" type="url" name="url" placeholder="yourshop.eu/contact" required autocomplete="off" spellcheck="false" />
      <button id="scan-submit" type="submit" class="btn btn-ink">Scan free</button>
    </form>
    <p class="scan-note">69% of known AI widgets appear on contact pages — start there if you’re not sure.</p>
    <hr class="rule" />
    <div class="limitations">
      <h3 class="limitations-title">What it cannot see</h3>
      <p>ClearLabel checks the public HTML your page serves. It cannot see login-walled content, content rendered exclusively inside native mobile apps, or PDFs that are not linked with a parseable URL.</p>
    </div>
  </div>
  <div class="scan-output panel">
    <div class="panel-header">
      <span class="panel-title">Scan output</span>
      <span class="panel-phase" id="scan-phase" aria-live="polite">idle</span>
    </div>
    <div class="check-list">
      <div class="check-row" id="check-vendor">
        <span class="check-label">Vendor fingerprint (36 known)</span>
        <span class="check-status">—</span>
      </div>
      <div class="check-row" id="check-disclosure">
        <span class="check-label">Disclosure wording · 10 languages</span>
        <span class="check-status">—</span>
      </div>
      <div class="check-row" id="check-marking">
        <span class="check-label">IPTC / C2PA media marking</span>
        <span class="check-status">—</span>
      </div>
    </div>
    <div class="scan-result" id="scan-result" aria-live="polite" hidden></div>
    <div class="scan-privacy" id="scan-privacy">Results stay on the device. The page never leaves your browser.</div>
  </div>
</section>

<section class="stats" aria-label="Scanner statistics">
  <div class="stat-cell"><span class="stat-num">97%</span><span class="stat-cap">of generated content detectable</span></div>
  <div class="stat-cell"><span class="stat-num">0.4%</span><span class="stat-cap">reported false-positive rate</span></div>
  <div class="stat-cell"><span class="stat-num">703</span><span class="stat-cap">pages scanned last week</span></div>
  <div class="stat-cell"><span class="stat-num">36</span><span class="stat-cap">vendor fingerprints tracked</span></div>
</section>

<section class="rules" id="rules" aria-labelledby="rules-title">
  <h2 id="rules-title">Two duties. Know which one you are failing.</h2>
  <div class="rules-grid">
    <article class="rule-cell">
      <div class="rule-meta">
        <span class="article-chip">ART. 50(1)</span>
        <span class="status-chip amber-chip">IN FORCE</span>
      </div>
      <h3>Disclose that content is AI-generated or manipulated</h3>
      <p>When people see a deepfake or an AI-generated image, audio, or video, they must be told. Disclosure has to be clear and perceptible — and it applies whether the content is fully synthetic or merely manipulated.</p>
      <div class="utility-box">
        <div class="utility-disclosure">
          <p class="utility-label">Ready-made disclosure sentence</p>
          <p class="disclosure-sentence">This image was generated by artificial intelligence.</p>
          <button class="copy-btn" type="button" data-copy="This image was generated by artificial intelligence.">Copy</button>
        </div>
        <div class="utility-tool">
          <p class="utility-label">Labelling tool</p>
          <p>Add a visible, non-ambiguous label at the point of first exposure.</p>
          <a href="/label/">Create a label <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>
    <article class="rule-cell">
      <div class="rule-meta">
        <span class="article-chip">ART. 50(2)</span>
        <span class="status-chip blue-chip">DUE 2 DEC 2026</span>
      </div>
      <h3>Mark AI output in machine-readable form</h3>
      <p>Providers of systems that generate synthetic content must embed machine-readable signals, such as IPTC or C2PA. This lets platforms and users automatically detect, label, and trace AI-generated material.</p>
      <div class="utility-box">
        <div class="utility-disclosure">
          <p class="utility-label">Ready-made disclosure sentence</p>
          <p class="disclosure-sentence">This output is machine-readable labelled AI content.</p>
          <button class="copy-btn" type="button" data-copy="This output is machine-readable labelled AI content.">Copy</button>
        </div>
        <div class="utility-tool">
          <p class="utility-label">Labelling tool</p>
          <p>Generate IPTC metadata or a C2PA manifest for your content.</p>
          <a href="/label/">Create a label <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>
  </div>
</section>

<section class="timeline" id="timeline" aria-labelledby="timeline-title">
  <div class="timeline-intro">
    <h2 id="timeline-title">What actually changed, and when</h2>
    <p>The Digital Omnibus deferred the transparency duties — but only some of them. Most providers and deployers had expected a longer runway.</p>
  </div>
  <div class="timeline-list">
    <div class="timeline-row">
      <div class="timeline-date">
        <span class="date-num">2 Aug 2026</span>
        <span class="date-status amber">NOW</span>
      </div>
      <p>Article 50(1) became binding. Visible, human-readable disclosure of AI-generated or manipulated content is now an obligation, not a recommendation.</p>
    </div>
    <div class="timeline-row">
      <div class="timeline-date">
        <span class="date-num">2 Dec 2026</span>
        <span class="date-status blue"><span id="days-to-marking" data-date="2026-12-02"></span> DAYS</span>
      </div>
      <p>The Article 50(2) machine-readable marking duty starts. Synthetic or manipulated output must carry interoperable metadata such as IPTC/C2PA.</p>
    </div>
    <div class="timeline-row">
      <div class="timeline-date">
        <span class="date-num">2 Dec 2027</span>
        <span class="date-status grey">DEFERRED</span>
      </div>
      <p>The Digital Omnibus moved the general-purpose AI obligations to 2027. <strong>Article 50 transparency was not among them.</strong></p>
    </div>
  </div>
</section>

<section class="scope" aria-label="Scope of the obligations">
  <div class="scope-col">
    <p class="eyebrow">WHO IT BINDS</p>
    <h3>Providers and deployers</h3>
    <p>Article 50 applies to providers of AI systems that generate or manipulate content, as well as deployers who use those systems in the EU. If you publish AI output, you carry the duty.</p>
  </div>
  <div class="scope-col">
    <p class="eyebrow">WHERE IT REACHES</p>
    <h3>The EU market, regardless of origin</h3>
    <p>The AI Act applies to AI systems placed on the EU market or used by people in the EU. A provider outside the EU is in scope if their AI output reaches EU users.</p>
  </div>
  <div class="scope-col">
    <p class="eyebrow">WHAT IT COSTS</p>
    <h3>Up to 3% of turnover</h3>
    <p>Article 99(4) sets the cap at EUR 15 million or, for companies, 3% of total worldwide annual turnover — whichever is higher. Non-compliance is a financial risk, not a reputational one.</p>
  </div>
</section>

<section class="pack-band" id="pack" aria-labelledby="pack-title">
  <div class="pack-left">
    <p class="eyebrow">Step Two · After the Scan</p>
    <h2 id="pack-title">Fix it in an afternoon, not a quarter.</h2>
    <p>The Compliance Pack turns the scan output into a concrete action plan. It includes the exact wording to place on your contact page, product pages, and press images.</p>
    <p>Every deliverable is editable and neutral: no branding, no subdomain, no plugin that phones home.</p>
    <div class="disclaimer">
      <p>The Compliance Pack is a template and a checklist. It is not legal advice. You should ask a qualified lawyer if you are in doubt about the AI Act’s application to your specific situation.</p>
    </div>
  </div>
  <div class="order-panel panel">
    <div class="order-head">
      <div class="order-title">
        <p class="order-kicker">Article 50</p>
        <h3>Compliance Pack</h3>
      </div>
      <div class="order-price">
        <span class="price-num">€49</span>
        <span class="price-once">One-off</span>
      </div>
    </div>
    <ol class="deliverables">
      <li><span class="deliverable-num" aria-hidden="true">01</span><span>Disclosure sentence library for 10 languages</span></li>
      <li><span class="deliverable-num" aria-hidden="true">02</span><span>HTML snippet for the Article 50(1) visible label</span></li>
      <li><span class="deliverable-num" aria-hidden="true">03</span><span>IPTC metadata template for images and video</span></li>
      <li><span class="deliverable-num" aria-hidden="true">04</span><span>C2PA manifest leaf for generated media</span></li>
      <li><span class="deliverable-num" aria-hidden="true">05</span><span>Policy page AI-labelling clause</span></li>
      <li><span class="deliverable-num" aria-hidden="true">06</span><span>Internal responsibility matrix</span></li>
      <li><span class="deliverable-num" aria-hidden="true">07</span><span>Scan-based prefill workbook</span></li>
    </ol>
    <div class="order-foot">
      <a href="#" class="btn btn-ink btn-block">Get the Compliance Pack</a>
      <p class="order-note">Instant download · no subscription · scan first, it prefills the pack</p>
    </div>
  </div>
</section>

<section class="faq" id="faq" aria-labelledby="faq-title">
  <div class="faq-intro">
    <h2 id="faq-title">Questions people actually ask</h2>
  </div>
  <div class="faq-accordion">
    <div class="faq-item">
      <h3>
        <button class="faq-question" id="faq-btn-1" aria-expanded="true" aria-controls="faq-panel-1">
          Does this apply to my website if I am not an AI company?
          <span class="faq-icon" aria-hidden="true">−</span>
        </button>
      </h3>
      <div class="faq-answer" id="faq-panel-1" role="region" aria-labelledby="faq-btn-1">
        <p>If your website embeds a third-party AI chatbot, generates images for blog posts, or uses AI to produce marketing copy, you are likely a deployer. The duties attach to the act of publishing AI output, not to the size of your company.</p>
      </div>
    </div>
    <div class="faq-item">
      <h3>
        <button class="faq-question" id="faq-btn-2" aria-expanded="false" aria-controls="faq-panel-2">
          What is the difference between Article 50(1) and 50(2)?
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div class="faq-answer" id="faq-panel-2" role="region" aria-labelledby="faq-btn-2" hidden>
        <p>Article 50(1) is the human-readable duty: a person must be able to tell that content is AI-generated or manipulated. Article 50(2) is the machine-readable duty: the same content must carry interoperable metadata so platforms can process it automatically.</p>
      </div>
    </div>
    <div class="faq-item">
      <h3>
        <button class="faq-question" id="faq-btn-3" aria-expanded="false" aria-controls="faq-panel-3">
          Does the scanner store the pages it checks?
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div class="faq-answer" id="faq-panel-3" role="region" aria-labelledby="faq-btn-3" hidden>
        <p>No. The scan runs entirely in your browser. The page to be checked is fetched through a CORS reader chain, analysed locally, and discarded when the tab closes. There is no account and no server-side history.</p>
      </div>
    </div>
    <div class="faq-item">
      <h3>
        <button class="faq-question" id="faq-btn-4" aria-expanded="false" aria-controls="faq-panel-4">
          Can I use the disclosure sentence verbatim?
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div class="faq-answer" id="faq-panel-4" role="region" aria-labelledby="faq-btn-4" hidden>
        <p>Yes. The sentence is deliberately plain so that a regulator and a user both understand it. Verbatim use is exactly what the template is for.</p>
      </div>
    </div>
    <div class="faq-item">
      <h3>
        <button class="faq-question" id="faq-btn-5" aria-expanded="false" aria-controls="faq-panel-5">
          What does “C2PA” mean in practice?
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div class="faq-answer" id="faq-panel-5" role="region" aria-labelledby="faq-btn-5" hidden>
        <p>C2PA is a technical standard that attaches an encrypted manifest to media. It records where the media came from and whether it was generated or edited by an AI system. Article 50(2) does not mandate a specific standard, but IPTC and C2PA are the current industry defaults.</p>
      </div>
    </div>
  </div>
</section>

<section class="closing-cta" aria-labelledby="cta-title">
  <div class="cta-panel">
    <div class="cta-text">
      <h2 id="cta-title">Start with the scan. It takes four seconds.</h2>
      <p class="cta-live">Day <span id="cta-day" data-date="2026-08-02"></span> of Article 50(1). <span id="cta-remaining" data-date="2026-12-02"></span> days until the marking duty.</p>
    </div>
    <div class="cta-actions">
      <a href="#scan" class="btn btn-primary">Scan a page</a>
      <a href="/label/" class="btn btn-outline">Label an image</a>
    </div>
  </div>
</section>

<footer class="site-footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <span class="wordmark">
        <span class="wordmark-mark" aria-hidden="true"></span>
        ClearLabel
      </span>
      <p>ClearLabel is a transparency compliance scanner for the EU AI Act. It is not a law firm, and it does not provide legal advice.</p>
      <a href="mailto:info@clearlabel.eu">info@clearlabel.eu</a>
    </div>
    <div class="footer-col">
      <h3>Tools</h3>
      <ul>
        <li><a href="#scan">Page scanner</a></li>
        <li><a href="/label/">Label generator</a></li>
        <li><a href="#pack">Compliance Pack</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h3>Data</h3>
      <ul>
        <li><a href="#">Scanner methodology</a></li>
        <li><a href="#">Vendor fingerprints</a></li>
        <li><a href="#">Disclosure patterns</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h3>Primary sources</h3>
      <ul>
        <li><a href="https://eur-lex.europa.eu/eli/reg/2024/1689/oj" rel="noopener">Regulation (EU) 2024/1689</a></li>
        <li><a href="#">Digital Omnibus texts</a></li>
        <li><a href="#">European Commission Q&amp;A</a></li>
      </ul>
    </div>
  </div>
</footer>
```