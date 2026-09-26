import test from 'node:test';
import assert from 'node:assert/strict';

import { installMockChrome } from './mock-chrome.mjs';
import { loadFreshRl } from './helpers/fresh-module.mjs';
import { RL_URL } from './lib-paths.mjs';
import { loadFixture } from './helpers/fixtures.mjs';
import * as definitions from './fixtures/definitions.mjs';

async function freshEmptyRl() {
  installMockChrome();
  const rl = await loadFreshRl(RL_URL);
  await rl.getListItems();
  return rl;
}

test('bulkAddReadingItems (current behavior): import stops at the first batch that would exceed quota', async () => {
  const rl = await freshEmptyRl();
  const result = await rl.bulkAddReadingItems(definitions.V32_NEAR_CAPACITY_SOURCE_ITEMS);

  const fixture = loadFixture('v3.2-near-capacity');
  assert.equal(result.succeeded, fixture.meta.itemCount, 'this reproduces the committed near-capacity fixture exactly');
  assert.equal(result.failed, definitions.V32_NEAR_CAPACITY_SOURCE_ITEMS.length - fixture.meta.itemCount);
  assert.ok(result.firstError, 'a failing import must surface the error that stopped it');
  assert.ok(result.diagnostics.length > 0, 'a failing import must surface batch-level diagnostics');
  assert.match(result.diagnostics, /QuotaExceededError/);
});

test('addReadingItem (current behavior): a data: favicon is stripped before storing', async () => {
  const rl = await freshEmptyRl();
  const added = await rl.addReadingItem({
    addedAt: 1,
    title: 'has a data favicon',
    url: 'https://example.test/data-favicon',
    favIconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
  });

  assert.equal(added.favIconUrl, undefined);

  const reloaded = await loadFreshRl(RL_URL);
  const items = await reloaded.getListItems();
  assert.equal(items[0].favIconUrl, undefined);
});

test('addReadingItem (current behavior): a non-http(s) URL is scheme rejected', async () => {
  const rl = await freshEmptyRl();
  await assert.rejects(
    () => rl.addReadingItem({ addedAt: 1, title: 'bad scheme', url: 'chrome://extensions' }),
    /Unsupported URL scheme/,
  );
});

test('addReadingItem (current behavior): a regular http favicon is kept as-is', async () => {
  const rl = await freshEmptyRl();
  const added = await rl.addReadingItem({
    addedAt: 1,
    title: 'has a normal favicon',
    url: 'https://example.test/normal-favicon',
    favIconUrl: 'https://example.test/favicon.ico',
  });

  assert.equal(added.favIconUrl, 'https://example.test/favicon.ico');
});
