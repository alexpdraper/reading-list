import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { installMockChrome, seedSync, dumpSync, dumpLocal } from '../mock-chrome.mjs';
import { RL_URL, MIGRATIONS_URL } from '../lib-paths.mjs';
import {
  LEGACY_301_SMALL_ITEMS,
  LEGACY_301_WITH_SETTINGS_ITEMS,
  LEGACY_301_SETTINGS,
  V31_40_BUCKETS_ITEMS,
  V32_TIER_25_ITEMS,
  V32_TIER_30_ITEMS,
  V32_TIER_35_ITEMS,
  V32_NEAR_CAPACITY_SOURCE_ITEMS,
  LEGACY_V2_ITEMS,
  LEGACY_V2_SETTINGS,
} from './definitions.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const FIXTURES_DIR = path.join(REPO_ROOT, 'test/fixtures');
const SCRATCH_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-fixture-worktrees-'));

const { readItemsReadOnly } = await import(MIGRATIONS_URL);

let freshCounter = 0;
async function importFresh(moduleUrl) {
  freshCounter += 1;
  return import(`${moduleUrl}?fixturegen=${freshCounter}`);
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

async function writeFixture(name) {
  const items = await readItemsReadOnly();
  const target = path.join(FIXTURES_DIR, `${name}.json`);
  const payload = { sync: dumpSync(), local: dumpLocal(), meta: { itemCount: items.length } };
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote ${path.relative(REPO_ROOT, target)} (${items.length} items)`);
}

async function withWorktree(commit, run_) {
  const dir = path.join(SCRATCH_ROOT, `wt-${commit}`);
  run('git', ['worktree', 'add', '--detach', dir, commit], { cwd: REPO_ROOT });
  try {
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    run('npx', ['tsc'], { cwd: dir });
    const rlUrl = pathToFileURL(path.join(dir, 'extension/scripts/lib/rl.js')).href;
    await run_(rlUrl);
  } finally {
    run('git', ['worktree', 'remove', '--force', dir], { cwd: REPO_ROOT });
  }
}

async function generateLegacy301() {
  await withWorktree('8753e9c', async (rlUrl) => {
    installMockChrome();
    const { rl } = await importFresh(rlUrl);
    await rl.getListItems();
    for (const item of LEGACY_301_SMALL_ITEMS) {
      await rl.addReadingItem(item);
    }
    await writeFixture('legacy-3.0.1-small');

    installMockChrome();
    const { rl: rl2 } = await importFresh(rlUrl);
    await rl2.getListItems();
    for (const item of LEGACY_301_WITH_SETTINGS_ITEMS) {
      await rl2.addReadingItem(item);
    }
    await chrome.storage.sync.set({ settings: LEGACY_301_SETTINGS });
    await writeFixture('legacy-3.0.1-with-settings');
  });
}

async function generateV31() {
  await withWorktree('3fb9527', async (rlUrl) => {
    installMockChrome();
    const { rl } = await importFresh(rlUrl);
    await rl.getListItems();
    const result = await rl.bulkAddReadingItems(V31_40_BUCKETS_ITEMS);
    if (result.failed !== 0) {
      throw new Error(`generateV31: expected all items to succeed, ${result.failed} failed`);
    }
    await writeFixture('v3.1-40-buckets');
  });
}

async function generateV32Tier(name, items) {
  installMockChrome();
  const { rl } = await importFresh(RL_URL);
  await rl.getListItems();
  const result = await rl.bulkAddReadingItems(items);
  if (result.failed !== 0) {
    throw new Error(`${name}: expected all ${items.length} items to succeed, ${result.failed} failed`);
  }
  await writeFixture(name);
}

async function generateV32NearCapacity() {
  installMockChrome();
  const { rl } = await importFresh(RL_URL);
  await rl.getListItems();
  const result = await rl.bulkAddReadingItems(V32_NEAR_CAPACITY_SOURCE_ITEMS);
  console.log(`v3.2-near-capacity: ${result.succeeded} succeeded, ${result.failed} failed`);
  await writeFixture('v3.2-near-capacity');
}

async function generateLegacyV2() {
  installMockChrome();
  const sync = {};
  for (const item of LEGACY_V2_ITEMS) sync[item.url] = item;
  sync.settings = LEGACY_V2_SETTINGS;
  seedSync(sync);
  await writeFixture('legacy-v2-old-extension');
}

async function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  run('npx', ['tsc'], { cwd: REPO_ROOT });
  try {
    await generateLegacy301();
    await generateV31();
    await generateV32Tier('v3.2-tier-25', V32_TIER_25_ITEMS);
    await generateV32Tier('v3.2-tier-30', V32_TIER_30_ITEMS);
    await generateV32Tier('v3.2-tier-35', V32_TIER_35_ITEMS);
    await generateV32NearCapacity();
    await generateLegacyV2();
  } finally {
    fs.rmSync(SCRATCH_ROOT, { recursive: true, force: true });
  }
}

await main();
