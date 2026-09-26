import {
  bucketCountForItemCount,
  bucketKey,
  BUCKET_KEY_RE,
  BUCKET_VERSION_KEY,
  decodeBucket,
  LEGACY_KEY_RE,
  ListItemData,
  utf8ByteLength,
} from './buckets.js';
import { BUILD_TAG } from '../build-info.js';
import {
  getConversionPending,
  getLoadError,
  getLocalBackup,
  getMigrationLog,
} from './local-backup.js';

const iso = (ms: number) => new Date(ms).toISOString();

// Everything reported here is a count, size, storage key name, field name,
// setting value or timestamp - never a URL, title or domain - so users can
// paste it into a bug report without exposing what's on their list.

const KNOWN_FIELDS = new Set(['addedAt', 'title', 'url', 'favIconUrl', 'viewed', 'index']);
const DAY_MS = 24 * 60 * 60 * 1000;

// "min / median / p90 / max", or "n/a" for an empty list.
function spread(values: number[]): string {
  if (values.length === 0) return 'n/a';
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return `min ${sorted[0]} / median ${at(0.5)} / p90 ${at(0.9)} / max ${sorted[sorted.length - 1]}`;
}

// The shape of the list, not its contents: sizes, field presence and
// anything malformed that could trip up loading, sorting or storage.
function describeItems(items: unknown[]): string[] {
  const itemBytes: number[] = [];
  const urlLengths: number[] = [];
  const titleLengths: number[] = [];
  const indexes: number[] = [];
  const seenUrls = new Set<string>();
  const unknownFields = new Set<string>();
  let duplicates = 0;
  let notObjects = 0;
  let badUrl = 0;
  let badTitle = 0;
  let badAddedAt = 0;
  let futureAddedAt = 0;
  let nonAsciiTitles = 0;
  let viewed = 0;
  let faviconHttp = 0;
  let faviconData = 0;
  let faviconDataBytes = 0;
  let faviconOther = 0;
  let addedLast30Days = 0;
  let oldest = Infinity;
  let newest = -Infinity;
  const now = Date.now();

  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      notObjects++;
      continue;
    }
    const item = raw as Partial<ListItemData> & Record<string, unknown>;
    itemBytes.push(utf8ByteLength(JSON.stringify(item)));
    for (const field of Object.keys(item)) {
      if (!KNOWN_FIELDS.has(field)) unknownFields.add(field);
    }

    if (typeof item.url !== 'string' || !LEGACY_KEY_RE.test(item.url)) {
      badUrl++;
    } else {
      urlLengths.push(utf8ByteLength(item.url));
      if (seenUrls.has(item.url)) duplicates++;
      seenUrls.add(item.url);
    }

    if (typeof item.title !== 'string') {
      badTitle++;
    } else {
      titleLengths.push(utf8ByteLength(item.title));
      if (/[^\x00-\x7f]/.test(item.title)) nonAsciiTitles++;
    }

    if (typeof item.addedAt !== 'number' || !Number.isFinite(item.addedAt)) {
      badAddedAt++;
    } else {
      if (item.addedAt > now + DAY_MS) futureAddedAt++;
      if (item.addedAt > now - 30 * DAY_MS) addedLast30Days++;
      oldest = Math.min(oldest, item.addedAt);
      newest = Math.max(newest, item.addedAt);
    }

    if (item.viewed) viewed++;
    if (typeof item.index === 'number') indexes.push(item.index);

    const fav = item.favIconUrl;
    if (typeof fav === 'string' && fav.startsWith('data:')) {
      faviconData++;
      faviconDataBytes += utf8ByteLength(fav);
    } else if (typeof fav === 'string' && /^https?:/i.test(fav)) {
      faviconHttp++;
    } else if (fav != null) {
      faviconOther++;
    }
  }

  const duplicateIndexes = indexes.length - new Set(indexes).size;
  const year = (ms: number) => (Number.isFinite(ms) ? new Date(ms).getUTCFullYear() : 'n/a');

  return [
    `  Total: ${items.length}, not objects: ${notObjects}, duplicate URLs: ${duplicates}`,
    `  Bytes per item (JSON): ${spread(itemBytes)}`,
    `  URL length: ${spread(urlLengths)}; invalid/non-http URL: ${badUrl}`,
    `  Title length: ${spread(titleLengths)}; non-ASCII titles: ${nonAsciiTitles}; missing/non-text title: ${badTitle}`,
    `  Added: oldest year ${year(oldest)}, newest year ${year(newest)}, last 30 days ${addedLast30Days}; ` +
      `missing/invalid date ${badAddedAt}, future date ${futureAddedAt}`,
    `  Viewed: ${viewed}; with index: ${indexes.length}` +
      (indexes.length > 0
        ? ` (range ${Math.min(...indexes)}..${Math.max(...indexes)}, duplicates ${duplicateIndexes})`
        : ''),
    `  Favicons: http ${faviconHttp}, data: ${faviconData} (${faviconDataBytes} bytes), other ${faviconOther}, ` +
      `none ${items.length - notObjects - faviconHttp - faviconData - faviconOther}`,
    `  Unexpected fields: ${[...unknownFields].join(', ') || 'none'}`,
  ];
}

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
  const allItems: unknown[] = [];
  const bucketBytes: number[] = [];
  const itemsPerBucket: number[] = [];
  const undecodable: string[] = [];
  const oldEncoding: string[] = [];
  const storedVersion = all[BUCKET_VERSION_KEY];
  let misplaced = 0;

  for (const key in all) {
    const raw = all[key];
    const rawLen = utf8ByteLength(typeof raw === 'string' ? raw : JSON.stringify(raw));
    manualBytes += key.length + rawLen;
    if (LEGACY_KEY_RE.test(key)) {
      const bytes = utf8ByteLength(key) + rawLen;
      legacyCount++;
      legacyBytes += bytes;
      largestLegacyBytes = Math.max(largestLegacyBytes, bytes);
      allItems.push(raw);
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
    const decoded = decodeBucket(raw);
    itemCount += decoded.length;
    allItems.push(...decoded);
    bucketBytes.push(bytes);
    itemsPerBucket.push(decoded.length);
    if (decoded.length === 0) undecodable.push(key);
    // compressToUTF16 output (pre-3.0 buckets) is the only non-ASCII encoding.
    if (typeof raw === 'string' && /[^\x00-\x7f]/.test(raw)) oldEncoding.push(key);
    if (typeof storedVersion === 'number') {
      for (const item of decoded) {
        if (typeof item?.url === 'string' && bucketKey(item.url, storedVersion) !== key) misplaced++;
      }
    }
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

  let localBytes: number | string = 'unavailable';
  try {
    localBytes = await chrome.storage.local.getBytesInUse(null);
  } catch {
    // Firefox only added storage.local.getBytesInUse in 131
  }
  const localKeys = Object.keys(await chrome.storage.local.get(null));
  const settings = all.settings;

  const loadError = await getLoadError();
  const migration = await getMigrationLog();
  const backup = await getLocalBackup();
  const pending = await getConversionPending();
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
    `Bucket bytes: ${spread(bucketBytes)}; items per bucket: ${spread(itemsPerBucket)}`,
    `Bucket count on record (${BUCKET_VERSION_KEY}): ${storedVersion ?? 'none'}; ` +
      `items in the wrong bucket for it: ${misplaced}`,
    `Unreadable buckets: ${undecodable.join(', ') || 'none'}; old-encoding buckets: ${oldEncoding.join(', ') || 'none'}`,
    legacyCount > 0
      ? `Unconverted old-format items: ${legacyCount}, ${legacyBytes} bytes (avg ${Math.round(legacyBytes / legacyCount)}, largest ${largestLegacyBytes})`
      : 'Unconverted old-format items: 0',
    backup
      ? `Local backup: ${backup.items.length} items (saved ${iso(backup.savedAt)})`
      : 'Local backup: none',
    migration
      ? `Last conversion: ${migration.outcome}${migration.resumed ? ' (resumed)' : ''} at ` +
        `${iso(migration.finishedAt ?? migration.startedAt)} - ${migration.legacyItems} items, ` +
        `${migration.legacyBytes} bytes, ${migration.serializedBytesBefore} serialized before; ` +
        `bucket count ${migration.bucketCount ?? 'n/a'}` +
        (migration.restored ? '; old-format items restored after failed write' : '') +
        (migration.error ? `; error ${migration.error}` : '')
      : 'Last conversion: none',
    `Conversion pending (interrupted): ${pending ? `yes, since ${iso(pending.since)}` : 'no'}`,
    loadError
      ? `Last load error: ${loadError.name}: ${loadError.message} (at ${iso(loadError.occurredAt)})` +
        (loadError.resolvedAt ? ` - resolved, loaded fine at ${iso(loadError.resolvedAt)}` : '')
      : 'Last load error: none',
    `Settings: ${settings === undefined ? 'none stored' : JSON.stringify(settings)}`,
    `Local storage: ${localBytes} bytes, keys: ${localKeys.join(', ') || 'none'}`,
    `Browser: ${navigator.userAgent}`,
    `Language: ${navigator.language}`,
    `List shape (all items in sync storage, both formats):`,
    ...describeItems(allItems),
  ].join('\n');
}
