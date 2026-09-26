import test from 'node:test';
import assert from 'node:assert/strict';

import {
  installMockChrome,
  seedSync,
  seedLocal,
  dumpSync,
  dumpLocal,
  getWriteCounts,
  resetWriteCounts,
  setSyncFailurePredicate,
  clearSyncFailurePredicate,
  setLocalFailurePredicate,
  clearLocalFailurePredicate,
} from './mock-chrome.mjs';
import { loadFreshRl } from './helpers/fresh-module.mjs';
import { RL_URL, MIGRATIONS_URL } from './lib-paths.mjs';
import { loadFixture } from './helpers/fixtures.mjs';
import { findOverflowingBucket } from './helpers/collision.mjs';

function makeFillerLegacyItems(count, baseTimestamp) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      addedAt: baseTimestamp - i * 60_000,
      title: `Filler legacy bookmark ${i}: a roundup worth revisiting`,
      url: `https://filler-legacy.example.test/reads/${String(i).padStart(4, '0')}?ref=migration-fixture&batch=${i % 4}`,
    });
  }
  return items;
}

const { readItemsReadOnly } = await import(MIGRATIONS_URL);

function sortedUrls(items) {
  return items.map((i) => i.url).sort();
}

test('legacy migration (current behavior): backs up to storage.local, removes legacy keys, and leaves settings untouched', async () => {
  const fixture = loadFixture('legacy-3.0.1-with-settings');
  installMockChrome();
  seedSync(fixture.sync);
  seedLocal(fixture.local);

  const originalSettings = fixture.sync.settings;
  const legacyUrls = Object.keys(fixture.sync).filter((k) => /^https?:\/\//i.test(k));

  const rl = await loadFreshRl(RL_URL);
  const items = await rl.getListItems();
  assert.equal(items.length, legacyUrls.length);

  const local = dumpLocal();
  assert.ok(local.legacyBackup, 'a local backup must exist after migrating legacy data');
  assert.deepEqual(sortedUrls(local.legacyBackup.items), legacyUrls.sort());

  const sync = dumpSync();
  for (const url of legacyUrls) {
    assert.ok(!(url in sync), `legacy key ${url} must be removed after migration`);
  }
  assert.deepEqual(sync.settings, originalSettings, 'settings must be left completely untouched');
});

test('legacy migration (current behavior): if the local backup write fails, migration is skipped and sync is left untouched', async () => {
  const fixture = loadFixture('legacy-3.0.1-small');
  installMockChrome();
  seedSync(fixture.sync);
  seedLocal(fixture.local);
  setLocalFailurePredicate(() => new Error('simulated local.storage failure'));

  const rl = await loadFreshRl(RL_URL);
  await assert.rejects(() => rl.getListItems(), /couldn't save a safety backup first/);

  clearLocalFailurePredicate();
  assert.deepEqual(dumpSync(), fixture.sync, 'sync storage must be untouched when the backup write fails');
});

test('partly failed migration (current behavior): a real per-bucket overflow at the starting bucket count is recovered by escalating the ladder', async () => {
  const overflow = findOverflowingBucket(25);
  const filler = makeFillerLegacyItems(20, 1_730_000_000_000);

  const legacyItems = [...overflow.items, ...filler];
  assert.ok(legacyItems.length <= 150, 'total legacy item count must stay in the 25-bucket starting tier');

  const sync = {};
  for (const item of legacyItems) sync[item.url] = item;

  installMockChrome();
  seedSync(sync);
  seedLocal({});
  resetWriteCounts();

  const rl = await loadFreshRl(RL_URL);
  const items = await rl.getListItems();

  assert.equal(items.length, legacyItems.length, 'no item is lost across the escalation retries');
  assert.deepEqual(sortedUrls(items), sortedUrls(legacyItems));

  const counts = getWriteCounts();
  assert.ok(counts.set > 2, `expected more than one real write attempt across the ladder, got ${counts.set}`);

  const finalSync = dumpSync();
  for (const item of legacyItems) {
    assert.ok(!(item.url in finalSync), 'every legacy key must be gone once migration finishes');
  }
  assert.equal(finalSync.__bv, 30, 'this fixture is engineered to overflow at 25 and recover at the next rung, 30');

  for (let reload = 0; reload < 3; reload++) {
    resetWriteCounts();
    const reloaded = await loadFreshRl(RL_URL);
    const reloadedItems = await reloaded.getListItems();
    assert.deepEqual(
      getWriteCounts(),
      { set: 1, remove: 0 },
      'current behavior (bug, see "Bugs found"): bucketCountForItemCount(138) is 25 forever, ' +
        'so every load re-attempts a rebalance down from the escalated 30, fails the same real ' +
        'collision, and re-escalates back to 30 - this never settles into a true no-op reload',
    );
    assert.equal(reloadedItems.length, legacyItems.length, 'the repeated rebalance still loses no data');
    assert.equal(dumpSync().__bv, 30);
  }
});

test('ladder exhausted (current behavior): getListItems rejects, lastLoadError is saved, and readItemsReadOnly still returns every item', async () => {
  const fixture = loadFixture('v3.2-tier-25');
  installMockChrome();
  const staleVersionSync = { ...fixture.sync, __bv: 999 };
  seedSync(staleVersionSync);
  seedLocal(fixture.local);
  setSyncFailurePredicate((kind) => (kind === 'set' ? new Error('QuotaExceededError: storage.sync API call exceeded its quota limitations.') : null));

  const rl = await loadFreshRl(RL_URL);
  await assert.rejects(() => rl.getListItems(), /QuotaExceededError/);

  const local = dumpLocal();
  assert.ok(local.lastLoadError);
  assert.match(local.lastLoadError.message, /QuotaExceededError/);

  clearSyncFailurePredicate();
  const readOnlyItems = await readItemsReadOnly();
  assert.equal(readOnlyItems.length, fixture.meta.itemCount, 'readItemsReadOnly bypasses rebalancing and never fails the way getListItems can');
});
