import test from 'node:test';
import assert from 'node:assert/strict';

import { installMockChrome, seedSync, seedLocal } from './mock-chrome.mjs';
import { DIAGNOSTICS_URL } from './lib-paths.mjs';
import { loadFixture } from './helpers/fixtures.mjs';

installMockChrome();
const { getStorageDiagnostics } = await import(DIAGNOSTICS_URL);

test('getStorageDiagnostics (current behavior): reports build, item/bucket counts, both byte estimates, and no load error', async () => {
  const fixture = loadFixture('v3.2-tier-25');
  installMockChrome();
  seedSync(fixture.sync);
  seedLocal(fixture.local);

  const report = await getStorageDiagnostics();
  const lines = report.split('\n');

  assert.equal(lines[0], 'Build: test');
  assert.equal(lines[1], `Items: ${fixture.meta.itemCount}`);
  assert.match(lines[2], /^Buckets used: \d+ \/ \d+$/);
  assert.match(lines[3], /^Bytes in use \(browser-reported\): \d+ \/ 102400$/);
  assert.match(lines[4], /^Bytes in use \(manual estimate\): \d+ \/ 102400$/);
  assert.match(lines[5], /^Largest bucket: b\d+ at \d+ bytes \/ 8192$/);
  assert.equal(lines[6], 'Last load error: none');
});

test('getStorageDiagnostics (current behavior): surfaces a previously saved load error', async () => {
  installMockChrome();
  seedSync({});
  seedLocal({
    lastLoadError: {
      name: 'Error',
      message: 'QuotaExceededError: storage.sync API call exceeded its quota limitations.',
      occurredAt: 1_700_000_000_000,
    },
  });

  const report = await getStorageDiagnostics();
  assert.match(
    report,
    /Last load error: Error: QuotaExceededError: storage\.sync API call exceeded its quota limitations\. \(at .+\)/,
  );
});

test('getStorageDiagnostics (current behavior): an empty store reports zero items with no largest bucket', async () => {
  installMockChrome();
  seedSync({});
  seedLocal({});

  const report = await getStorageDiagnostics();
  const lines = report.split('\n');
  assert.equal(lines[1], 'Items: 0');
  assert.match(lines[5], /^Largest bucket: n\/a at 0 bytes \/ 8192$/);
});
