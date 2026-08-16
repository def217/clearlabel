/**
 * Writes IPTC digitalSourceType provenance into image files, in the browser.
 * Article 50(2) requires AI-generated output to be marked in a machine-readable
 * format; a visible caption alone does not satisfy it.
 *
 * Supports the two formats a marketing team actually ships: PNG (iTXt chunk)
 * and JPEG (APP1 XMP segment). No dependencies, no upload - the bytes never
 * leave the page.
 */

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** IPTC NewsCodes digitalSourceType vocabulary. */
export const SOURCE_TYPES = Object.freeze({
  trainedAlgorithmicMedia: {
    label: 'Fully AI-generated',
    hint: 'Created entirely by a generative model, e.g. Midjourney, DALL-E, Sora.',
  },
  compositeWithTrainedAlgorithmicMedia: {
    label: 'Partly AI-generated',
    hint: 'A real photo or recording with AI-generated elements composited in, or AI-extended.',
  },
  algorithmicallyEnhanced: {
    label: 'AI-enhanced only',
    hint: 'A real capture improved by AI tools (upscaling, denoise, generative fill on minor areas).',
  },
  digitalCapture: {
    label: 'Not AI — straight capture',
    hint: 'Camera or microphone original. Marking this asserts no AI generation.',
  },
});

const IPTC_NS = 'http://iptc.org/std/Iptc4xmpExt/2008-02-29/';
const CV = 'http://cv.iptc.org/newscodes/digitalsourcetype/';

export const buildXmp = ({ sourceType, creatorTool = '', rightsNote = '' }) => `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="ClearLabel">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:Iptc4xmpExt="${IPTC_NS}"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/">
   <Iptc4xmpExt:DigitalSourceType rdf:resource="${CV}${sourceType}"/>${
     creatorTool ? `\n   <xmp:CreatorTool>${creatorTool.replace(/[<&]/g, '')}</xmp:CreatorTool>` : ''
   }${
     rightsNote ? `\n   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${rightsNote.replace(/[<&]/g, '')}</rdf:li></rdf:Alt></dc:rights>` : ''
   }
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

const u32be = (v) => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
const concat = (parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  parts.reduce((offset, p) => (out.set(p, offset), offset + p.length), 0);
  return out;
};

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (b) => PNG_SIG.every((v, i) => b[i] === v);
const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8;

/** PNG: insert an iTXt chunk carrying the XMP packet, immediately after IHDR. */
const writePng = (bytes, xmp) => {
  const enc = new TextEncoder();
  const keyword = enc.encode('XML:com.adobe.xmp');
  const payload = enc.encode(xmp);
  // keyword \0 compressionFlag compressionMethod languageTag \0 translatedKeyword \0 text
  const data = concat([keyword, new Uint8Array([0, 0, 0, 0, 0]), payload]);
  const type = enc.encode('iTXt');
  const chunk = concat([u32be(data.length), type, data, u32be(crc32(concat([type, data])))]);

  // IHDR is always the first chunk: 8 sig + 4 len + 4 type + 13 data + 4 crc = 33
  const insertAt = 33;
  return concat([bytes.slice(0, insertAt), chunk, bytes.slice(insertAt)]);
};

/** JPEG: insert an APP1 segment with the standard XMP namespace header. */
const writeJpeg = (bytes, xmp) => {
  const enc = new TextEncoder();
  const header = enc.encode('http://ns.adobe.com/xap/1.0/\0');
  const payload = enc.encode(xmp);
  const len = header.length + payload.length + 2;
  if (len > 0xffff) throw new Error('metadata too large for a single JPEG APP1 segment');
  const segment = concat([
    new Uint8Array([0xff, 0xe1, (len >> 8) & 255, len & 255]),
    header,
    payload,
  ]);
  // Straight after SOI, before any existing APP segments.
  return concat([bytes.slice(0, 2), segment, bytes.slice(2)]);
};

/**
 * @returns {{bytes: Uint8Array, format: 'png'|'jpeg'}}
 * @throws if the format is not one we can mark
 */
export const markImage = (buffer, options) => {
  const bytes = new Uint8Array(buffer);
  const xmp = buildXmp(options);
  if (isPng(bytes)) return { bytes: writePng(bytes, xmp), format: 'png' };
  if (isJpeg(bytes)) return { bytes: writeJpeg(bytes, xmp), format: 'jpeg' };
  throw new Error('Only PNG and JPEG can be marked here. WebP, MP4 and audio need C2PA tooling.');
};

/** Read back the marking so the tool can prove it worked. */
export const readSourceType = (buffer) => {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer).slice(0, 200000));
  const m = text.match(/digitalsourcetype\/([A-Za-z]+)/);
  return m ? m[1] : null;
};
