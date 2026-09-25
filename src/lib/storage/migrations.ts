import {
  BUCKET_COUNT,
  BUCKET_KEY_RE,
  BUCKET_VERSION_KEY,
  bucketKey,
  decodeBucket,
  encodeBucket,
  ListItemData,
} from './buckets.js';
import { saveLocalBackup, saveLoadError } from './local-backup.js';

// Groups legacy (one-key-per-item) entries by which bucket they're bound
// for, then writes one target bucket at a time - write, verify, remove
// only the legacy keys that moved into it - rather than writing every
// target bucket before removing any legacy key. All-at-once would need
// the whole uncompressed legacy copy and the whole compressed new copy to
// fit in the quota at the same time, which can fail even when the final
// compressed size alone fits fine. Also makes migration resumable if
// interrupted partway.
async function migrateLegacyItems(
  all: Record<string, unknown>,
  legacyKeys: string[],
): Promise<void> {
  const byBucket = new Map<string, { items: ListItemData[]; legacyKeys: string[] }>();
  for (const key of legacyKeys) {
    const item = all[key] as ListItemData;
    const bKey = bucketKey(item.url);
    const entry = byBucket.get(bKey) ?? { items: [], legacyKeys: [] };
    entry.items.push(item);
    entry.legacyKeys.push(key);
    byBucket.set(bKey, entry);
  }

  for (const [bKey, { items, legacyKeys: keysForBucket }] of byBucket) {
    const encoded = encodeBucket(items);
    await chrome.storage.sync.set({ [bKey]: encoded });

    const check = await chrome.storage.sync.get(bKey);
    if (check[bKey] !== encoded) {
      throw new Error(`Migration verification failed for bucket ${bKey}`);
    }

    await chrome.storage.sync.remove(keysForBucket);
  }
}

// Re-groups all existing items into the current BUCKET_COUNT scheme. A
// URL's bucket key is `b${hash(url) % BUCKET_COUNT}`, so changing
// BUCKET_COUNT means old bucket keys no longer match what
// addReadingItem/removeReadingItem would compute for the same URL,
// silently orphaning existing data without this.
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

      await migrateLegacyItems(all, legacyKeys);
      all = await chrome.storage.sync.get(null);
    }

    if (await rebalanceBucketsIfNeeded(all)) {
      all = await chrome.storage.sync.get(null);
    }
  } catch (err) {
    await saveLoadError(err).catch(() => {});
    throw err;
  }

  return all;
}

export const getItemsRemote = async (): Promise<ListItemData[]> => {
  const all = await loadAllBucketStorage();
  const listItems: ListItemData[] = [];
  for (const key in all) {
    if (!BUCKET_KEY_RE.test(key)) continue;
    listItems.push(...decodeBucket(all[key]));
  }
  return listItems;
};

// Reads whatever is in storage as-is - already-bucketed items plus any
// still-unmigrated legacy items - without running migrateLegacyItems() or
// rebalanceBucketsIfNeeded(). A failed migration write (e.g. QuotaExceededError)
// can leave getItemsRemote() permanently throwing, but export shouldn't need a
// successful write to read data that's already sitting safely in storage.
export const getItemsReadOnly = async (): Promise<ListItemData[]> => {
  const all = await chrome.storage.sync.get(null);
  const listItems: ListItemData[] = [];
  for (const key in all) {
    if (BUCKET_KEY_RE.test(key)) {
      listItems.push(...decodeBucket(all[key]));
    } else if (/^https?:\/\//i.test(key)) {
      listItems.push(all[key] as ListItemData);
    }
  }
  listItems.sort((a, b) => b.addedAt - a.addedAt);
  return listItems;
};
