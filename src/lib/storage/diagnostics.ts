import {
  bucketCountForItemCount,
  BUCKET_KEY_RE,
  decodeBucket,
  LEGACY_KEY_RE,
  utf8ByteLength,
} from './buckets.js';
import { BUILD_TAG } from '../build-info.js';
import { getLoadError, getLocalBackup, getMigrationLog } from './local-backup.js';

const iso = (ms: number) => new Date(ms).toISOString();

// Everything reported here is a count, size, key name pattern or timestamp -
// never a URL or title - so users can paste it into a bug report without
// exposing what's on their list.

export async function getStorageDiagnostics(): Promise<string> {
  const all = await chrome.storage.sync.get(null);

  let bucketCount = 0;
  let itemCount = 0;
  let largestBucketBytes = 0;
  let largestBucketKey = '';
  let manualBytes = 0;
  let legacyCount = 0;
  let legacyBytes = 0;
  let largestLegacyBytes = 0;
  const otherKeys: string[] = [];

  for (const key in all) {
    const raw = all[key];
    const rawLen = utf8ByteLength(typeof raw === 'string' ? raw : JSON.stringify(raw));
    manualBytes += key.length + rawLen;
    if (LEGACY_KEY_RE.test(key)) {
      const bytes = utf8ByteLength(key) + rawLen;
      legacyCount++;
      legacyBytes += bytes;
      largestLegacyBytes = Math.max(largestLegacyBytes, bytes);
      continue;
    }
    if (!BUCKET_KEY_RE.test(key)) {
      otherKeys.push(key);
      continue;
    }
    bucketCount++;
    const bytes = key.length + rawLen;
    if (bytes > largestBucketBytes) {
      largestBucketBytes = bytes;
      largestBucketKey = key;
    }
    itemCount += decodeBucket(raw).length;
  }

  let bytesInUse: number | string = 'unavailable';
  try {
    bytesInUse = await chrome.storage.sync.getBytesInUse(null);
  } catch {
    // not supported by this browser build; manual estimate below still applies
  }

  const quotaBytes = chrome.storage.sync.QUOTA_BYTES ?? 102400;
  const quotaBytesPerItem = chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8192;

  // Firefox enforces QUOTA_BYTES against the whole object serialized as one
  // JSON string, which is larger than getBytesInUse() by ~4 bytes per key.
  const serializedBytes = utf8ByteLength(JSON.stringify(all));
  const keyCount = Object.keys(all).length;

  const loadError = await getLoadError();
  const migration = await getMigrationLog();
  const backup = await getLocalBackup();
  const targetBucketCount = bucketCountForItemCount(itemCount);

  return [
    `Build: ${BUILD_TAG}`,
    `Items: ${itemCount}`,
    `Buckets used: ${bucketCount} / ${targetBucketCount}`,
    `Bytes in use (browser-reported): ${bytesInUse} / ${quotaBytes}`,
    `Bytes in use (manual estimate): ${manualBytes} / ${quotaBytes}`,
    `Bytes in use (serialized, Firefox's enforced number): ${serializedBytes} / ${quotaBytes}`,
    `Keys: ${keyCount} / 512 (other than buckets/legacy: ${otherKeys.join(', ') || 'none'})`,
    `Largest bucket: ${largestBucketKey || 'n/a'} at ${largestBucketBytes} bytes / ${quotaBytesPerItem}`,
    legacyCount > 0
      ? `Unconverted old-format items: ${legacyCount}, ${legacyBytes} bytes (avg ${Math.round(legacyBytes / legacyCount)}, largest ${largestLegacyBytes})`
      : 'Unconverted old-format items: 0',
    backup
      ? `Local backup: ${backup.items.length} items (saved ${iso(backup.savedAt)})`
      : 'Local backup: none',
    migration
      ? `Last conversion: ${migration.outcome} at ${iso(migration.finishedAt ?? migration.startedAt)} - ` +
        `${migration.legacyItems} items, ${migration.legacyBytes} bytes, ` +
        `${migration.serializedBytesBefore} serialized before; bucket counts tried ${migration.bucketCountsTried.join('/') || 'none'}; ` +
        `${migration.writes} writes, ${migration.failedWrites} failed, ${migration.removes} removes, ` +
        `${migration.splits} splits, ${migration.swaps} swaps` +
        (migration.error ? `; error ${migration.error}` : '')
      : 'Last conversion: none',
    loadError
      ? `Last load error: ${loadError.name}: ${loadError.message} (at ${iso(loadError.occurredAt)})` +
        (loadError.resolvedAt ? ` - resolved, loaded fine at ${iso(loadError.resolvedAt)}` : '')
      : 'Last load error: none',
    `Browser: ${navigator.userAgent}`,
  ].join('\n');
}
