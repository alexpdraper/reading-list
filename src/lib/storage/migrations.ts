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
  clearConversionPending,
  getConversionPending,
  getLocalBackup,
  markLoadErrorResolved,
  MigrationLog,
  saveLoadError,
  saveLocalBackup,
  saveMigrationLog,
  setConversionPending,
} from './local-backup.js';

// What storage.sync charges for one key: key bytes + the JSON-serialized
// value (a string value carries its two quotes). Same formula Chrome and
// Firefox both use for QUOTA_BYTES_PER_ITEM and getBytesInUse().
function entryBytes(key: string, value: unknown): number {
  return utf8ByteLength(key) + utf8ByteLength(JSON.stringify(value));
}

interface BucketPlan {
  bucketCount: number;
  toWrite: Record<string, string | number>;
}

// Picks the lowest bucket count at or above the size-based guess where every
// bucket fits QUOTA_BYTES_PER_ITEM, entirely in memory - so a bad count is
// rejected before anything is written, instead of by a failed write.
function planBuckets(items: ListItemData[]): BucketPlan {
  const perItemQuota = chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8192;
  const guess = bucketCountForItemCount(items.length);
  let largest = 0;
  for (const bucketCount of BUCKET_COUNT_LADDER.filter((c) => c >= guess)) {
    const byBucket = new Map<string, ListItemData[]>();
    for (const item of items) {
      const key = bucketKey(item.url, bucketCount);
      byBucket.set(key, [...(byBucket.get(key) ?? []), item]);
    }
    const toWrite: Record<string, string | number> = { [BUCKET_VERSION_KEY]: bucketCount };
    largest = 0;
    for (const [key, bucketItems] of byBucket) {
      toWrite[key] = encodeBucket(bucketItems);
      largest = Math.max(largest, entryBytes(key, toWrite[key]));
    }
    if (largest <= perItemQuota) return { bucketCount, toWrite };
  }
  throw new Error(
    `No bucket count keeps every bucket under ${perItemQuota} bytes (largest ${largest})`,
  );
}

// Same URL can be in both a bucket and the backup (e.g. a conversion that
// wrote its buckets but was interrupted before clearing its pending flag);
// the bucket copy wins, since it's the one the app has been editing.
function mergeByUrl(primary: ListItemData[], secondary: ListItemData[]): ListItemData[] {
  const seen = new Set(primary.map((i) => i.url));
  return [...primary, ...secondary.filter((i) => !seen.has(i.url))];
}

function decodeAllBuckets(all: Record<string, unknown>): ListItemData[] {
  return Object.keys(all)
    .filter((k) => BUCKET_KEY_RE.test(k))
    .flatMap((k) => decodeBucket(all[k]));
}

async function backUpLegacyItems(items: ListItemData[]): Promise<void> {
  try {
    await saveLocalBackup(items);
    const check = await getLocalBackup();
    const saved = new Set(check?.items.map((i) => i.url));
    if (!check || check.items.length !== items.length || !items.every((i) => saved.has(i.url))) {
      throw new Error('the saved copy did not match when read back');
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Skipped converting your reading list: couldn't save a safety backup first (${reason}). ` +
        `Your data hasn't been touched - export it from Options, then reopen this page.`,
    );
  }
}

// Converts the pre-bucketing one-key-per-URL layout. The legacy layout is
// ~50% bigger than buckets, so a list that grew until the old extension hit
// the quota has no room to write buckets alongside it (see AGENTS.md). So
// the local backup, not sync, is what keeps the data safe while converting:
// 1. copy the legacy items to chrome.storage.local and read them back,
// 2. flag the conversion as pending, also in chrome.storage.local,
// 3. remove the legacy keys from sync,
// 4. write every bucket in one set() - all or nothing,
// 5. clear the flag.
// The popup can close at any moment (clicking away closes it), so if a load
// finds the flag still set, it finishes the job from the backup. If step 4
// fails, the legacy keys are put back from the backup - they fit before.
async function convertLegacyItems(
  all: Record<string, unknown>,
  legacyKeys: string[],
  resuming: boolean,
): Promise<void> {
  const log: MigrationLog = {
    startedAt: Date.now(),
    resumed: resuming,
    legacyItems: legacyKeys.length,
    legacyBytes: legacyKeys.reduce((n, k) => n + entryBytes(k, all[k]), 0),
    serializedBytesBefore: utf8ByteLength(JSON.stringify(all)),
    outcome: 'failed',
  };
  try {
    // A resumed conversion's legacy keys may already be gone from sync, so
    // the backup saved by the interrupted attempt is the source - never
    // overwrite it with what's (no longer) in sync.
    let legacyItems: ListItemData[];
    if (resuming) {
      const backup = await getLocalBackup();
      if (!backup) throw new Error('A conversion was interrupted and its local backup is missing');
      legacyItems = mergeByUrl(
        legacyKeys.map((k) => all[k] as ListItemData),
        backup.items,
      );
    } else {
      legacyItems = legacyKeys.map((k) => all[k] as ListItemData);
      await backUpLegacyItems(legacyItems);
    }

    const bucketItems = decodeAllBuckets(all);
    const oldBucketKeys = Object.keys(all).filter((k) => BUCKET_KEY_RE.test(k));
    const items = mergeByUrl(bucketItems, legacyItems);
    const plan = planBuckets(items);
    log.bucketCount = plan.bucketCount;

    // Everything that will be in sync afterwards, checked against the total
    // quota the way Firefox enforces it (the whole object serialized) before
    // anything is removed.
    const after: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(all)) {
      if (!LEGACY_KEY_RE.test(k) && !BUCKET_KEY_RE.test(k)) after[k] = v;
    }
    Object.assign(after, plan.toWrite);
    const quotaBytes = chrome.storage.sync.QUOTA_BYTES ?? 102400;
    const afterBytes = utf8ByteLength(JSON.stringify(after));
    if (afterBytes > quotaBytes) {
      throw new Error(`Converted list would need ${afterBytes} of ${quotaBytes} bytes`);
    }

    await setConversionPending();
    if (legacyKeys.length > 0) await chrome.storage.sync.remove(legacyKeys);
    try {
      await chrome.storage.sync.set(plan.toWrite);
      const check = await chrome.storage.sync.get(Object.keys(plan.toWrite));
      for (const [k, v] of Object.entries(plan.toWrite)) {
        if (check[k] !== v) throw new Error(`Conversion verification failed for ${k}`);
      }
    } catch (err) {
      // Put back every legacy item that isn't already in a bucket. If even
      // that fails, the pending flag stays set so the next load retries from
      // the backup.
      const inBuckets = new Set(bucketItems.map((i) => i.url));
      const restore = Object.fromEntries(
        legacyItems.filter((i) => !inBuckets.has(i.url)).map((i) => [i.url, i]),
      );
      await chrome.storage.sync.set(restore);
      log.restored = true;
      await clearConversionPending();
      throw err;
    }

    const stale = oldBucketKeys.filter((k) => !(k in plan.toWrite));
    if (stale.length > 0) await chrome.storage.sync.remove(stale);
    await clearConversionPending();
    log.outcome = 'succeeded';
  } catch (err) {
    log.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw err;
  } finally {
    log.finishedAt = Date.now();
    await saveMigrationLog(log).catch(() => {});
  }
}

export interface LoadResult {
  items: ListItemData[];
  bucketCount: number;
}

async function loadAllBuckets(): Promise<LoadResult> {
  try {
    let all = await chrome.storage.sync.get(null);
    const legacyKeys = Object.keys(all).filter((k) => LEGACY_KEY_RE.test(k));
    const resuming = (await getConversionPending()) !== null;
    if (legacyKeys.length > 0 || resuming) {
      await convertLegacyItems(all, legacyKeys, resuming);
      all = await chrome.storage.sync.get(null);
    }

    // Re-groups when the list's size calls for a different bucket count than
    // the one on record (__bv). A URL's bucket is hash(url) % bucketCount, so
    // every item has to move together - one set() of every bucket, then the
    // keys that fall out of range are removed.
    const bucketKeys = Object.keys(all).filter((k) => BUCKET_KEY_RE.test(k));
    const items = decodeAllBuckets(all);
    const stored = all[BUCKET_VERSION_KEY];
    let plan: BucketPlan;
    try {
      plan = planBuckets(items);
    } catch (err) {
      // Whatever is on record is still readable; don't break loading over
      // a regroup that can't happen.
      if (typeof stored === 'number') {
        await markLoadErrorResolved().catch(() => {});
        return { items, bucketCount: stored };
      }
      throw err;
    }
    if (stored !== plan.bucketCount) {
      await chrome.storage.sync.set(plan.toWrite);
      const stale = bucketKeys.filter((k) => !(k in plan.toWrite));
      if (stale.length > 0) await chrome.storage.sync.remove(stale);
    }

    await markLoadErrorResolved().catch(() => {});
    return { items, bucketCount: plan.bucketCount };
  } catch (err) {
    await saveLoadError(err).catch(() => {});
    throw err;
  }
}

export const getItemsRemote = async (): Promise<LoadResult> => {
  return loadAllBuckets();
};

// Reads whatever is in storage as-is - already-bucketed items plus any
// still-unmigrated legacy items - without converting or rebalancing. A failed migration write (e.g. QuotaExceededError)
// can leave getItemsRemote() permanently throwing, but export shouldn't need a
// successful write to read data that's already sitting safely in storage.
export const getItemsReadOnly = async (): Promise<ListItemData[]> => {
  const all = await chrome.storage.sync.get(null);
  let listItems: ListItemData[] = [];
  for (const key in all) {
    if (BUCKET_KEY_RE.test(key)) {
      listItems.push(...decodeBucket(all[key]));
    } else if (LEGACY_KEY_RE.test(key)) {
      listItems.push(all[key] as ListItemData);
    }
  }
  // Mid-conversion, some items may only be in the local backup.
  if (await getConversionPending()) {
    listItems = mergeByUrl(listItems, (await getLocalBackup())?.items ?? []);
  }
  listItems.sort((a, b) => b.addedAt - a.addedAt);
  return listItems;
};
