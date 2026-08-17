import { readFileSync, writeFileSync } from 'node:fs';

const FILE =
  process.argv[2] ??
  '/Users/jonjon/Code/Auto Something/clearlabel/study/outreach-drafts.jsonl';

// Match the bare homepage URL only. The negative lookahead skips:
//   - '?'  -> already tagged (idempotency)
//   - '/'  -> a different path (e.g. https://clearlabel.eu/label/)
const BARE_URL = new RegExp('https://clearlabel\\.eu(?![?/])', 'g');

const raw = readFileSync(FILE, 'utf8');

const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);

const out = lines.map((line) => {
  const obj = JSON.parse(line);
  const domain = obj.id;
  const tagged =
    'https://clearlabel.eu/?utm_source=outreach&utm_medium=email&utm_campaign=aug17&utm_content=' +
    domain;
  obj.text = obj.text.replace(BARE_URL, () => tagged);
  return JSON.stringify(obj);
});

writeFileSync(FILE, out.join('\n') + '\n', 'utf8');

console.log(`Transformed ${out.length} lines in ${FILE}`);
