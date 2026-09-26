import LZString from 'lz-string';

export function utf8ByteLength(str: string): number {
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

// Items are grouped into a variable number of storage keys ("buckets")
// instead of one key per item, so chrome.storage.sync's 512-key cap never
// limits the list - see AGENTS.md's Storage architecture section for the
// full rationale and the "Verified capacity" numbers this was tuned against.
//
// The bucket count isn't fixed: fewer, fuller buckets compress better (LZ
// compression needs redundant text within one blob), so bucketCountForItemCount
// picks the smallest count that suits the list's current size. But a
// size-based guess alone can't catch an actual collision - a list stuck at,
// say, 150 items whose URLs happen to cluster badly into one bucket would
// keep computing the same answer forever, even while that one bucket is
// actually failing. BUCKET_COUNT_LADDER exists for that: when a bucket write
// actually fails (migrations.ts), the caller retries at the next count up the
// ladder instead of accepting the size-based guess as final.
//
// Every size tier below deliberately stops one rung short of MAX_BUCKET_COUNT,
// so every list size keeps at least one rung of real escalation room above its
// starting guess - a list whose size alone would otherwise start already at
// the ceiling has nowhere left to retry if that specific guess collides.
export const MIN_BUCKET_COUNT = 25;
export const MAX_BUCKET_COUNT = 40;
export const BUCKET_COUNT_LADDER = [25, 30, 35, 40];
export const BUCKET_KEY_RE = /^b\d+$/;
export const BUCKET_VERSION_KEY = '__bv';
// Pre-bucketing layout: one key per item, keyed by its URL.
export const LEGACY_KEY_RE = /^https?:\/\//i;

// Starting guess, not a guarantee - see BUCKET_COUNT_LADDER above for what
// happens when this guess turns out to be wrong for the actual data. 150 and
// 250 are chosen so a list only reaches 35 (one rung below MAX_BUCKET_COUNT)
// once it's already approaching the documented ~325-item real capacity
// ceiling, keeping the top rung free for escalation.
export function bucketCountForItemCount(itemCount: number): number {
  if (itemCount <= 150) return MIN_BUCKET_COUNT;
  if (itemCount <= 250) return 30;
  return 35;
}

function hashUrl(url: string, bucketCount: number): number {
  // FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % bucketCount;
}

export function bucketKey(url: string, bucketCount: number): string {
  return `b${hashUrl(url, bucketCount)}`;
}

export function decodeBucket(raw: unknown): ListItemData[] {
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

export function encodeBucket(items: ListItemData[]): string {
  return LZString.compressToBase64(JSON.stringify(items));
}

export async function readBucket(key: string): Promise<ListItemData[]> {
  const stored = await chrome.storage.sync.get(key);
  return decodeBucket(stored[key]);
}

export async function writeBucket(key: string, items: ListItemData[]): Promise<void> {
  if (items.length === 0) {
    await chrome.storage.sync.remove(key);
    return;
  }
  await chrome.storage.sync.set({ [key]: encodeBucket(items) });
}
