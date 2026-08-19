import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  textToHtml,
  LINK_LABELS,
  SIGNATURE_NAME,
  SIGNATURE_ROLE,
  STUDY_URL,
} from './mail-html.mjs';

// A full draft with the two known footer lines, so footer replacement is exercised
// in tests that don't care about it.
const withFooter = (body) =>
  `Subject: Test subject\n\n${body}\n\nClearLabel, clearlabel.eu\n\nTell us to stop emailing and we will.`;

test('extracts the Subject: line and returns the rest as body', () => {
  const { subject, textBody } = textToHtml('Subject: AI disclosure check\n\nHello there\n\nClearLabel, clearlabel.eu\n\nTell us to stop emailing and we will.');
  assert.equal(subject, 'AI disclosure check');
  assert.equal(textBody, 'Hello there\n\nClearLabel, clearlabel.eu\n\nTell us to stop emailing and we will.');
});

test('escapes & < > " \' in the body text', () => {
  const { html } = textToHtml(`Subject: Esc

A & B <script>alert("x")</script> O'Reilly`);
  assert.ok(html.includes('A &amp; B'), 'ampersand escaped');
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'), 'angle brackets and quotes escaped');
  assert.ok(html.includes('O&#39;Reilly'), 'apostrophe escaped');
});

test('splits paragraphs on blank lines into <p> blocks', () => {
  const { html } = textToHtml('Subject: P\n\nFirst paragraph.\n\nSecond paragraph.');
  assert.ok(html.includes('<p>First paragraph.</p>'));
  assert.ok(html.includes('<p>Second paragraph.</p>'));
});

test('turns a single newline inside a paragraph into <br>', () => {
  const { html } = textToHtml('Subject: BR\n\nLine one\nLine two');
  assert.ok(html.includes('Line one<br>Line two'));
});

test('LINK_LABELS is ordered as specified', () => {
  assert.deepEqual([...LINK_LABELS.keys()], [
    'https://clearlabel.eu/pay-transparency',
    'https://clearlabel.eu/?',
    'https://clearlabel.gumroad.com/l/agency-licence',
    'https://clearlabel.gumroad.com/l/article-50-compliance-pack',
    'https://clearlabel.gumroad.com/l/pay-transparency-kit',
    'https://clearlabel.gumroad.com/l/monitor',
    'https://clearlabel.eu/study/',
  ]);
});

test('exports the human signature constants', () => {
  assert.equal(SIGNATURE_NAME, 'Jonas');
  assert.equal(SIGNATURE_ROLE, 'Founder, ClearLabel');
});

test('labels the pay-transparency URL', () => {
  const { html } = textToHtml(withFooter('See https://clearlabel.eu/pay-transparency now'));
  assert.ok(html.includes('>Check a job ad free</a>'));
});

test('labels a clearlabel.eu query URL as the free scanner', () => {
  const { html } = textToHtml(withFooter('See https://clearlabel.eu/?utm_source=outreach'));
  assert.ok(html.includes('>Run the free scanner</a>'));
});

test('labels the agency licence gumroad URL', () => {
  const { html } = textToHtml(withFooter('Get https://clearlabel.gumroad.com/l/agency-licence'));
  assert.ok(html.includes('>Agency Licence, EUR 149</a>'));
});

test('labels the article-50 compliance pack URL', () => {
  const { html } = textToHtml(withFooter('Get https://clearlabel.gumroad.com/l/article-50-compliance-pack'));
  assert.ok(html.includes('>Compliance Pack, EUR 49</a>'));
});

test('labels the pay-transparency kit URL', () => {
  const { html } = textToHtml(withFooter('Get https://clearlabel.gumroad.com/l/pay-transparency-kit'));
  assert.ok(html.includes('>Pay Transparency Kit, EUR 49</a>'));
});

test('labels the monitor URL', () => {
  const { html } = textToHtml(withFooter('Try https://clearlabel.gumroad.com/l/monitor'));
  assert.ok(html.includes('>ClearLabel Monitor</a>'));
});

test('labels the study URL', () => {
  const { html } = textToHtml(withFooter('Read https://clearlabel.eu/study/'));
  assert.ok(html.includes('>the 883-site study</a>'));
});

test('unknown URL falls back to host+path without query', () => {
  const { html } = textToHtml(withFooter('See https://example.com/hello?utm_source=x'));
  assert.ok(html.includes('href="https://example.com/hello?utm_source=x"'), 'href keeps full URL');
  assert.ok(html.includes('>example.com/hello</a>'), 'label is host+path, query stripped');
});

test('unknown URL fallback label is truncated at 40 chars', () => {
  const url = 'https://abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz.example.com/some/very/long/path/here';
  const { html } = textToHtml(withFooter(`See ${url}`));
  const u = new URL(url);
  const hostPath = u.host + u.pathname;
  assert.ok(hostPath.length > 40, 'sanity: host+path must exceed 40 chars');
  const expected = hostPath.slice(0, 40);
  assert.equal(expected.length, 40);
  assert.ok(html.includes(`>${expected}</a>`), 'label truncated to 40 chars');
  assert.ok(!html.includes(`>${hostPath}</a>`), 'full host+path not used as label');
});

test('replaces footer with signature in html', () => {
  const { html } = textToHtml(withFooter('Body line'));
  assert.ok(!html.includes('ClearLabel, clearlabel.eu'), 'sign-off line removed');
  assert.ok(!html.includes('Tell us to stop emailing and we will.'), 'original stop line removed');
  assert.ok(html.includes('Jonas<br>'), 'signature name present');
  assert.ok(html.includes('Founder, ClearLabel'), 'signature role present');
  assert.ok(html.includes('Tell us to stop emailing and we will: reply or write to'), 'unsubscribe line present');
});

test('preserves the original footer in the plain-text part', () => {
  const { textBody } = textToHtml(withFooter('Body line'));
  assert.ok(textBody.includes('ClearLabel, clearlabel.eu'));
  assert.ok(textBody.includes('Tell us to stop emailing and we will.'));
});

test('utm URL keeps the full href (query intact) while the label is clean', () => {
  const { html } = textToHtml(withFooter(
    'Free scanner: https://clearlabel.eu/?utm_source=outreach&utm_medium=email&utm_campaign=aug19&utm_content=example.com'
  ));
  assert.ok(html.includes(
    'href="https://clearlabel.eu/?utm_source=outreach&amp;utm_medium=email&amp;utm_campaign=aug19&amp;utm_content=example.com"'
  ), 'full href preserved');
  assert.ok(html.includes('>Run the free scanner</a>'), 'label is clean, not the URL');
});

test('two URLs on one line (single newline) become two labeled links with <br>', () => {
  const { html } = textToHtml(withFooter(
    'Free scanner: https://clearlabel.eu/?utm_source=x\nLicence: https://clearlabel.gumroad.com/l/agency-licence'
  ));
  assert.ok(html.includes('>Run the free scanner</a>'));
  assert.ok(html.includes('>Agency Licence, EUR 149</a>'));
  assert.ok(html.includes('</a><br><a'), 'single newline rendered as <br> between the two anchors');
});

test('a paragraph with two solo-URL lines drops both prefixes, textBody unchanged', () => {
  const { html, textBody } = textToHtml(withFooter(
    'Free scanner: https://clearlabel.eu/?utm_source=x\nLicence: https://clearlabel.gumroad.com/l/agency-licence'
  ));
  assert.ok(!html.includes('Free scanner:'), 'first prefix dropped');
  assert.ok(!html.includes('Licence:'), 'second prefix dropped');
  assert.ok(html.includes('>Run the free scanner</a>'));
  assert.ok(html.includes('>Agency Licence, EUR 149</a>'));
  assert.ok(textBody.includes('Free scanner: https://clearlabel.eu/?utm_source=x'), 'plain-text keeps first prefix');
  assert.ok(textBody.includes('Licence: https://clearlabel.gumroad.com/l/agency-licence'), 'plain-text keeps second prefix');
});

test('a "Label: <url>" line renders the anchor only, prefix dropped from html', () => {
  const { html, textBody } = textToHtml(withFooter('Free scanner: https://clearlabel.eu/?utm_source=outreach'));
  assert.ok(!html.includes('Free scanner:'), 'prefix dropped from html');
  assert.ok(html.includes('>Run the free scanner</a>'), 'anchor still rendered and labeled');
  assert.ok(textBody.includes('Free scanner: https://clearlabel.eu/?utm_source=outreach'), 'plain-text part keeps the prefix');
});

test('a line with a prefix and two URLs keeps its prefix (not the single-URL shape)', () => {
  const { html } = textToHtml(withFooter(
    'See both: https://clearlabel.eu/?utm_source=x and https://clearlabel.gumroad.com/l/agency-licence'
  ));
  assert.ok(html.includes('See both:'), 'prefix kept when the line has more than one URL');
  assert.ok(html.includes('>Run the free scanner</a>'));
  assert.ok(html.includes('>Agency Licence, EUR 149</a>'));
});

test('a German (non-ASCII) prefix is dropped too, the regex covers extended Latin letters', () => {
  const { html } = textToHtml(withFooter('Kostenloser Check: https://clearlabel.eu/?utm_source=de'));
  assert.ok(!html.includes('Kostenloser Check:'), 'German prefix dropped from html');
  assert.ok(html.includes('>Run the free scanner</a>'));
});

test('renders the text wordmark header', () => {
  const { html } = textToHtml(withFooter('Body line'));
  assert.ok(html.includes('ClearLabel <span style="color:#22407c">·</span>'));
  assert.ok(html.includes('EU COMPLIANCE TOOLS'));
});

test('auto-links the "883-site study" phrase, carrying utm params from the first clearlabel.eu URL', () => {
  const { html, textBody } = textToHtml(withFooter(
    'Our 883-site study found gaps in job ads.\n\nFree scanner: https://clearlabel.eu/?utm_source=outreach&utm_medium=email&utm_campaign=aug19-agency&utm_content=soledis.com'
  ));
  assert.ok(html.includes(
    '<a href="https://clearlabel.eu/study/?utm_source=outreach&amp;utm_medium=email&amp;utm_campaign=aug19-agency&amp;utm_content=soledis.com" style="color:#22407c">883-site study</a>'
  ), 'study phrase linked with utm params carried over from the scanner URL');
  assert.ok(!textBody.includes('clearlabel.eu/study/'), 'textBody has no study URL');
});

test('auto-links the "883-site study" phrase to a bare study URL when no utm URL is present', () => {
  const { html } = textToHtml(withFooter('Our 883-site study found gaps in job ads.'));
  assert.ok(html.includes(
    `<a href="${STUDY_URL}" style="color:#22407c">883-site study</a>`
  ), 'study phrase linked to the bare study URL');
});

test('does not inject a study link when the "883-site study" phrase is absent', () => {
  const { html } = textToHtml(withFooter('Just a normal email with no special phrase.'));
  assert.ok(!html.includes(STUDY_URL), 'no study link injected');
});
