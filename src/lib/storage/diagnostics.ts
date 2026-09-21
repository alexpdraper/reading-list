import { BUCKET_COUNT, BUCKET_KEY_RE, decodeBucket, utf8ByteLength } from './buckets.js';
import { BUILD_TAG } from '../build-info.js';

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
    `Build: ${BUILD_TAG}`,
    `Items: ${itemCount}`,
    `Buckets used: ${bucketCount} / ${BUCKET_COUNT}`,
    `Bytes in use (browser-reported): ${bytesInUse} / ${quotaBytes}`,
    `Bytes in use (manual estimate): ${manualBytes} / ${quotaBytes}`,
    `Largest bucket: ${largestBucketKey || 'n/a'} at ${largestBucketBytes} bytes / ${quotaBytesPerItem}`,
  ].join('\n');
}
