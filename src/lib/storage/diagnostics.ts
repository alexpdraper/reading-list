import {
  bucketStats,
  bucketStore,
  startingBucketCount,
} from './bucket-store.js';
import { flatStore } from './flat-store.js';
import { OTHER_STORE, PREFERRED_STORE } from './load.js';
import {
  ConversionLog,
  getConversionLog,
  getLoadError,
  getLocalBackup,
  getPendingConversionSince,
  LocalBackup,
  StoredLoadError,
} from './local-backup.js';
import {
  ListItemData,
  SyncData,
  syncQuotaBytes,
  syncQuotaBytesPerKey,
  utf8ByteLength,
} from './store.js';

type LooseItem = Partial<ListItemData> & Record<string, unknown>;

const KNOWN_FIELDS = new Set([
  'addedAt',
  'title',
  'url',
  'favIconUrl',
  'viewed',
  'index',
]);
const DAY_MS = 24 * 60 * 60 * 1000;
const NON_ASCII = /[^\x00-\x7f]/;

const iso = (ms: number) => new Date(ms).toISOString();
const listOrNone = (values: string[]) => values.join(', ') || 'none';
const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
const rawValueBytes = (value: unknown) =>
  utf8ByteLength(typeof value === 'string' ? value : JSON.stringify(value));

function spread(values: number[]): string {
  if (values.length === 0) return 'n/a';
  const sorted = [...values].sort((a, b) => a - b);
  const at = (quantile: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))];
  return `min ${sorted[0]} / median ${at(0.5)} / p90 ${at(0.9)} / max ${sorted[sorted.length - 1]}`;
}

async function bytesInUse(
  area: chrome.storage.StorageArea,
): Promise<number | string> {
  try {
    return await area.getBytesInUse(null);
  } catch {
    return 'unavailable';
  }
}

async function describeSync(data: SyncData): Promise<string[]> {
  const buckets = bucketStats(data);
  const bucketBytes = buckets.keys.map(
    (key) => key.length + rawValueBytes(data[key]),
  );
  const largestIndex = bucketBytes.indexOf(Math.max(...bucketBytes));
  const flatKeys = Object.keys(data).filter(flatStore.ownsKey);
  const flatBytes = flatKeys.map(
    (key) => utf8ByteLength(key) + rawValueBytes(data[key]),
  );
  const otherKeys = Object.keys(data).filter(
    (key) => !flatStore.ownsKey(key) && !buckets.keys.includes(key),
  );
  const manualBytes = sum(
    Object.keys(data).map((key) => key.length + rawValueBytes(data[key])),
  );
  const quota = syncQuotaBytes();

  return [
    `Items: ${buckets.items.length}`,
    `Buckets used: ${buckets.keys.length} / ${startingBucketCount(buckets.items.length)}`,
    `Bytes in use (browser-reported): ${await bytesInUse(chrome.storage.sync)} / ${quota}`,
    `Bytes in use (manual estimate): ${manualBytes} / ${quota}`,
    `Bytes in use (serialized, Firefox's enforced number): ${utf8ByteLength(JSON.stringify(data))} / ${quota}`,
    `Keys: ${Object.keys(data).length} / 512 (other than buckets/legacy: ${listOrNone(otherKeys)})`,
    `Largest bucket: ${buckets.keys[largestIndex] ?? 'n/a'} at ${bucketBytes[largestIndex] ?? 0} bytes / ${syncQuotaBytesPerKey()}`,
    `Bucket bytes: ${spread(bucketBytes)}; items per bucket: ${spread(buckets.itemsPerBucket)}`,
    `Bucket count on record (__bv): ${buckets.storedCount ?? 'none'}; items in the wrong bucket for it: ${buckets.misplaced}`,
    `Unreadable buckets: ${listOrNone(buckets.unreadable)}; old-encoding buckets: ${listOrNone(buckets.oldEncoding)}`,
    flatKeys.length > 0
      ? `Unconverted old-format items: ${flatKeys.length}, ${sum(flatBytes)} bytes ` +
        `(avg ${Math.round(sum(flatBytes) / flatKeys.length)}, largest ${Math.max(...flatBytes)})`
      : 'Unconverted old-format items: 0',
  ];
}

function describeFormat(data: SyncData, log: ConversionLog | null): string {
  const stuckOnOther =
    log?.outcome === 'blocked' && Object.keys(data).some(OTHER_STORE.ownsKey);
  return stuckOnOther
    ? `Storage format: ${OTHER_STORE.name} (preferred: ${PREFERRED_STORE.name}; list too large to convert)`
    : `Storage format: ${PREFERRED_STORE.name}`;
}

function describeConversion(
  backup: LocalBackup | null,
  log: ConversionLog | null,
  pendingSince: number | null,
  loadError: StoredLoadError | null,
): string[] {
  return [
    backup
      ? `Local backup: ${backup.items.length} items (saved ${iso(backup.savedAt)})`
      : 'Local backup: none',
    log
      ? `Last conversion: ${log.outcome}${log.resumed ? ' (resumed)' : ''} at ` +
        `${iso(log.finishedAt ?? log.startedAt)} - ${log.legacyItems} items, ` +
        `${log.legacyBytes} bytes, ${log.serializedBytesBefore} serialized before; ` +
        `bucket count ${log.bucketCount ?? 'n/a'}` +
        (log.restored ? '; old-format items restored after failed write' : '') +
        (log.error ? `; error ${log.error}` : '')
      : 'Last conversion: none',
    `Conversion pending (interrupted): ${pendingSince ? `yes, since ${iso(pendingSince)}` : 'no'}`,
    loadError
      ? `Last load error: ${loadError.name}: ${loadError.message} (at ${iso(loadError.occurredAt)})` +
        (loadError.resolvedAt
          ? ` - resolved, loaded fine at ${iso(loadError.resolvedAt)}`
          : '')
      : 'Last load error: none',
  ];
}

async function describeEnvironment(data: SyncData): Promise<string[]> {
  const localKeys = Object.keys(await chrome.storage.local.get(null));
  return [
    `Settings: ${data.settings === undefined ? 'none stored' : JSON.stringify(data.settings)}`,
    `Local storage: ${await bytesInUse(chrome.storage.local)} bytes, keys: ${listOrNone(localKeys)}`,
    `Browser: ${navigator.userAgent}`,
    `Language: ${navigator.language}`,
  ];
}

function faviconKind(favicon: unknown): 'data' | 'http' | 'other' | 'none' {
  if (typeof favicon === 'string' && favicon.startsWith('data:')) return 'data';
  if (typeof favicon === 'string' && /^https?:/i.test(favicon)) return 'http';
  return favicon == null ? 'none' : 'other';
}

function describeItems(entries: unknown[]): string[] {
  const items = entries.filter(
    (entry): entry is LooseItem =>
      !!entry && typeof entry === 'object' && !Array.isArray(entry),
  );
  const urls = items
    .map((item) => item.url)
    .filter(
      (url): url is string => typeof url === 'string' && flatStore.ownsKey(url),
    );
  const titles = items
    .map((item) => item.title)
    .filter((title): title is string => typeof title === 'string');
  const dates = items
    .map((item) => item.addedAt)
    .filter(
      (date): date is number =>
        typeof date === 'number' && Number.isFinite(date),
    );
  const indexes = items
    .map((item) => item.index)
    .filter((index): index is number => typeof index === 'number');
  const favicons = items.map((item) => faviconKind(item.favIconUrl));
  const countFavicons = (kind: string) =>
    favicons.filter((found) => found === kind).length;
  const dataFaviconBytes = sum(
    items
      .filter((item) => faviconKind(item.favIconUrl) === 'data')
      .map((item) => utf8ByteLength(item.favIconUrl!)),
  );
  const unexpectedFields = new Set(
    items
      .flatMap((item) => Object.keys(item))
      .filter((field) => !KNOWN_FIELDS.has(field)),
  );
  const now = Date.now();
  const year = (ms: number) =>
    Number.isFinite(ms) ? new Date(ms).getUTCFullYear() : 'n/a';

  return [
    `  Total: ${entries.length}, not objects: ${entries.length - items.length}, duplicate URLs: ${urls.length - new Set(urls).size}`,
    `  Bytes per item (JSON): ${spread(items.map((item) => utf8ByteLength(JSON.stringify(item))))}`,
    `  URL length: ${spread(urls.map(utf8ByteLength))}; invalid/non-http URL: ${items.length - urls.length}`,
    `  Title length: ${spread(titles.map(utf8ByteLength))}; non-ASCII titles: ${titles.filter((title) => NON_ASCII.test(title)).length}; ` +
      `missing/non-text title: ${items.length - titles.length}`,
    `  Added: oldest year ${year(Math.min(...dates))}, newest year ${year(Math.max(...dates))}, ` +
      `last 30 days ${dates.filter((date) => date > now - 30 * DAY_MS).length}; ` +
      `missing/invalid date ${items.length - dates.length}, future date ${dates.filter((date) => date > now + DAY_MS).length}`,
    `  Viewed: ${items.filter((item) => item.viewed).length}; with index: ${indexes.length}` +
      (indexes.length > 0
        ? ` (range ${Math.min(...indexes)}..${Math.max(...indexes)}, duplicates ${indexes.length - new Set(indexes).size})`
        : ''),
    `  Favicons: http ${countFavicons('http')}, data: ${countFavicons('data')} (${dataFaviconBytes} bytes), ` +
      `other ${countFavicons('other')}, none ${countFavicons('none')}`,
    `  Unexpected fields: ${listOrNone([...unexpectedFields])}`,
  ];
}

export async function getStorageDiagnostics(): Promise<string> {
  const data = await chrome.storage.sync.get(null);
  const log = await getConversionLog();
  const allItems = [
    ...flatStore.readItems(data),
    ...bucketStore.readItems(data),
  ];
  return [
    `Build: ${chrome.runtime.getManifest().version}`,
    describeFormat(data, log),
    ...(await describeSync(data)),
    ...describeConversion(
      await getLocalBackup(),
      log,
      await getPendingConversionSince(),
      await getLoadError(),
    ),
    ...(await describeEnvironment(data)),
    'List shape (all items in sync storage, both formats):',
    ...describeItems(allItems),
  ].join('\n');
}
