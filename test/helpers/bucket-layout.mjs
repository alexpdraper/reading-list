import { BUCKETS_URL } from '../lib-paths.mjs';

const { testOnlyInternals } = await import(BUCKETS_URL);

export const { bucketKey, bucketCountForItemCount, decodeBucket, BUCKET_KEY_RE, BUCKET_VERSION_KEY } =
  testOnlyInternals;

export function snapshotSyncLayout(syncDump) {
  const bucketVersion = syncDump[BUCKET_VERSION_KEY] ?? null;
  const bucketKeys = Object.keys(syncDump)
    .filter((key) => BUCKET_KEY_RE.test(key))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  const itemUrlsByBucket = {};
  for (const key of bucketKeys) {
    itemUrlsByBucket[key] = decodeBucket(syncDump[key])
      .map((item) => item.url)
      .sort();
  }

  const otherKeys = Object.keys(syncDump)
    .filter((key) => key !== BUCKET_VERSION_KEY && !BUCKET_KEY_RE.test(key))
    .sort();

  return { bucketVersion, bucketKeys, itemUrlsByBucket, otherKeys };
}
