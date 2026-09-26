import test from 'node:test';
import assert from 'node:assert/strict';

import { installMockChrome, getSyncGetAllCallCount, resetSyncGetAllCallCount } from './mock-chrome.mjs';
import { loadFreshRl } from './helpers/fresh-module.mjs';
import { RL_URL, BUCKETS_URL } from './lib-paths.mjs';
import { makeSyntheticItems } from './helpers/items.mjs';

const { testOnlyInternals } = await import(BUCKETS_URL);
const { bucketKey, encodeBucket } = testOnlyInternals;

function waitForMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('onItemsChanged (current behavior): this context writing to storage notifies subscribers from memory, with no re-fetch from storage', async () => {
  installMockChrome();
  const rl = await loadFreshRl(RL_URL);
  await rl.getListItems();

  let calls = 0;
  rl.subscribe(() => calls++);
  resetSyncGetAllCallCount();

  await rl.addReadingItem({ addedAt: 1, title: 'own write', url: 'https://example.test/own-write' });
  await waitForMicrotasks();

  assert.equal(calls, 1, "a mutator's own successful write must still notify this context's own subscribers");
  assert.equal(
    getSyncGetAllCallCount(),
    0,
    "onItemsChanged must not treat this context's own write as a remote change and re-fetch from storage",
  );
});

test('onItemsChanged (current behavior): another context writing a bucket key triggers exactly one storage re-fetch and one notification', async () => {
  installMockChrome();
  const rl = await loadFreshRl(RL_URL);
  await rl.getListItems();

  let calls = 0;
  rl.subscribe(() => calls++);
  resetSyncGetAllCallCount();

  const foreignItem = { addedAt: 2, title: 'from another device', url: 'https://example.test/from-elsewhere' };
  const key = bucketKey(foreignItem.url, 25);
  await chrome.storage.sync.set({ [key]: encodeBucket([foreignItem]) });
  await waitForMicrotasks();

  assert.equal(calls, 1, "another context's write must trigger exactly one notification");
  assert.equal(getSyncGetAllCallCount(), 1, 'a genuinely foreign change must cause exactly one re-fetch from storage');
  const items = await rl.getListItems();
  assert.ok(items.some((item) => item.url === foreignItem.url), 'the reload must pick up the foreign write');
});

test('onItemsChanged (current behavior): a settings-only change (non-bucket key) triggers no reload', async () => {
  installMockChrome();
  const rl = await loadFreshRl(RL_URL);
  await rl.getListItems();

  let calls = 0;
  rl.subscribe(() => calls++);

  await chrome.storage.sync.set({ settings: { viewAll: false } });
  await waitForMicrotasks();

  assert.equal(calls, 0, 'a change to an unrelated key must not trigger a reading-list reload');
});

test('onItemsChanged (current behavior): clearAll notifies subscribers from memory, with no re-fetch from storage', async () => {
  installMockChrome();
  const rl = await loadFreshRl(RL_URL);
  await rl.bulkAddReadingItems(makeSyntheticItems(5, { baseTimestamp: 1_700_000_000_000 }));

  let calls = 0;
  rl.subscribe(() => calls++);
  resetSyncGetAllCallCount();

  await rl.clearAll();
  await waitForMicrotasks();

  assert.equal(calls, 1, "clearAll is this context's own write and must still notify its own subscribers");
  assert.equal(
    getSyncGetAllCallCount(),
    1,
    "the only get(null) must be clearItems's own pre-clear read (to mark every key as self-removed); onItemsChanged must not add a second, reload-triggered one",
  );
});
