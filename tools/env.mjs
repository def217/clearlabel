/**
 * Shared .env loader for tools/ scripts.
 *
 * Reads <dir>/../.env and returns a {KEY: value} object. Each non-comment line
 * containing '=' is split on the first '=' and both key and value are trimmed.
 *
 * Unlike the old per-script copies of this logic, this version also strips
 * exactly one pair of surrounding quote characters ('"' or "'") from a trimmed
 * value when it starts and ends with the same quote and is at least 2 chars
 * long — so CF_ACCOUNT_ID="16f8..." loads as 16f8... rather than "16f8...".
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const loadEnv = async (dir) => {
  const body = await readFile(join(dir, '..', '.env'), 'utf8');
  return Object.fromEntries(
    body.split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => {
        const key = l.slice(0, l.indexOf('=')).trim();
        let value = l.slice(l.indexOf('=') + 1).trim();
        if (
          value.length >= 2
          && ((value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
};
