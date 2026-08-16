import { markImage, readSourceType, SOURCE_TYPES, buildXmp } from '../scanner/xmp.mjs';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const VISIBLE_LABELS = {
  en: 'Image generated with AI',
  de: 'Mit KI erzeugtes Bild',
  fr: 'Image générée par IA',
  es: 'Imagen generada con IA',
  it: 'Immagine generata con IA',
  nl: 'Afbeelding gegenereerd met AI',
};

let picked = null;          // { buffer, name, type }
let sourceType = 'trainedAlgorithmicMedia';

const ICON = {
  ok: '<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
  warn: '<svg class="vi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
};
const note = (kind, head, body) =>
  `<div class="verdict v-${kind}">${kind === 'likely-ok' ? ICON.ok : ICON.warn}<div><h3>${esc(head)}</h3><p>${body}</p></div></div>`;

/* ---------- source-type chooser ---------- */
$('#opts').innerHTML = Object.entries(SOURCE_TYPES).map(([id, v], i) => `
  <label class="opt${i === 0 ? ' sel' : ''}" data-id="${id}">
    <input type="radio" name="src" value="${id}"${i === 0 ? ' checked' : ''}>
    <span><span class="ol">${esc(v.label)}</span><span class="oh">${esc(v.hint)}</span></span>
  </label>`).join('');

$('#opts').addEventListener('change', (e) => {
  sourceType = e.target.value;
  document.querySelectorAll('.opt').forEach((o) => o.classList.toggle('sel', o.dataset.id === sourceType));
  paintSnippets();
});

/* ---------- visible labels + JSON-LD ---------- */
const paintSnippets = () => {
  $('#labels').innerHTML = Object.entries(VISIBLE_LABELS)
    .map(([lang, text]) => `<div class="langrow"><code>${lang}</code><span>${esc(text)}</span></div>`).join('');

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    contentUrl: 'https://example.com/your-image.jpg',
    creditText: VISIBLE_LABELS.en,
    'https://iptc.org/std/Iptc4xmpExt/2008-02-29/DigitalSourceType':
      `http://cv.iptc.org/newscodes/digitalsourcetype/${sourceType}`,
  };
  $('#jsonld').textContent = `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n<\/script>`;
};
paintSnippets();

$('#copy-ld').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#jsonld').textContent);
  $('#copy-ld').textContent = 'Copied';
  setTimeout(() => ($('#copy-ld').textContent = 'Copy JSON-LD'), 1800);
});

/* ---------- file intake ---------- */
const accept = async (file) => {
  if (!file) return;
  if (!/image\/(png|jpeg)/.test(file.type)) {
    $('#out').innerHTML = note('check-required', 'That format cannot be marked here',
      'Only PNG and JPEG carry XMP the way this tool writes it. WebP, MP4 and audio need C2PA tooling.');
    return;
  }
  const buffer = await file.arrayBuffer();
  picked = { buffer, name: file.name, type: file.type };
  const existing = readSourceType(buffer);
  $('#go').disabled = false;
  $('#drop').querySelector('.t').textContent = file.name;
  $('#drop').querySelector('.s').textContent = `${(file.size / 1024).toFixed(0)} KB · ready to mark`;
  $('#out').innerHTML = existing
    ? note('likely-ok', 'This file is already marked',
        `It declares <code>${esc(existing)}</code>. Marking again will add a second assertion — only do that if the first one is wrong.`)
    : note('check-required', 'No provenance marking found',
        'This file carries no IPTC <code>digitalSourceType</code>. If it is AI-generated and you publish it to people in the EU, Article 50(2) wants that marking present.');
};

$('#drop').addEventListener('click', () => $('#file').click());
$('#drop').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file').click(); } });
$('#file').addEventListener('change', (e) => accept(e.target.files[0]));
['dragenter', 'dragover'].forEach((ev) => $('#drop').addEventListener(ev, (e) => { e.preventDefault(); $('#drop').classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => $('#drop').addEventListener(ev, (e) => { e.preventDefault(); $('#drop').classList.remove('over'); }));
$('#drop').addEventListener('drop', (e) => accept(e.dataTransfer.files[0]));

/* ---------- mark + download ---------- */
$('#go').addEventListener('click', () => {
  if (!picked) return;
  try {
    const tool = $('#tool').value.trim();
    const { bytes, format } = markImage(picked.buffer, { sourceType, creatorTool: tool });
    const blob = new Blob([bytes], { type: format === 'png' ? 'image/png' : 'image/jpeg' });
    const href = URL.createObjectURL(blob);
    const base = picked.name.replace(/\.(png|jpe?g)$/i, '');
    const a = Object.assign(document.createElement('a'), { href, download: `${base}-labelled.${format === 'png' ? 'png' : 'jpg'}` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);

    const verify = readSourceType(bytes.buffer);
    $('#out').innerHTML = note('likely-ok', 'Marked and downloaded',
      `Written and read back as <code>${esc(verify)}</code>${tool ? `, tool recorded as <code>${esc(tool)}</code>` : ''}. `
      + `The image itself is byte-identical — only metadata was added. Publish this file rather than the original.`)
      + `<details style="margin-top:12px"><summary>See the XMP packet that was embedded</summary>`
      + `<div class="body"><pre class="snip">${esc(buildXmp({ sourceType, creatorTool: tool }))}</pre></div></details>`;
  } catch (err) {
    $('#out').innerHTML = note('check-required', 'Could not mark that file', esc(err.message));
  }
});
