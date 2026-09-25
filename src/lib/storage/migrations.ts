import {
  BUCKET_COUNT_LADDER,
  BUCKET_KEY_RE,
  BUCKET_VERSION_KEY,
  bucketCountForItemCount,
  bucketKey,
  decodeBucket,
  encodeBucket,
  ListItemData,
} from './buckets.js';
import { saveLocalBackup, saveLoadError } from './local-backup.js';

// Candidates at or above a starting guess, in ascending order - where to
// begin trying, and what's left to escalate to if that guess doesn't fit.
function ladderFrom(startingGuess: number): number[] {
  return BUCKET_COUNT_LADDER.filter((count) => count >= startingGuess);
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
    const encoded = encodeBucket(items);
    await chrome.storage.sync.set({ [bKey]: encoded });

    const check = await chrome.storage.sync.get(bKey);
    if (check[bKey] !== encoded) {
      throw new Error(`Migration verification failed for bucket ${bKey}`);
    }

    await chrome.storage.sync.remove(keysForBucket);
  }
}

// Re-groups items already in memory into a new bucket count and persists it.
// A URL's bucket key is `b${hash(url) % bucketCount}`, so changing bucketCount
// means old bucket keys no longer match what addReadingItem/removeReadingItem
// would compute for the same URL, silently orphaning existing data without
// this. Callers already have `items` decoded (getItemsRemote decodes once to
// determine the target count in the first place), so this never re-reads
// storage - it just re-groups and writes.
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

  const toWrite: Record<string, string | number> = {
    [BUCKET_VERSION_KEY]: bucketCount,
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
}

export interface LoadResult {
  items: ListItemData[];
  bucketCount: number;
}

async function loadAllBuckets(): Promise<LoadResult> {
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

      let migrated = false;
      let lastErr: unknown;
      for (const count of ladderFrom(bucketCountForItemCount(legacyKeys.length))) {
        // Re-read on every attempt: migrateLegacyItems writes bucket-by-bucket
        // and only removes a legacy key once its bucket is confirmed written,
        // so a failed attempt at a lower count may have already migrated some
        // items - retrying only needs to cover whatever legacy keys remain.
        const currentAll = await chrome.storage.sync.get(null);
        const remainingLegacyKeys = Object.keys(currentAll).filter((k) => /^https?:\/\//i.test(k));
        if (remainingLegacyKeys.length === 0) {
          migrated = true;
          break;
        }
        try {
          await migrateLegacyItems(currentAll, remainingLegacyKeys, count);
          migrated = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!migrated) throw lastErr;
      all = await chrome.storage.sync.get(null);
    }

    const bucketKeys = Object.keys(all).filter((k) => BUCKET_KEY_RE.test(k));
    const items: ListItemData[] = [];
    for (const key of bucketKeys) {
      items.push(...decodeBucket(all[key]));
    }

    const naturalTarget = bucketCountForItemCount(items.length);
    let finalBucketCount: number =
      typeof all[BUCKET_VERSION_KEY] === 'number' ? all[BUCKET_VERSION_KEY] : -1;
    if (finalBucketCount !== naturalTarget) {
      let rebalanced = false;
      let lastErr: unknown;
      for (const count of ladderFrom(naturalTarget)) {
        try {
          await rebalanceBuckets(items, count, bucketKeys);
          finalBucketCount = count;
          rebalanced = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!rebalanced) throw lastErr;
    }

    return { items, bucketCount: finalBucketCount };
  } catch (err) {
    await saveLoadError(err).catch(() => {});
    throw err;
  }
}

export const getItemsRemote = async (): Promise<LoadResult> => {
  return loadAllBuckets();
};

// Reads whatever is in storage as-is - already-bucketed items plus any
// still-unmigrated legacy items - without running migrateLegacyItems() or
// rebalanceBuckets(). A failed migration write (e.g. QuotaExceededError)
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
