import test from 'node:test';
import assert from 'node:assert/strict';

import { installMockChrome, resetSyncRateLimit } from './mock-chrome.mjs';

test('mock chrome.storage.sync: enforces MAX_WRITE_OPERATIONS_PER_MINUTE and can be reset between tests', async () => {
  installMockChrome();

  for (let i = 0; i < chrome.storage.sync.MAX_WRITE_OPERATIONS_PER_MINUTE; i++) {
    await chrome.storage.sync.set({ [`k${i}`]: i });
  }

  await assert.rejects(() => chrome.storage.sync.set({ overLimit: true }), /MAX_WRITE_OPERATIONS_PER_MINUTE/);

  resetSyncRateLimit();
  await chrome.storage.sync.set({ afterReset: true });
  assert.equal((await chrome.storage.sync.get('afterReset')).afterReset, true);
});

test('mock chrome.storage.sync: a failing set() due to QUOTA_BYTES_PER_ITEM leaves the store untouched (atomic)', async () => {
  installMockChrome();
  await chrome.storage.sync.set({ existing: 'value' });

  const oversizedValue = 'x'.repeat(chrome.storage.sync.QUOTA_BYTES_PER_ITEM + 1);
  await assert.rejects(() => chrome.storage.sync.set({ tooBig: oversizedValue }), /QuotaExceededError/);

  const all = await chrome.storage.sync.get(null);
  assert.deepEqual(all, { existing: 'value' });
});

test('mock chrome.storage.sync: a failing set() due to total QUOTA_BYTES leaves the store untouched (atomic)', async () => {
  installMockChrome();
  const chunkValue = 'x'.repeat(8000);
  const chunks = {};
  for (let i = 0; i < 12; i++) chunks[`chunk${i}`] = chunkValue;
  await chrome.storage.sync.set(chunks);

  await assert.rejects(() => chrome.storage.sync.set({ z: 'y'.repeat(8000) }), /QuotaExceededError/);

  const all = await chrome.storage.sync.get(null);
  assert.deepEqual(all, chunks);
});

test('mock chrome.storage.local: a separate store from sync, with no quota enforcement', async () => {
  installMockChrome();
  const bigValue = 'x'.repeat(chrome.storage.sync.QUOTA_BYTES * 2);
  await chrome.storage.local.set({ big: bigValue });
  assert.equal((await chrome.storage.local.get('big')).big, bigValue);
  assert.deepEqual(await chrome.storage.sync.get(null), {});
});

test('mock chrome.storage.onChanged: fires with Chrome-shaped {oldValue,newValue} on set/remove/clear', async () => {
  installMockChrome();
  const events = [];
  const listener = (changes, areaName) => events.push({ changes, areaName });
  chrome.storage.onChanged.addListener(listener);

  await chrome.storage.sync.set({ a: 1 });
  await chrome.storage.sync.set({ a: 2 });
  await chrome.storage.sync.remove('a');

  assert.deepEqual(events[0], { changes: { a: { newValue: 1 } }, areaName: 'sync' });
  assert.deepEqual(events[1], { changes: { a: { oldValue: 1, newValue: 2 } }, areaName: 'sync' });
  assert.deepEqual(events[2], { changes: { a: { oldValue: 2 } }, areaName: 'sync' });

  chrome.storage.onChanged.removeListener(listener);
  await chrome.storage.sync.set({ b: 1 });
  assert.equal(events.length, 3, 'a removed listener must not keep receiving events');
});
