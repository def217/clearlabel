/**
 * Pure HTML derivation for ClearLabel outbound mail.
 * No I/O, no side effects: turn a draft "text" (Subject: line + body) into
 * { subject, html, textBody }. The HTML is a multipart-alternative HTML part;
 * the plain-text part (textBody) is the original body, untouched.
 */

// Ordered link-label rules. First match wins. Each key is a URL prefix and
// matching is "href.startsWith(key)", so order matters.
export const LINK_LABELS = new Map([
  ['https://clearlabel.eu/pay-transparency', 'Check a job ad free'],
  ['https://clearlabel.eu/?', 'Run the free scanner'],
  ['https://clearlabel.gumroad.com/l/agency-licence', 'Agency Licence, EUR 149'],
  ['https://clearlabel.gumroad.com/l/article-50-compliance-pack', 'Compliance Pack, EUR 49'],
  ['https://clearlabel.gumroad.com/l/pay-transparency-kit', 'Pay Transparency Kit, EUR 49'],
  ['https://clearlabel.gumroad.com/l/monitor', 'ClearLabel Monitor'],
  ['https://clearlabel.eu/study/', 'the 883-site study'],
]);

export const STUDY_URL = 'https://clearlabel.eu/study/';

export const SIGNATURE_NAME = 'Jonas';
export const SIGNATURE_ROLE = 'Founder, ClearLabel';

// The final two footer lines of the existing drafts. Replaced in HTML by the
// signature block; left untouched in the plain-text part.
const FOOTER_SIGN_OFF = 'ClearLabel, clearlabel.eu';
const FOOTER_STOP = 'Tell us to stop emailing and we will.';

const MAX_LABEL_LEN = 40;

const escapeHtml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// **bold** pairs → <strong>…</strong>. Non-greedy and pairs-only: a lone ** has
// no partner and stays literal. Runs on already-escaped text.
const BOLD_RE = /\*\*(.+?)\*\*/g;
const markBold = (escaped) => escaped.replace(BOLD_RE, '<strong>$1</strong>');
// Plain-text side: drop the ** markers, keep the inner text.
export const stripBoldMarkers = (text) => text.replace(BOLD_RE, '$1');

const labelFor = (href) => {
  for (const [prefix, label] of LINK_LABELS) {
    if (href.startsWith(prefix)) return label;
  }
  let hostPath;
  try {
    const u = new URL(href);
    hostPath = u.host + u.pathname;
  } catch {
    hostPath = href;
  }
  return hostPath.length > MAX_LABEL_LEN ? hostPath.slice(0, MAX_LABEL_LEN) : hostPath;
};

// Replace bare http(s) URLs in already-escaped text with styled anchors.
// Sentence-ending punctuation is left outside the anchor.
const TRAIL = '.,;:!?)]}';
const URL_RE = /https?:\/\/[^\s<>]+/g;

const linkify = (escaped) => escaped.replace(URL_RE, (raw) => {
  let url = raw;
  let trailing = '';
  while (url.length && TRAIL.includes(url[url.length - 1])) {
    trailing = url[url.length - 1] + trailing;
    url = url.slice(0, -1);
  }
  return `<a href="${url}" style="color:#22407c">${labelFor(url)}</a>${trailing}`;
});

// A single line (a paragraph is split on \n first) that is just "Label:
// <url>" (checked on the raw line before escaping; equivalent post-escape
// too, since the label charset and the URL match are unaffected by entity
// escaping). The label just repeats what the anchor text already says, so
// it's dropped and only the anchor is rendered. A line with more than one
// URL, or trailing text after the URL, doesn't match and keeps its prefix.
const LABELED_LINE_RE = /^[A-Za-z][A-Za-z0-9 À-ſ-]{0,24}:\s+(https?:\/\/\S+)$/;

const bodyHtml = (escapedBody) => {
  const paragraphs = escapedBody
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Drop the known two-line footer; the signature block replaces it.
  if (
    paragraphs.length >= 2
    && paragraphs[paragraphs.length - 2] === FOOTER_SIGN_OFF
    && paragraphs[paragraphs.length - 1] === FOOTER_STOP
  ) {
    paragraphs.pop();
    paragraphs.pop();
  }

  return paragraphs
    .map((p) => {
      const lines = p.split('\n').map((line) => {
        const labeled = line.match(LABELED_LINE_RE);
        return labeled ? linkify(labeled[1]) : linkify(line);
      });
      return `<p>${lines.join('<br>')}</p>`;
    })
    .join('\n');
};

// Auto-link the literal phrase "883-site study" (first occurrence only) to
// the study page, once escaping and URL linkification are already done.
// Skipped if the phrase falls inside an existing <a>...</a> (e.g. the "the
// 883-site study" label that labelFor renders for a bare study URL already
// present in the body).
const STUDY_PHRASE = '883-site study';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

const isInsideAnchor = (html, index) => {
  const lastOpen = html.lastIndexOf('<a', index);
  const lastClose = html.lastIndexOf('</a>', index);
  return lastOpen !== -1 && lastOpen > lastClose;
};

// First clearlabel.eu URL in the raw body carrying utm params: those same
// values are carried over to the study link. None found: bare STUDY_URL.
const studyHref = (rawBody) => {
  const urls = rawBody.match(URL_RE) || [];
  for (const raw of urls) {
    let url = raw;
    while (url.length && TRAIL.includes(url[url.length - 1])) {
      url = url.slice(0, -1);
    }
    if (!url.startsWith('https://clearlabel.eu')) continue;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    const params = new URLSearchParams();
    for (const key of UTM_KEYS) {
      const value = parsed.searchParams.get(key);
      if (value !== null) params.set(key, value);
    }
    if (params.toString()) return `${STUDY_URL}?${params.toString()}`;
  }
  return STUDY_URL;
};

const linkStudyPhrase = (html, rawBody) => {
  const index = html.indexOf(STUDY_PHRASE);
  if (index === -1 || isInsideAnchor(html, index)) return html;
  const href = studyHref(rawBody).replace(/&/g, '&amp;');
  const anchor = `<a href="${href}" style="color:#22407c">${STUDY_PHRASE}</a>`;
  return html.slice(0, index) + anchor + html.slice(index + STUDY_PHRASE.length);
};

export const textToHtml = (text, opts = {}) => {
  const m = text.match(/^Subject:\s*([^\r\n]+)(?:\r?\n)+([\s\S]*)$/);
  const subject = m ? m[1].trim() : '';
  const textBody = (m ? m[2] : text).trim();

  const body = linkStudyPhrase(bodyHtml(markBold(escapeHtml(textBody))), textBody);

  const html = [
    '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:560px;margin:0 auto;color:#1b1a16">',
    '  <div style="font-size:20px;font-weight:bold;letter-spacing:-0.01em;padding:14px 0;border-bottom:2px solid #1b1a16;margin-bottom:18px">ClearLabel <span style="color:#22407c">·</span> <span style="font-size:12px;font-weight:normal;color:#5f5c54;letter-spacing:0.04em">EU COMPLIANCE TOOLS</span></div>',
    `  <div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3d3a33">${body}</div>`,
    '  <div style="margin-top:22px;padding-top:14px;border-top:1px solid #d9d5c9;font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:14px;color:#3d3a33">',
    `    ${SIGNATURE_NAME}<br><span style="color:#5f5c54">${SIGNATURE_ROLE}</span><br><a href="https://clearlabel.eu" style="color:#22407c">clearlabel.eu</a>`,
    '  </div>',
    '  <div style="margin-top:16px;font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:12px;color:#8a877d">Tell us to stop emailing and we will: reply or write to <a href="mailto:info@clearlabel.eu" style="color:#8a877d">info@clearlabel.eu</a>.</div>',
    '</div>',
  ].join('\n');

  return { subject, html, textBody };
};
