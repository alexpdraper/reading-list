import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { installMockChrome, seedSync, seedLocal, dumpSync, dumpLocal, getWriteCounts, resetWriteCounts } from './mock-chrome.mjs';
import { loadFreshRl } from './helpers/fresh-module.mjs';
import { RL_URL, MIGRATIONS_URL } from './lib-paths.mjs';
import { loadFixture, FIXTURE_NAMES } from './helpers/fixtures.mjs';
import { snapshotSyncLayout } from './helpers/bucket-layout.mjs';
import * as definitions from './fixtures/definitions.mjs';

const { getItemsReadOnly } = await import(MIGRATIONS_URL);

const LOADABLE_FIXTURE_NAMES = FIXTURE_NAMES.filter((name) => name !== 'v3.2-near-capacity');

const UPDATE_SNAPSHOTS = process.env.RL_UPDATE_SNAPSHOTS === '1';
const EXPECTED_DIR = new URL('./expected/', import.meta.url);

function expectedSnapshotPath(name) {
  return new URL(`${name}.json`, EXPECTED_DIR);
}

function compareOrWriteSnapshot(name, actual) {
  const filePath = expectedSnapshotPath(name);
  if (UPDATE_SNAPSHOTS) {
    fs.writeFileSync(filePath, `${JSON.stringify(actual, null, 2)}\n`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(actual, expected, `${name}: storage layout snapshot changed`);
}

function sortByUrl(items) {
  return [...items].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
}

function stripIndex(items) {
  return items.map(({ index, ...rest }) => rest);
}

async function loadFixtureIntoFreshRl(name) {
  const fixture = loadFixture(name);
  installMockChrome();
  seedSync(fixture.sync);
  seedLocal(fixture.local);
  const rl = await loadFreshRl(RL_URL);
  const items = await rl.getListItems();
  return { fixture, items };
}

const EXPECTED_SOURCE_ITEMS = {
  'legacy-3.0.1-small': { items: definitions.LEGACY_301_SMALL_ITEMS, ignoreIndex: false },
  'legacy-3.0.1-with-settings': { items: definitions.LEGACY_301_WITH_SETTINGS_ITEMS, ignoreIndex: false },
  'legacy-v2-old-extension': { items: definitions.LEGACY_V2_ITEMS, ignoreIndex: false },
  'v3.1-40-buckets': { items: definitions.V31_40_BUCKETS_ITEMS, ignoreIndex: true },
  'v3.2-tier-25': { items: definitions.V32_TIER_25_ITEMS, ignoreIndex: true },
  'v3.2-tier-30': { items: definitions.V32_TIER_30_ITEMS, ignoreIndex: true },
  'v3.2-tier-35': { items: definitions.V32_TIER_35_ITEMS, ignoreIndex: true },
};

for (const name of LOADABLE_FIXTURE_NAMES) {
  test(`${name} (current behavior): getListItems returns every seeded item with every field intact`, async () => {
    const { fixture, items } = await loadFixtureIntoFreshRl(name);
    assert.equal(items.length, fixture.meta.itemCount);

    const expectedOrder = [...items].sort((a, b) => b.addedAt - a.addedAt).map((i) => i.url);
    assert.deepEqual(items.map((i) => i.url), expectedOrder, 'items must be sorted by addedAt descending');

    const spec = EXPECTED_SOURCE_ITEMS[name];
    if (!spec) return;
    const expectedSorted = sortByUrl(spec.ignoreIndex ? stripIndex(spec.items) : spec.items);
    const actualSorted = sortByUrl(spec.ignoreIndex ? stripIndex(items) : items);
    assert.deepEqual(actualSorted, expectedSorted);
  });
}

for (const name of LOADABLE_FIXTURE_NAMES) {
  test(`${name} (current behavior): resulting storage key layout matches the recorded snapshot`, async () => {
    const fixture = loadFixture(name);
    installMockChrome();
    seedSync(fixture.sync);
    seedLocal(fixture.local);
    const rl = await loadFreshRl(RL_URL);
    await rl.getListItems();
    const layout = snapshotSyncLayout(dumpSync());
    compareOrWriteSnapshot(`layout-${name}`, layout);
  });
}

for (const name of LOADABLE_FIXTURE_NAMES) {
  test(`${name} (current behavior): a second getListItems() in a fresh module instance performs zero writes`, async () => {
    const fixture = loadFixture(name);
    installMockChrome();
    seedSync(fixture.sync);
    seedLocal(fixture.local);

    const rl1 = await loadFreshRl(RL_URL);
    await rl1.getListItems();

    resetWriteCounts();
    const rl2 = await loadFreshRl(RL_URL);
    await rl2.getListItems();

    assert.deepEqual(getWriteCounts(), { set: 0, remove: 0 });
  });
}

test('v3.2-near-capacity (current behavior, bug): crossing a bucket-count tier on reload forces a rebalance that no longer fits, permanently exhausting the ladder', async () => {
  const fixture = loadFixture('v3.2-near-capacity');
  assert.equal(fixture.sync.__bv, 25, 'fixture must be pinned at the smaller tier this bug depends on');

  installMockChrome();
  seedSync(fixture.sync);
  seedLocal(fixture.local);

  const rl = await loadFreshRl(RL_URL);
  await assert.rejects(
    () => rl.getListItems(),
    /QuotaExceededError/,
    'rebalancing 850 items from 25 buckets up to the naturally-computed 35 costs more bytes than it saves and exceeds QUOTA_BYTES at every rung from 30 up',
  );

  const local = dumpLocal();
  assert.ok(local.lastLoadError, 'the failure must be recorded to local so Storage Diagnostics can report it');
  assert.match(local.lastLoadError.message, /QuotaExceededError/);

  installMockChrome();
  seedSync(fixture.sync);
  seedLocal(fixture.local);
  const readOnlyItems = await getItemsReadOnly();
  assert.equal(readOnlyItems.length, fixture.meta.itemCount, 'no data is lost: the original 25-bucket layout was never touched');
});
