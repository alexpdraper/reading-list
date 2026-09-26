import test from 'node:test';
import assert from 'node:assert/strict';

import { installMockChrome, dumpSync, getWriteCounts, resetWriteCounts } from './mock-chrome.mjs';
import { loadFreshRl } from './helpers/fresh-module.mjs';
import { RL_URL } from './lib-paths.mjs';
import { makeSyntheticItems } from './helpers/items.mjs';

async function freshEmptyRl() {
  installMockChrome();
  const rl = await loadFreshRl(RL_URL);
  await rl.getListItems();
  return rl;
}

async function reloadAndGetItems() {
  const rl = await loadFreshRl(RL_URL);
  return rl.getListItems();
}

test('addReadingItem (current behavior): exactly one set() call, and a fresh reload sees the new item', async () => {
  const rl = await freshEmptyRl();
  resetWriteCounts();

  const added = await rl.addReadingItem({
    addedAt: 1_700_000_000_000,
    title: 'A single add',
    url: 'https://example.test/single-add',
  });

  assert.deepEqual(getWriteCounts(), { set: 1, remove: 0 });
  assert.equal(added.url, 'https://example.test/single-add');

  const reloaded = await reloadAndGetItems();
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].url, 'https://example.test/single-add');
});

test('removeReadingItem (current behavior): removing the only item in its bucket calls remove(), not set()', async () => {
  const rl = await freshEmptyRl();
  await rl.addReadingItem({ addedAt: 1, title: 'to remove', url: 'https://example.test/to-remove' });

  resetWriteCounts();
  const removed = await rl.removeReadingItem('https://example.test/to-remove');
  assert.equal(removed, true);
  assert.deepEqual(getWriteCounts(), { set: 0, remove: 1 });

  const reloaded = await reloadAndGetItems();
  assert.equal(reloaded.length, 0);
});

test('updateReadingItem (current behavior): a genuine no-op update makes zero writes', async () => {
  const rl = await freshEmptyRl();
  await rl.addReadingItem({ addedAt: 1, title: 'viewed test', url: 'https://example.test/viewed', viewed: true });

  resetWriteCounts();
  await rl.updateReadingItem('https://example.test/viewed', { viewed: true });
  assert.deepEqual(getWriteCounts(), { set: 0, remove: 0 });
});

test('updateReadingItem (current behavior): a real change makes exactly one set() call and a fresh reload sees it', async () => {
  const rl = await freshEmptyRl();
  await rl.addReadingItem({ addedAt: 1, title: 'before', url: 'https://example.test/update-me', viewed: false });

  resetWriteCounts();
  await rl.updateReadingItem('https://example.test/update-me', { title: 'after', viewed: true });
  assert.deepEqual(getWriteCounts(), { set: 1, remove: 0 });

  const reloaded = await reloadAndGetItems();
  assert.equal(reloaded[0].title, 'after');
  assert.equal(reloaded[0].viewed, true);
});

test('reorderItems (current behavior): exactly one set() call regardless of how many buckets are touched', async () => {
  const rl = await freshEmptyRl();
  const items = makeSyntheticItems(10, { baseTimestamp: 1_700_000_000_000 });
  await rl.bulkAddReadingItems(items);

  resetWriteCounts();
  const urls = items.map((i) => i.url).reverse();
  const ok = await rl.reorderItems(urls);
  assert.equal(ok, true);
  assert.deepEqual(getWriteCounts(), { set: 1, remove: 0 });

  const reloaded = await reloadAndGetItems();
  const reloadedUrlsByIndex = [...reloaded].sort((a, b) => a.index - b.index).map((i) => i.url);
  assert.deepEqual(reloadedUrlsByIndex, urls);
});

test('bulkAddReadingItems (current behavior): 100 items import in ceil(100/25) = 4 set() calls', async () => {
  const rl = await freshEmptyRl();
  resetWriteCounts();

  const items = makeSyntheticItems(100, { baseTimestamp: 1_700_000_000_000 });
  const result = await rl.bulkAddReadingItems(items);

  assert.equal(result.succeeded, 100);
  assert.equal(result.failed, 0);
  assert.deepEqual(getWriteCounts(), { set: 4, remove: 0 });

  const reloaded = await reloadAndGetItems();
  assert.equal(reloaded.length, 100);
});

test('clearAll (current behavior): clears storage and the in-memory cache together', async () => {
  const rl = await freshEmptyRl();
  await rl.bulkAddReadingItems(makeSyntheticItems(5, { baseTimestamp: 1_700_000_000_000 }));

  await rl.clearAll();
  assert.deepEqual(await rl.getListItems(), []);
  assert.deepEqual(dumpSync(), {});

  const reloaded = await reloadAndGetItems();
  assert.deepEqual(reloaded, []);
});
