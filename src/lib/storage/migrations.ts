import {
  BUCKET_COUNT,
  BUCKET_KEY_RE,
  BUCKET_VERSION_KEY,
  bucketKey,
  decodeBucket,
  encodeBucket,
  ListItemData,
} from './buckets.js';

// One-time migration from the old one-key-per-item layout (where the
// storage key was the item's own URL) into buckets. Migrates one bucket at
// a time - write it, verify it, remove only the legacy keys that just
// moved into it - rather than writing every new bucket before removing any
// old key. Doing it all at once means the entire uncompressed old copy and
// the entire compressed new copy must fit in the quota at the same time,
// which can itself exceed the quota for a list already near capacity under
// the old scheme, even though the final compressed size alone would fit
// easily (confirmed: 250 real-sized items, ~86KB uncompressed, failed to
// migrate at all this way, even though compressed they're well under
// quota). Per-bucket bounds that transient overlap to one bucket's worth
// (<= 8KB) instead of the whole list, and is naturally resumable - if it
// throws partway through, buckets already migrated stay migrated, and
// whatever legacy keys remain get picked up again on the next call.
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

export const getItemsRemote = async (): Promise<ListItemData[]> => {
  const all = await loadAllBucketStorage();
  const listItems: ListItemData[] = [];
  for (const key in all) {
    if (!BUCKET_KEY_RE.test(key)) continue;
    listItems.push(...decodeBucket(all[key]));
  }
  return listItems;
};
