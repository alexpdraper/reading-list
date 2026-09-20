import {
  bucketKey,
  encodeBucket,
  ListItemData,
  readBucket,
  utf8ByteLength,
  writeBucket,
} from './storage/buckets.js';
import { getItemsRemote } from './storage/migrations.js';

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

      try {
        await chrome.storage.sync.set(toWrite);
      } catch (err) {
        const name = err instanceof Error ? err.name : typeof err;
        const message = err instanceof Error ? err.message : String(err);
        diagnostics =
          `at item ${i}/${rawItems.length}, ` +
          `~${bytesWrittenSoFar}B written so far, ` +
          `this batch: ${Object.keys(toWrite).length} keys / ~${batchBytes}B ` +
          `(largest key ~${maxKeyBytes}B), error: ${name}: ${message}`;
        firstError ??= err;
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
