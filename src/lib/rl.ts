import LZString from 'lz-string';

function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

export interface ListItemData {
  addedAt: number;
  title: string;
  url: string;
  favIconUrl?: string;
  viewed?: boolean;
  index?: number;
}

export interface Settings {
  openNewTab?: boolean;
  animateItems?: boolean;
  addContextMenu?: boolean;
  sortOption?: 'date' | 'title' | '';
  sortOrder?: 'up' | 'down' | '';
  viewAll?: boolean;
  askedForReview?: boolean;
}

export const DEFAULT_SETTINGS: Required<Settings> = {
  openNewTab: false,
  animateItems: true,
  addContextMenu: true,
  sortOption: '',
  sortOrder: '',
  viewAll: true,
  askedForReview: false,
};

export async function getSettings(): Promise<Required<Settings>> {
  const stored = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...updates };
  await chrome.storage.sync.set({ settings: next });
  return next;
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

  return [
    `Items: ${itemCount}`,
    `Buckets used: ${bucketCount} / ${BUCKET_COUNT}`,
    `Bytes in use (browser-reported): ${bytesInUse} / ${quotaBytes}`,
    `Bytes in use (manual estimate): ${manualBytes} / ${quotaBytes}`,
    `Largest bucket: ${largestBucketKey || 'n/a'} at ${largestBucketBytes} bytes / ${quotaBytesPerItem}`,
  ].join('\n');
}

// Items are grouped into a fixed number of storage keys ("buckets") instead
// of one key per item. chrome.storage.sync caps the item COUNT at 512 keys
// regardless of their size, so storing one key per bookmark hard-caps the
// list at 512 entries. Hashing each URL into one of BUCKET_COUNT buckets and
// storing a compressed array of items per bucket removes that per-item key
// limit; the effective cap becomes the ~100KB total byte quota instead.
//
// BUCKET_COUNT is deliberately small (not 512): LZ-style compression only
// pays off when there's redundant text within a single compressed blob
// (repeated property names, similar URLs, etc). With 512 buckets and a
// realistic list size, most buckets end up holding only 1-4 items each —
// too little redundancy to compress well, plus fixed per-blob format
// overhead on every bucket. Measured against real data: 512 buckets gave
// ~170 bytes/item (no better than no compression at all, ~600 items/100KB);
// 40 buckets gives ~68 bytes/item (~1,470 items/100KB) by letting each
// bucket's blob be big enough for compression to actually help, while
// staying safely under the 8KB-per-bucket quota.
const BUCKET_COUNT = 40;
const BUCKET_KEY_RE = /^b\d+$/;
const BUCKET_VERSION_KEY = '__bv';

function hashUrl(url: string): number {
  // FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % BUCKET_COUNT;
}

function bucketKey(url: string): string {
  return `b${hashUrl(url)}`;
}

function decodeBucket(raw: unknown): ListItemData[] {
  if (typeof raw !== 'string') return [];
  // compressToUTF16 packs data into high-value UTF-16 code points to
  // maximize density per code unit, but chrome.storage.sync/browser.storage.sync
  // measure quota usage in real UTF-8 bytes once synced/persisted — those code
  // points mostly fall in the 3-byte UTF-8 range, so compressToUTF16 output
  // actually used ~2.8x more real storage than its .length suggested.
  // compressToBase64 is ASCII-only (1 byte per char), so it doesn't have that
  // blowup. The UTF16 fallback here just reads buckets written before this fix.
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// data: favicons (e.g. Gmail) can exceed a bucket's 8KB quota, so they're
// stripped before storing.
function normalizeItemForStorage(item: ListItemData): ListItemData {
  if (!/^https?:\/\//i.test(item.url)) {
    throw new Error(`Unsupported URL scheme: ${item.url}`);
  }
  return item.favIconUrl?.startsWith('data:')
    ? { ...item, favIconUrl: undefined }
    : item;
}

async function readBucket(key: string): Promise<ListItemData[]> {
  const stored = await chrome.storage.sync.get(key);
  return decodeBucket(stored[key]);
}

async function writeBucket(key: string, items: ListItemData[]): Promise<void> {
  if (items.length === 0) {
    await chrome.storage.sync.remove(key);
    return;
  }
  await chrome.storage.sync.set({ [key]: encodeBucket(items) });
}

// One-time migration from the old one-key-per-item layout (where the
// storage key was the item's own URL) into buckets. New bucket keys are
// written and verified before any legacy key is removed, so a failure
// partway through never loses data.
async function migrateLegacyItems(
  all: Record<string, unknown>,
  legacyKeys: string[],
): Promise<void> {
  const byBucket = new Map<string, ListItemData[]>();
  for (const key of legacyKeys) {
    const item = all[key] as ListItemData;
    const bKey = bucketKey(item.url);
    const bucket = byBucket.get(bKey) ?? [];
    bucket.push(item);
    byBucket.set(bKey, bucket);
  }

  const toWrite: Record<string, string> = {};
  for (const [bKey, items] of byBucket) {
    toWrite[bKey] = encodeBucket(items);
  }
  await chrome.storage.sync.set(toWrite);

  const check = await chrome.storage.sync.get(Object.keys(toWrite));
  for (const [bKey, compressed] of Object.entries(toWrite)) {
    if (check[bKey] !== compressed) {
      throw new Error(`Migration verification failed for bucket ${bKey}`);
    }
  }

  await chrome.storage.sync.remove(legacyKeys);
}

// Re-groups all existing items into the current BUCKET_COUNT scheme. Needed
// whenever BUCKET_COUNT changes (e.g. this session's 512 -> 40 fix): a URL's
// bucket key is `b${hash(url) % BUCKET_COUNT}`, so changing BUCKET_COUNT
// means old bucket keys no longer match what addReadingItem/removeReadingItem
// would compute for the same URL, silently orphaning existing data. New
// buckets are written (and old ones no longer used by the new scheme are
// removed) before the version marker is committed.
async function rebalanceBucketsIfNeeded(
  all: Record<string, unknown>,
): Promise<boolean> {
  if (all[BUCKET_VERSION_KEY] === BUCKET_COUNT) return false;

  const oldBucketKeys = Object.keys(all).filter((k) => BUCKET_KEY_RE.test(k));
  const items: ListItemData[] = [];
  for (const key of oldBucketKeys) {
    items.push(...decodeBucket(all[key]));
  }

  const byBucket = new Map<string, ListItemData[]>();
  for (const item of items) {
    const key = bucketKey(item.url);
    const bucket = byBucket.get(key) ?? [];
    bucket.push(item);
    byBucket.set(key, bucket);
  }

  const toWrite: Record<string, string | number> = {
    [BUCKET_VERSION_KEY]: BUCKET_COUNT,
  };
  for (const [key, bucketItems] of byBucket) {
    toWrite[key] = encodeBucket(bucketItems);
  }
  await chrome.storage.sync.set(toWrite);

  const newKeys = new Set(Object.keys(toWrite));
  const staleKeys = oldBucketKeys.filter((k) => !newKeys.has(k));
  if (staleKeys.length > 0) {
    await chrome.storage.sync.remove(staleKeys);
  }

  return true;
}

async function loadAllBucketStorage(): Promise<Record<string, unknown>> {
  let all = await chrome.storage.sync.get(null);

  const legacyKeys = Object.keys(all).filter((k) => /^https?:\/\//i.test(k));
  if (legacyKeys.length > 0) {
    await migrateLegacyItems(all, legacyKeys);
    all = await chrome.storage.sync.get(null);
  }

  if (await rebalanceBucketsIfNeeded(all)) {
    all = await chrome.storage.sync.get(null);
  }

  return all;
}

const getItemsRemote = async (): Promise<ListItemData[]> => {
  const all = await loadAllBucketStorage();
  const listItems: ListItemData[] = [];
  for (const key in all) {
    if (!BUCKET_KEY_RE.test(key)) continue;
    listItems.push(...decodeBucket(all[key]));
  }
  return listItems;
};

class RL {
  private list: ListItemData[] = [];
  private initialized = false;

  async getListItems() {
    if (!this.initialized) {
      this.list = chrome ? await getItemsRemote() : [];
      this.list.sort((a, b) => b.addedAt - a.addedAt);
      this.initialized = true;
    }

    return this.list;
  }

  private groupItemsByBucket(items: ListItemData[]): Map<string, ListItemData[]> {
    const byBucket = new Map<string, ListItemData[]>();
    for (const item of items) {
      const key = bucketKey(item.url);
      if (!byBucket.has(key)) {
        byBucket.set(
          key,
          this.list.filter((existing) => bucketKey(existing.url) === key),
        );
      }
      const bucket = byBucket.get(key)!;
      const idx = bucket.findIndex((existing) => existing.url === item.url);
      if (idx >= 0) bucket[idx] = item;
      else bucket.push(item);
    }
    return byBucket;
  }

  async addReadingItem(listItem: ListItemData) {
    if (!this.initialized) await this.getListItems();
    listItem = normalizeItemForStorage(listItem);
    const key = bucketKey(listItem.url);
    const bucket = await readBucket(key);
    await writeBucket(key, [
      listItem,
      ...bucket.filter((item) => item.url !== listItem.url),
    ]);
    this.list = [
      listItem,
      ...this.list.filter((item) => item.url !== listItem.url),
    ];
  }

  // Adds many items at once, batching writes so a large import doesn't fire
  // one chrome.storage.sync.set() call per item — that blows through the
  // write-rate limit (120/min) long before the byte quota is ever reached.
  // Each batch merges into its buckets and writes them in one call instead.
  async bulkAddReadingItems(
    rawItems: ListItemData[],
  ): Promise<{
    succeeded: number;
    failed: number;
    firstError: unknown;
    diagnostics: string;
  }> {
    if (!this.initialized) {
      return {
        succeeded: 0,
        failed: rawItems.length,
        firstError: new Error('Reading list not initialized'),
        diagnostics: '',
      };
    }

    const BATCH_SIZE = 25;
    let succeeded = 0;
    let firstError: unknown = null;
    let bytesWrittenSoFar = 0;
    let diagnostics = '';

    for (let i = 0; i < rawItems.length; i += BATCH_SIZE) {
      const batch = rawItems.slice(i, i + BATCH_SIZE);
      const validated: ListItemData[] = [];
      for (const raw of batch) {
        try {
          validated.push(normalizeItemForStorage(raw));
        } catch (err) {
          firstError ??= err;
        }
      }

      const byBucket = this.groupItemsByBucket(validated);

      const toWrite: Record<string, string> = {};
      let batchBytes = 0;
      let maxKeyBytes = 0;
      for (const [key, items] of byBucket) {
        const encoded = encodeBucket(items);
        toWrite[key] = encoded;
        const keyBytes = key.length + utf8ByteLength(encoded);
        batchBytes += keyBytes;
        maxKeyBytes = Math.max(maxKeyBytes, keyBytes);
      }

      // Retry with backoff in case of a transient rejection (e.g. genuinely
      // being right at the byte-quota boundary while other writes settle).
      const MAX_RETRIES = 5;
      let attempt = 0;
      let batchWritten = false;
      let lastErr: unknown = null;
      while (attempt <= MAX_RETRIES && !batchWritten) {
        try {
          await chrome.storage.sync.set(toWrite);
          batchWritten = true;
        } catch (err) {
          lastErr = err;
          attempt++;
          if (attempt <= MAX_RETRIES) {
            await sleep(1000 * attempt);
          }
        }
      }

      if (!batchWritten) {
        const name = lastErr instanceof Error ? lastErr.name : typeof lastErr;
        const message =
          lastErr instanceof Error ? lastErr.message : String(lastErr);
        diagnostics =
          `at item ${i}/${rawItems.length}, ` +
          `~${bytesWrittenSoFar}B written so far, ` +
          `this batch: ${Object.keys(toWrite).length} keys / ~${batchBytes}B ` +
          `(largest key ~${maxKeyBytes}B), gave up after ${MAX_RETRIES} retries, ` +
          `error: ${name}: ${message}`;
        firstError ??= lastErr;
        break;
      }

      bytesWrittenSoFar += batchBytes;
      for (const item of validated) {
        this.list = [item, ...this.list.filter((i) => i.url !== item.url)];
      }
      succeeded += validated.length;
    }

    return {
      succeeded,
      failed: rawItems.length - succeeded,
      firstError,
      diagnostics,
    };
  }

  async removeReadingItem(url: string) {
    if (!this.initialized) await this.getListItems();
    const key = bucketKey(url);
    const bucket = await readBucket(key);
    await writeBucket(
      key,
      bucket.filter((item) => item.url !== url),
    );
    this.list = this.list.filter((item) => item.url !== url);
  }

  async updateReadingItem(url: string, updates: Partial<ListItemData>) {
    if (!this.initialized) await this.getListItems();
    const item = this.list.find((item) => item.url === url);
    if (item) {
      const isNoop = (Object.keys(updates) as (keyof ListItemData)[]).every(
        (key) => item[key] === updates[key],
      );
      if (isNoop) return;
      const updatedItem = { ...item, ...updates };
      const key = bucketKey(url);
      const bucket = await readBucket(key);
      await writeBucket(
        key,
        bucket.map((b) => (b.url === url ? updatedItem : b)),
      );
      Object.assign(item, updates);
    }
  }

  async reorderItems(orderedUrls: string[]) {
    if (!this.initialized) await this.getListItems();
    const indexByUrl = new Map(orderedUrls.map((url, index) => [url, index]));
    const reordered: ListItemData[] = [];
    for (const item of this.list) {
      const index = indexByUrl.get(item.url);
      if (index === undefined) continue;
      item.index = index;
      reordered.push(item);
    }

    const byBucket = this.groupItemsByBucket(reordered);
    const toWrite: Record<string, string> = {};
    for (const [key, items] of byBucket) {
      toWrite[key] = encodeBucket(items);
    }
    if (Object.keys(toWrite).length > 0) {
      await chrome.storage.sync.set(toWrite);
    }
  }

  async clearAll() {
    await chrome.storage.sync.clear();
    this.list = [];
    this.initialized = true;
  }
}

export const rl = new RL();
