import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../study/outreach-drafts.jsonl", import.meta.url);

const NOTE = `Worth knowing: Gorgias's built-in per-message "Automated" tag helps, but Article 50(1) asks for clear disclosure no later than the first interaction — an explicit opening line is the safe pattern.`;

// Ruled edge cases: these lines have a "mode-confirmation" sentence that does
// not match the general rule ("only you" + "console"/"confirm"), so the note
// is inserted right after these exact sentences.
const SPECIAL_AFTER = {
  "fitjeans.com": "You can confirm whether it is.",
  "kamerastore.com": "We can't see whether that mode is enabled; only you can.",
};

// Split into sentences, keeping exact start/end offsets. A sentence ends at a
// [.!?] that is followed by whitespace or end-of-string (so URLs, "50(1)",
// "€49", etc. are never split).
function getSentences(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++;
    if (i >= n) break;
    const start = i;
    const re = /[.!?](?=\s|$)/g;
    re.lastIndex = i;
    const m = re.exec(text);
    const end = m ? m.index + 1 : n;
    out.push({ start, end, text: text.slice(start, end) });
    i = end;
  }
  return out;
}

// Returns { index, insert } describing what to splice at `index`.
function insertion(text, id) {
  const sentences = getSentences(text);

  // 1) first sentence containing "only you" (ci) AND ("console" OR "confirm")
  for (const s of sentences) {
    if (/only you/i.test(s.text) && (/console/i.test(s.text) || /confirm/i.test(s.text))) {
      return { index: s.end, insert: " " + NOTE };
    }
  }

  // 2) ruled edge cases: insert right after the exact confirmation sentence
  if (SPECIAL_AFTER[id]) {
    for (const s of sentences) {
      if (s.text === SPECIAL_AFTER[id]) {
        return { index: s.end, insert: " " + NOTE };
      }
    }
  }

  // 3) fallback: insert before the sentence starting "Our free scanner"
  for (const s of sentences) {
    if (s.text.startsWith("Our free scanner")) {
      return { index: s.start, insert: NOTE + " " };
    }
  }

  return null;
}

const lines = readFileSync(FILE, "utf8").split("\n");

let matched = 0;
let modified = 0;
let example = null;

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  if (raw.length === 0) continue;

  const obj = JSON.parse(raw);

  // Only lines whose text mentions "Gorgias" (case-sensitive).
  if (!obj.text.includes("Gorgias")) continue;
  matched++;

  // Idempotent: skip lines already containing the note.
  if (obj.text.includes("per-message")) continue;

  const where = insertion(obj.text, obj.id);
  if (!where) {
    console.error(`WARN: no insertion point found for ${obj.id} (skipped)`);
    continue;
  }

  obj.text = obj.text.slice(0, where.index) + where.insert + obj.text.slice(where.index);
  lines[i] = JSON.stringify(obj);
  modified++;

  if (!example) example = { id: obj.id, text: obj.text };
}

writeFileSync(FILE, lines.join("\n"));

console.log(`matched (mentions "Gorgias"): ${matched}`);
console.log(`modified: ${modified}`);

if (example) {
  const sents = getSentences(example.text);
  for (let k = 0; k < sents.length; k++) {
    if (sents[k].text.includes("per-message")) {
      const prev = k > 0 ? sents[k - 1].text : "";
      const next = k < sents.length - 1 ? sents[k + 1].text : "";
      console.log(`\nexample (${example.id}):`);
      console.log(`${prev} ${sents[k].text} ${next}`);
      break;
    }
  }
}
