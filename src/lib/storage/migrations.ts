import {
  BUCKET_COUNT_LADDER,
  BUCKET_KEY_RE,
  BUCKET_VERSION_KEY,
  bucketCountForItemCount,
  bucketKey,
  decodeBucket,
  encodeBucket,
  LEGACY_KEY_RE,
  ListItemData,
  utf8ByteLength,
} from './buckets.js';
import {
  markLoadErrorResolved,
  MigrationLog,
  saveLoadError,
  saveLocalBackup,
  saveMigrationLog,
} from './local-backup.js';

// Candidates at or above a starting guess, in ascending order - where to
// begin trying, and what's left to escalate to if that guess doesn't fit.
function ladderFrom(startingGuess: number): number[] {
  return BUCKET_COUNT_LADDER.filter((count) => count >= startingGuess);
}

// What storage.sync charges for one key: key bytes + the JSON-serialized
// value (a string value carries its two quotes). Same formula Chrome and
// Firefox both use for QUOTA_BYTES_PER_ITEM and getBytesInUse().
function entryBytes(key: string, value: unknown): number {
  return utf8ByteLength(key) + utf8ByteLength(JSON.stringify(value));
}

// Thrown before anything is written, when some bucket at this count would
// exceed QUOTA_BYTES_PER_ITEM - the only failure a higher count can fix.
class BucketTooLargeError extends Error {
  constructor(key: string, bytes: number, bucketCount: number) {
    super(`Bucket ${key} would be ${bytes} bytes at ${bucketCount} buckets`);
    this.name = 'BucketTooLargeError';
  }
}

// Moves legacy one-key-per-URL items into buckets without ever needing more
// free sync space than a few items' worth.
//
// The legacy layout is much bigger than the bucketed one (~300 vs ~200 bytes
// per item for real data), so a list that grew until the old extension hit
// the quota has almost no free space left - and in Firefox less than
// getBytesInUse() suggests, since the total quota is enforced on the whole
// serialized object, which adds ~4 bytes per key getBytesInUse() doesn't
// count. Writing a whole bucket before removing anything can then fail on
// the very first write, forever. So instead:
// - a bucket that doesn't fit is retried with half as many items,
// - legacy keys already safely written are removed (freeing space) whenever
//   the next write doesn't fit, rather than after every bucket,
// - existing bucket contents are always merged into, never overwritten -
//   a partial earlier attempt, possibly at another bucket count, may already
//   hold items whose legacy keys are gone.
// Only if not even one item fits anywhere does it fall back to swapping a
// single item: remove its legacy key, write it to its bucket, and put the
// legacy key back if that write still fails. The item is also in the local
// backup saved before migration started.
async function migrateLegacyItems(
  all: Record<string, unknown>,
  legacyKeys: string[],
  bucketCount: number,
  log: MigrationLog,
): Promise<void> {
  const bucketItems = new Map<string, ListItemData[]>();
  for (const key of Object.keys(all)) {
    if (BUCKET_KEY_RE.test(key)) bucketItems.set(key, decodeBucket(all[key]));
  }

  const pending = new Map<string, string[]>();
  for (const key of legacyKeys) {
    const bKey = bucketKey((all[key] as ListItemData).url, bucketCount);
    pending.set(bKey, [...(pending.get(bKey) ?? []), key]);
  }

  const perItemQuota = chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8192;
  for (const [bKey, keys] of pending) {
    const merged = [...(bucketItems.get(bKey) ?? []), ...keys.map((k) => all[k] as ListItemData)];
    const bytes = entryBytes(bKey, encodeBucket(merged));
    if (bytes > perItemQuota) throw new BucketTooLargeError(bKey, bytes, bucketCount);
  }

  const writeBucketVerified = async (bKey: string, items: ListItemData[]) => {
    const encoded = encodeBucket(items);
    await chrome.storage.sync.set({ [bKey]: encoded });
    log.writes++;
    const check = await chrome.storage.sync.get(bKey);
    if (check[bKey] !== encoded) {
      throw new Error(`Migration verification failed for bucket ${bKey}`);
    }
    bucketItems.set(bKey, items);
  };

  // Legacy keys whose items are verified in a bucket but not yet removed.
  let written: string[] = [];
  const flush = async () => {
    if (written.length === 0) return false;
    await chrome.storage.sync.remove(written);
    log.removes++;
    written = [];
    return true;
  };

  let lastErr: unknown;
  while (pending.size > 0) {
    let progressed = false;
    for (const [bKey, keys] of pending) {
      let n = keys.length;
      while (n > 0) {
        const chunk = keys.slice(0, n);
        const next = [...(bucketItems.get(bKey) ?? []), ...chunk.map((k) => all[k] as ListItemData)];
        try {
          await writeBucketVerified(bKey, next);
        } catch (err) {
          lastErr = err;
          log.failedWrites++;
          if (await flush()) continue;
          n = Math.floor(n / 2);
          if (n > 0) log.splits++;
          continue;
        }
        written.push(...chunk);
        keys.splice(0, n);
        n = keys.length;
        progressed = true;
      }
      if (keys.length === 0) pending.delete(bKey);
    }
    progressed = (await flush()) || progressed;

    if (!progressed) {
      for (const [bKey, keys] of pending) {
        const key = keys[0];
        const item = all[key] as ListItemData;
        await chrome.storage.sync.remove(key);
        log.swaps++;
        try {
          await writeBucketVerified(bKey, [...(bucketItems.get(bKey) ?? []), item]);
        } catch (err) {
          lastErr = err;
          await chrome.storage.sync.set({ [key]: item });
          continue;
        }
        keys.shift();
        if (keys.length === 0) pending.delete(bKey);
        progressed = true;
        break;
      }
    }
    if (!progressed) throw lastErr;
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

  const legacyKeys = Object.keys(all).filter((k) => LEGACY_KEY_RE.test(k));

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

      const log: MigrationLog = {
        startedAt: Date.now(),
        legacyItems: legacyKeys.length,
        legacyBytes: legacyKeys.reduce((n, k) => n + entryBytes(k, all[k]), 0),
        serializedBytesBefore: utf8ByteLength(JSON.stringify(all)),
        bucketCountsTried: [],
        writes: 0,
        failedWrites: 0,
        removes: 0,
        splits: 0,
        swaps: 0,
        outcome: 'failed',
      };
      const hadBuckets = Object.keys(all).some((k) => BUCKET_KEY_RE.test(k));
      let migratedAt = -1;
      let lastErr: unknown;
      try {
        for (const count of ladderFrom(bucketCountForItemCount(legacyKeys.length))) {
          // Re-read on every attempt: a failed attempt may have already
          // migrated some items, so only the remaining legacy keys need
          // covering, merged into whatever buckets now exist.
          const currentAll = await chrome.storage.sync.get(null);
          const remainingLegacyKeys = Object.keys(currentAll).filter((k) => LEGACY_KEY_RE.test(k));
          if (remainingLegacyKeys.length === 0) {
            // Another context finished it between reads.
            migratedAt = count;
            break;
          }
          log.bucketCountsTried.push(count);
          try {
            await migrateLegacyItems(currentAll, remainingLegacyKeys, count, log);
            migratedAt = count;
            break;
          } catch (err) {
            lastErr = err;
          }
        }
        if (migratedAt === -1) throw lastErr;
        log.outcome = 'succeeded';
      } catch (err) {
        log.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        throw err;
      } finally {
        log.finishedAt = Date.now();
        await saveMigrationLog(log).catch(() => {});
      }
      all = await chrome.storage.sync.get(null);
      // A clean single-count migration is already correctly hashed; skip the
      // otherwise-redundant full rewrite below when that count is also the
      // natural one. Anything else (pre-existing buckets, or items left at a
      // lower count by an escalated attempt) needs the rebalance to regroup.
      if (!hadBuckets && log.bucketCountsTried.length === 1) {
        await chrome.storage.sync.set({ [BUCKET_VERSION_KEY]: migratedAt });
        all[BUCKET_VERSION_KEY] = migratedAt;
      } else {
        delete all[BUCKET_VERSION_KEY];
      }
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

    await markLoadErrorResolved().catch(() => {});
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
    } else if (LEGACY_KEY_RE.test(key)) {
      listItems.push(all[key] as ListItemData);
    }
  }
  listItems.sort((a, b) => b.addedAt - a.addedAt);
  return listItems;
};
