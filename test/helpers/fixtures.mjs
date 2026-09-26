import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url));

export function loadFixture(name) {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf8');
  return JSON.parse(raw);
}

export const FIXTURE_NAMES = [
  'legacy-3.0.1-small',
  'legacy-3.0.1-with-settings',
  'legacy-v2-old-extension',
  'v3.1-40-buckets',
  'v3.2-tier-25',
  'v3.2-tier-30',
  'v3.2-tier-35',
  'v3.2-near-capacity',
];
