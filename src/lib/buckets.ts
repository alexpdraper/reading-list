import LZString from 'lz-string';

export interface ListItemData {
  addedAt: number;
  title: string;
  url: string;
  favIconUrl?: string;
  viewed?: boolean;
  index?: number;
}

export interface LocalBackup {
  items: ListItemData[];
  savedAt: number;
}

interface StoredLoadError {
  name: string;
  message: string;
  occurredAt: number;
}

function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

const MIN_BUCKET_COUNT = 25;
const MAX_BUCKET_COUNT = 40;
const BUCKET_COUNT_LADDER = [25, 30, 35, MAX_BUCKET_COUNT];
const BUCKET_KEY_RE = /^b\d+$/;
const BUCKET_VERSION_KEY = '__bv';
const LOCAL_BACKUP_KEY = 'legacyBackup';
const LOAD_ERROR_KEY = 'lastLoadError';

function bucketCountForItemCount(itemCount: number): number {
  if (itemCount <= 150) return MIN_BUCKET_COUNT;
  if (itemCount <= 250) return 30;
  return 35;
}

const REMOVED_BY_THIS_CONTEXT = Symbol('removed-by-this-context');
const lastWrittenByThisContext = new Map<string, string | typeof REMOVED_BY_THIS_CONTEXT>();

function recordOwnWrites(toSet: Record<string, string>, toRemove: string[]): void {
  for (const [key, value] of Object.entries(toSet)) lastWrittenByThisContext.set(key, value);
  for (const key of toRemove) lastWrittenByThisContext.set(key, REMOVED_BY_THIS_CONTEXT);
}

async function syncSet(toSet: Record<string, string | number>): Promise<void> {
  const stringValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(toSet)) stringValues[key] = String(value);
  recordOwnWrites(stringValues, []);
  await chrome.storage.sync.set(toSet);
}

async function syncRemove(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  recordOwnWrites({}, keys);
  await chrome.storage.sync.remove(keys);
}

function hashUrl(url: string, bucketCount: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % bucketCount;
}

function bucketKey(url: string, bucketCount: number): string {
  return `b${hashUrl(url, bucketCount)}`;
}

function decodeBucket(raw: unknown): ListItemData[] {
  if (typeof raw !== 'string') return [];
  let json = LZString.decompressFromBase64(raw);
  if (!json) {
    json = LZString.decompressFromUTF16(raw);
  }
  if (!json) return [];
  try {
    return JSON.parse(json) as ListItemData[];
  } catch {
    return [];
  }
}

function encodeBucket(items: ListItemData[]): string {
  return LZString.compressToBase64(JSON.stringify(items));
}

function ladderFrom(startingGuess: number): number[] {
  return BUCKET_COUNT_LADDER.filter((count) => count >= startingGuess);
}

async function withLadder<T>(
  startingGuess: number,
  attempt: (bucketCount: number) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (const count of ladderFrom(startingGuess)) {
    try {
      return await attempt(count);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function saveLocalBackup(items: ListItemData[]): Promise<void> {
  const backup: LocalBackup = { items, savedAt: Date.now() };
  await chrome.storage.local.set({ [LOCAL_BACKUP_KEY]: backup });
}

async function saveLoadError(err: unknown): Promise<void> {
  const stored: StoredLoadError = {
    name: err instanceof Error ? err.name : typeof err,
    message: err instanceof Error ? err.message : String(err),
    occurredAt: Date.now(),
  };
  await chrome.storage.local.set({ [LOAD_ERROR_KEY]: stored });
}

async function getLoadError(): Promise<StoredLoadError | null> {
  const stored = await chrome.storage.local.get(LOAD_ERROR_KEY);
  return (stored[LOAD_ERROR_KEY] as StoredLoadError | undefined) ?? null;
}

function isLegacyKey(key: string): boolean {
  return /^https?:\/\//i.test(key);
}

async function migrateLegacyItems(
  all: Record<string, unknown>,
  legacyKeys: string[],
  bucketCount: number,
): Promise<void> {
  const byBucket = new Map<string, { items: ListItemData[]; legacyKeys: string[] }>();
  for (const key of legacyKeys) {
    const item = all[key] as ListItemData;
    const bKey = bucketKey(item.url, bucketCount);
    const entry = byBucket.get(bKey) ?? { items: [], legacyKeys: [] };
    entry.items.push(item);
    entry.legacyKeys.push(key);
    byBucket.set(bKey, entry);
  }

  for (const [bKey, { items, legacyKeys: keysForBucket }] of byBucket) {
    await syncSet({ [bKey]: encodeBucket(items) });
    await syncRemove(keysForBucket);
  }
}

async function rebalanceBuckets(
  items: ListItemData[],
  bucketCount: number,
  oldBucketKeys: string[],
): Promise<void> {
  const byBucket = new Map<string, ListItemData[]>();
  for (const item of items) {
    const key = bucketKey(item.url, bucketCount);
    const bucket = byBucket.get(key) ?? [];
    bucket.push(item);
    byBucket.set(key, bucket);
  }

  const toWrite: Record<string, string | number> = { [BUCKET_VERSION_KEY]: bucketCount };
  for (const [key, bucketItems] of byBucket) {
    toWrite[key] = encodeBucket(bucketItems);
  }
  await syncSet(toWrite);

  const newKeys = new Set(Object.keys(toWrite));
  const staleKeys = oldBucketKeys.filter((k) => !newKeys.has(k));
  await syncRemove(staleKeys);
}

interface LoadResult {
  items: ListItemData[];
  bucketCount: number;
}

async function loadAllBuckets(): Promise<LoadResult> {
  let all = await chrome.storage.sync.get(null);
  const legacyKeys = Object.keys(all).filter(isLegacyKey);

  try {
    if (legacyKeys.length > 0) {
      try {
        await saveLocalBackup(legacyKeys.map((k) => all[k] as ListItemData));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Skipped converting your reading list: couldn't save a safety backup first (${reason}). ` +
            `Your data hasn't been touched - export it from Options, then reopen this page.`,
        );
      }

      await withLadder(bucketCountForItemCount(legacyKeys.length), async (count) => {
        const currentAll = await chrome.storage.sync.get(null);
        const remainingLegacyKeys = Object.keys(currentAll).filter(isLegacyKey);
        if (remainingLegacyKeys.length === 0) return;
        await migrateLegacyItems(currentAll, remainingLegacyKeys, count);
      });
      all = await chrome.storage.sync.get(null);
    }

    const bucketKeys = Object.keys(all).filter((k) => BUCKET_KEY_RE.test(k));
    const items: ListItemData[] = [];
    for (const key of bucketKeys) {
      items.push(...decodeBucket(all[key]));
    }

    const naturalTarget = bucketCountForItemCount(items.length);
    const storedBucketCount =
      typeof all[BUCKET_VERSION_KEY] === 'number' ? all[BUCKET_VERSION_KEY] : -1;

    const finalBucketCount =
      storedBucketCount === naturalTarget
        ? storedBucketCount
        : await withLadder(naturalTarget, async (count) => {
            await rebalanceBuckets(items, count, bucketKeys);
            return count;
          });

    return { items, bucketCount: finalBucketCount };
  } catch (err) {
    await saveLoadError(err).catch(() => {});
    throw err;
  }
}

let cachedBucketCount = MIN_BUCKET_COUNT;

export async function loadItems(): Promise<ListItemData[]> {
  const { items, bucketCount } = await loadAllBuckets();
  cachedBucketCount = bucketCount;
  return items;
}

export async function saveItems(all: ListItemData[], touchedUrls: string[]): Promise<void> {
  const touchedKeys = new Set(touchedUrls.map((url) => bucketKey(url, cachedBucketCount)));
  if (touchedKeys.size === 0) return;

  const byBucket = new Map<string, ListItemData[]>();
  for (const key of touchedKeys) byBucket.set(key, []);
  for (const item of all) {
    const key = bucketKey(item.url, cachedBucketCount);
    byBucket.get(key)?.push(item);
  }

  const toSet: Record<string, string> = {};
  const toRemove: string[] = [];
  for (const [key, items] of byBucket) {
    if (items.length === 0) toRemove.push(key);
    else toSet[key] = encodeBucket(items);
  }

  if (Object.keys(toSet).length > 0) await syncSet(toSet);
  await syncRemove(toRemove);
}

export async function clearItems(): Promise<void> {
  const all = await chrome.storage.sync.get(null);
  recordOwnWrites({}, Object.keys(all));
  await chrome.storage.sync.clear();
}

export async function readItemsReadOnly(): Promise<ListItemData[]> {
  const all = await chrome.storage.sync.get(null);
  const listItems: ListItemData[] = [];
  for (const key in all) {
    if (BUCKET_KEY_RE.test(key)) {
      listItems.push(...decodeBucket(all[key]));
    } else if (isLegacyKey(key)) {
      listItems.push(all[key] as ListItemData);
    }
  }
  listItems.sort((a, b) => b.addedAt - a.addedAt);
  return listItems;
}

function isSelfCausedChange(key: string, change: chrome.storage.StorageChange): boolean {
  const lastWritten = lastWrittenByThisContext.get(key);
  return 'newValue' in change ? lastWritten === change.newValue : lastWritten === REMOVED_BY_THIS_CONTEXT;
}

export function onItemsChanged(callback: () => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'sync') return;
    const bucketChanges = Object.entries(changes).filter(([key]) => BUCKET_KEY_RE.test(key));
    if (bucketChanges.length === 0) return;
    const allSelfCaused = bucketChanges.every(([key, change]) => isSelfCausedChange(key, change));
    if (!allSelfCaused) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function getStorageDiagnostics(): Promise<string> {
  const all = await chrome.storage.sync.get(null);

  let bucketCount = 0;
  let itemCount = 0;
  let largestBucketBytes = 0;
  let largestBucketKey = '';
  let manualBytes = 0;

  for (const key in all) {
    const raw = all[key];
    const rawLen = utf8ByteLength(typeof raw === 'string' ? raw : JSON.stringify(raw));
    manualBytes += key.length + rawLen;
    if (!BUCKET_KEY_RE.test(key)) continue;
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

  const loadError = await getLoadError();
  const targetBucketCount = bucketCountForItemCount(itemCount);
  const buildTag = chrome?.runtime?.getManifest?.().version ?? 'unknown';

  return [
    `Build: ${buildTag}`,
    `Items: ${itemCount}`,
    `Buckets used: ${bucketCount} / ${targetBucketCount}`,
    `Bytes in use (browser-reported): ${bytesInUse} / ${quotaBytes}`,
    `Bytes in use (manual estimate): ${manualBytes} / ${quotaBytes}`,
    `Largest bucket: ${largestBucketKey || 'n/a'} at ${largestBucketBytes} bytes / ${quotaBytesPerItem}`,
    loadError
      ? `Last load error: ${loadError.name}: ${loadError.message} (at ${new Date(loadError.occurredAt).toISOString()})`
      : 'Last load error: none',
  ].join('\n');
}

export async function getLocalBackup(): Promise<LocalBackup | null> {
  const stored = await chrome.storage.local.get(LOCAL_BACKUP_KEY);
  return (stored[LOCAL_BACKUP_KEY] as LocalBackup | undefined) ?? null;
}

export const testOnlyInternals = {
  bucketKey,
  encodeBucket,
  decodeBucket,
  bucketCountForItemCount,
  BUCKET_KEY_RE,
  BUCKET_VERSION_KEY,
};
