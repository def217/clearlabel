```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@500;600&display=swap');

:root {
  --page: #f4f2ec;
  --band: #eae7de;
  --panel: #fffdf7;
  --footer: #e7e3d9;
  --ticker: #efece4;
  --ink: #1b1a16;
  --body: #3d3a33;
  --muted: #5b5850;
  --muted-2: #6f6b60;
  --hairline: #cfccc2;
  --hairline-dashed: #d9d5ca;
  --blue: #22407c;
  --blue-tint: #e8ecf6;
  --amber: #9a5b12;
  --amber-tint: #f7efe0;
  --font-serif: 'IBM Plex Serif', serif;
  --font-sans: 'IBM Plex Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border-radius: 0;
  box-shadow: none;
}

html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}

body {
  background: var(--page);
  color: var(--body);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

[id] {
  scroll-margin-top: 58px;
}

a {
  color: var(--blue);
  text-decoration: none;
}

a:hover {
  color: var(--ink);
}

:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

h1, h2, h3 {
  font-family: var(--font-serif);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.1;
  color: var(--ink);
}

h1 {
  letter-spacing: -0.02em;
}

p {
  max-width: 64ch;
}

.container {
  max-width: 1140px;
  margin: 0 auto;
  padding: 0 28px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 10px 18px;
  border: 1px solid transparent;
  border-radius: 2px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  text-align: center;
}

.btn-ink {
  background: var(--ink);
  color: #fff;
  border-color: var(--ink);
}

.btn-ink:hover {
  background: #000;
  color: #fff;
}

.btn-blue {
  background: var(--blue);
  color: #fff;
  border-color: var(--blue);
}

.btn-blue:hover {
  background: #1a3060;
  color: #fff;
}

.btn-outline {
  background: transparent;
  border-color: #b6b2a6;
  color: var(--ink);
}

.btn-outline:hover {
  background: var(--panel);
  color: var(--ink);
}

.free-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  margin-left: 5px;
}

/* Header */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 58px;
  background: rgba(244, 242, 236, 0.94);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--hairline);
}

.site-header .container {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 32px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.brand-mark {
  width: 11px;
  height: 11px;
  background: var(--blue);
}

.brand-name {
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 0.06em;
  color: var(--ink);
  white-space: nowrap;
}

.nav-links {
  display: flex;
  gap: 22px;
  margin-left: auto;
  list-style: none;
}

.nav-links a {
  font-size: 13.5px;
  color: #4f4c44;
  text-decoration: none;
}

.nav-links a:hover {
  color: var(--ink);
  text-decoration: underline;
}

.header-cta {
  flex: 0 0 auto;
  margin-left: 8px;
}

.header-cta .btn {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
}

.header-cta .free-tag {
  color: #c9c5bb;
}

/* Status ticker */
.status-ticker {
  background: var(--ticker);
  border-bottom: 1px solid var(--hairline);
}

.status-ticker .container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 9px;
  padding-bottom: 9px;
}

.ticker-dot {
  width: 7px;
  height: 7px;
  background: var(--amber);
  flex: 0 0 auto;
}

.ticker-status {
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--amber);
}

.ticker-day {
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Hero */
.hero {
  padding-top: 76px;
  padding-bottom: 56px;
}

.hero .container {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
  gap: 64px;
  align-items: start;
}

.hero h1 {
  font-size: clamp(38px, 4.6vw, 60px);
  line-height: 1.04;
  max-width: 17ch;
  margin-bottom: 20px;
}

.lead {
  font-size: 17.5px;
  line-height: 1.6;
  max-width: 56ch;
  color: var(--body);
}

.lead strong {
  color: var(--ink);
  font-weight: 600;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 28px;
}

.hero-note {
  margin-top: 14px;
  font-size: 13px;
  color: var(--muted);
  max-width: 56ch;
}

/* Compliance clock */
.compliance-clock {
  border: 1px solid var(--ink);
  background: var(--panel);
}

.clock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ink);
}

.clock-title {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink);
}

.clock-date {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted);
}

.clock-rows {
  padding: 16px;
  display: grid;
  gap: 16px;
}

.clock-row {
  display: grid;
  gap: 2px;
  padding-bottom: 16px;
  border-bottom: 1px dashed var(--hairline-dashed);
}

.clock-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.clock-num {
  font-family: var(--font-mono);
  font-size: 40px;
  line-height: 1;
}

.clock-label {
  font-size: 13.5px;
  color: var(--body);
}

.clock-num.amber {
  color: var(--amber);
}

.clock-num.blue {
  color: var(--blue);
}

.clock-footer {
  background: var(--page);
  border-top: 1px solid var(--hairline);
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}

/* Scanner band */
.scanner-band {
  background: var(--band);
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
  padding: 64px 0;
}

.scanner-band .container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 0.78fr);
  gap: 64px;
  align-items: start;
}

.scanner-copy h2 {
  margin-bottom: 16px;
}

.scanner-copy .lead {
  font-size: 16px;
  max-width: 58ch;
}

.scan-form {
  margin-top: 24px;
}

.scan-form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

#scan-url {
  font-family: var(--font-mono);
  font-size: 15px;
  border: 1px solid var(--ink);
  background: var(--panel);
  color: var(--ink);
  padding: 10px 12px;
  border-radius: 2px;
  width: 100%;
  max-width: 340px;
}

#scan-url::placeholder {
  color: var(--muted);
  opacity: 1;
}

#scan-submit {
  background: var(--ink);
  color: #fff;
  border: 1px solid var(--ink);
  padding: 10px 18px;
  font-weight: 600;
  border-radius: 2px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 14px;
}

#scan-submit:hover {
  background: #000;
}

.scan-note {
  margin-top: 12px;
  font-size: 13px;
  color: var(--muted);
  max-width: 56ch;
}

.scan-limits {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--hairline);
}

.scan-limits h3 {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
  margin-bottom: 4px;
}

.scan-limits p {
  font-size: 14px;
  color: var(--muted);
  max-width: 56ch;
}

/* Scanner output panel */
.scan-output {
  border: 1px solid var(--ink);
  background: var(--panel);
  min-height: 298px;
  display: flex;
  flex-direction: column;
}

.scan-output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ink);
}

.scan-output-title {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink);
}

.scan-phase {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted);
}

.scan-check-rows {
  padding: 4px 16px;
}

.scan-check {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px dashed var(--hairline-dashed);
  font-size: 14px;
  color: var(--body);
}

.scan-check:last-child {
  border-bottom: none;
}

.check-status {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted);
  margin-left: 16px;
}

.scan-output-bottom {
  margin-top: auto;
  background: var(--page);
  border-top: 1px solid var(--hairline);
  padding: 12px 16px;
  font-size: 13px;
  color: var(--muted);
}

.scan-result {
  margin-top: auto;
  background: var(--amber-tint);
  border-top: 1px solid var(--hairline);
  padding: 12px 16px;
}

.scan-result-summary {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--amber);
}

.scan-result-summary span {
  font-size: 13.5px;
  color: var(--body);
  font-family: var(--font-sans);
}

.scan-findings {
  margin-top: 8px;
}

.scan-finding {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13.5px;
  padding: 6px 0;
  border-top: 1px dashed var(--hairline-dashed);
}

.finding-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--blue);
  white-space: nowrap;
}

.scan-fix-link {
  display: block;
  width: 100%;
  text-align: center;
  background: var(--blue);
  color: #fff;
  padding: 10px 16px;
  margin-top: 8px;
  font-weight: 600;
  border-radius: 2px;
}

.scan-fix-link:hover {
  background: #1a3060;
  color: #fff;
}

/* Statistics */
.stats {
  padding: 48px 0;
  background: var(--page);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.stat-cell {
  padding: 16px 24px;
  border-left: 1px solid #dcd8ce;
}

.stat-cell:first-child {
  border-left: none;
}

.stat-figure {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--ink);
}

.stat-caption {
  margin-top: 4px;
  font-size: 13.5px;
  color: var(--muted);
}

/* Rules */
.rules {
  padding: 64px 0;
  background: var(--page);
  border-top: 1px solid var(--hairline);
}

.rules h2 {
  margin-bottom: 24px;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--hairline);
  border: 1px solid var(--hairline);
}

.rule-card {
  background: var(--panel);
  padding: 32px;
}

.rule-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.article-chip {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  border: 1px solid var(--ink);
  border-radius: 2px;
  padding: 4px 8px;
  color: var(--ink);
}

.status-chip {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 2px;
}

.status-in-force {
  background: var(--amber-tint);
  color: var(--amber);
}

.status-due {
  background: var(--blue-tint);
  color: var(--blue);
}

.rule-card h3 {
  font-size: 21px;
  margin-bottom: 8px;
}

.rule-card p {
  font-size: 15px;
  color: var(--body);
}

.utility-box {
  margin-top: 24px;
  border: 1px dashed var(--hairline-dashed);
  background: #f9f7f0;
  padding: 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.utility-disclosure {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--body);
}

.utility-tool {
  font-size: 13px;
  color: var(--muted);
  max-width: 28ch;
}

.utility-tool a {
  color: var(--blue);
}

.copy-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  background: transparent;
  border: 1px solid var(--ink);
  border-radius: 2px;
  padding: 4px 8px;
  color: var(--ink);
  cursor: pointer;
  margin-top: 8px;
}

.copy-btn:hover {
  background: var(--ink);
  color: #fff;
}

/* Timeline */
.timeline {
  padding: 64px 0;
  background: var(--page);
  border-top: 1px solid var(--hairline);
}

.timeline .container {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
  gap: 64px;
  align-items: start;
}

.timeline h2 {
  margin-bottom: 12px;
}

.timeline-standfirst {
  font-size: 16px;
  color: var(--body);
  max-width: 48ch;
}

.timeline-list {
  list-style: none;
}

.timeline-row {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 24px;
  padding: 20px 0;
  border-top: 1px solid var(--hairline);
}

.timeline-date {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--ink);
}

.timeline-status {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-top: 4px;
  color: var(--muted);
}

.timeline-status.now {
  color: var(--amber);
}

.timeline-status.days {
  color: var(--blue);
}

.timeline-status.deferred {
  color: var(--muted);
}

.timeline-row p {
  font-size: 15px;
  color: var(--body);
}

.timeline-row strong {
  font-weight: 600;
  color: var(--ink);
}

/* Scope */
.scope {
  padding: 48px 0;
  background: var(--page);
  border-top: 1px solid var(--hairline);
}

.scope-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 48px;
}

.scope-item .eyebrow {
  margin-bottom: 8px;
}

.scope-item h3 {
  font-size: 18px;
  margin-bottom: 8px;
}

.scope-item p {
  font-size: 14.5px;
  color: var(--body);
  max-width: 48ch;
}

/* Compliance Pack */
.pack {
  padding: 64px 0;
  background: var(--band);
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
}

.pack .container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 0.78fr);
  gap: 64px;
  align-items: start;
}

.pack-copy h2 {
  margin-bottom: 16px;
}

.pack-copy p {
  font-size: 16px;
  color: var(--body);
  max-width: 56ch;
  margin-top: 12px;
}

.pack-disclaimer {
  margin-top: 24px;
  border-left: 2px solid #b6b2a6;
  padding-left: 16px;
  font-size: 13.5px;
  color: var(--muted);
  max-width: 56ch;
}

.order-panel {
  border: 1px solid var(--ink);
  background: var(--panel);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--ink);
}

.order-title-left .eyebrow {
  margin-bottom: 4px;
}

.order-title {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--ink);
}

.order-price-block {
  text-align: right;
}

.order-price {
  font-family: var(--font-mono);
  font-size: 30px;
  line-height: 1;
  color: var(--ink);
}

.order-price-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 4px;
}

.order-list {
  list-style: none;
  padding: 8px 24px;
}

.order-item {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed var(--hairline-dashed);
  font-size: 14px;
  color: var(--body);
}

.order-item:last-child {
  border-bottom: none;
}

.order-num {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}

.order-text {
  max-width: 52ch;
}

.order-footer {
  border-top: 1px solid var(--hairline);
  padding: 16px 24px;
}

.order-cta {
  width: 100%;
}

.order-footnote {
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--muted);
  text-align: center;
}

/* FAQ */
.faq {
  padding: 64px 0;
  background: var(--page);
  border-top: 1px solid var(--hairline);
}

.faq .container {
  display: grid;
  grid-template-columns: minmax(0, 0.62fr) minmax(0, 1.38fr);
  gap: 64px;
  align-items: start;
}

.faq-list {
  list-style: none;
}

.faq-item {
  border-top: 1px solid var(--hairline);
}

.faq-item:last-child {
  border-bottom: 1px solid var(--hairline);
}

.faq-question {
  width: 100%;
  padding: 20px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 16.5px;
  font-weight: 500;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.faq-question:hover {
  color: var(--blue);
}

.faq-item.open .faq-question {
  font-weight: 600;
}

.faq-icon {
  font-family: var(--font-mono);
  font-size: 16px;
  color: var(--muted);
  margin-left: 16px;
  line-height: 1;
}

.faq-answer {
  display: none;
  padding: 0 0 20px;
  font-size: 15px;
  color: var(--body);
  max-width: 64ch;
}

.faq-item.open .faq-answer {
  display: block;
}

.faq-answer p {
  max-width: 64ch;
}

/* Closing CTA */
.closing-cta {
  padding: 64px 0;
  background: var(--page);
  border-top: 1px solid var(--hairline);
}

.closing-cta-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 40px;
  flex-wrap: wrap;
  border: 1px solid var(--ink);
  background: var(--panel);
  padding: 40px;
}

.closing-title {
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--ink);
  max-width: 30ch;
}

.closing-live {
  margin-top: 8px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.closing-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

/* Footer */
.site-footer {
  background: var(--footer);
  border-top: 1px solid var(--hairline);
  padding: 48px 0 24px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 40px;
}

.footer-brand {
  max-width: 30ch;
}

.footer-disclaimer {
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 12px;
}

.footer-mail {
  margin-top: 8px;
  display: inline-block;
  font-size: 13.5px;
  color: var(--body);
}

.footer-mail:hover {
  color: var(--ink);
}

.footer-col h4 {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink);
  margin-bottom: 12px;
}

.footer-col ul {
  list-style: none;
}

.footer-col li {
  margin: 4px 0;
}

.footer-col a {
  display: inline-block;
  padding: 2px 0;
  font-size: 13.5px;
  color: #3d3a33;
  text-decoration: none;
}

.footer-col a:hover {
  color: var(--ink);
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 900px) {
  .container {
    padding: 0 20px;
  }

  .site-header .container {
    gap: 16px;
  }

  .nav-links {
    gap: 12px;
  }

  .header-cta .free-tag {
    display: none;
  }

  .hero {
    padding-top: 40px;
  }

  .hero .container,
  .scanner-band .container,
  .timeline .container,
  .pack .container,
  .faq .container {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .hero h1 {
    font-size: clamp(36px, 8vw, 48px);
  }

  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-actions .btn {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .stat-cell {
    border-left: none;
    border-top: 1px solid #dcd8ce;
  }

  .stat-cell:nth-child(-n + 2) {
    border-top: none;
  }

  .rules-grid {
    grid-template-columns: 1fr;
  }

  .rule-card {
    padding: 24px;
  }

  .utility-box {
    grid-template-columns: 1fr;
  }

  .timeline-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .scope-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .closing-cta-panel {
    padding: 24px;
    flex-direction: column;
    align-items: flex-start;
  }

  .closing-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .closing-actions .btn {
    width: 100%;
  }

  .footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }

  .scanner-band .scan-form-row {
    flex-direction: column;
  }

  #scan-url {
    max-width: none;
  }

  #scan-submit {
    width: 100%;
  }

  .brand-name {
    font-size: 13px;
  }
}

@media (max-width: 560px) {
  .nav-links {
    display: none;
  }

  .footer-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-cell,
  .stat-cell:nth-child(-n + 2) {
    border-top: 1px solid #dcd8ce;
    border-left: none;
  }

  .stat-cell:first-child {
    border-top: none;
  }
}
```