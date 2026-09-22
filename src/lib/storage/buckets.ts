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

// Items are grouped into a fixed number of storage keys ("buckets") instead
// of one key per item. chrome.storage.sync caps the item COUNT at 512 keys
// regardless of their size, so storing one key per bookmark hard-caps the
// list at 512 entries. Hashing each URL into one of BUCKET_COUNT buckets and
// storing a compressed array of items per bucket removes that per-item key
// limit; the effective cap becomes the ~100KB total byte quota instead.
//
// BUCKET_COUNT is deliberately small (not 512): LZ-style compression only
// pays off when there's redundant text within a single compressed blob
// (repeated property names, similar URLs, etc). Too few buckets and
// individual buckets hit the 8KB-per-bucket quota before the 100KB total is
// used; too many and each blob is too small for compression to help, plus
// fixed per-blob overhead multiplies. 40 sits reasonably on that curve, but
// was tuned against synthetic ~88-byte items - real items run ~250+
// bytes/item once real URLs/titles are counted (see the "Verified capacity"
// note in AGENTS.md), and a quick simulation against that realistic sizing
// suggests something closer to 25 buckets may fit meaningfully more. Not
// yet changed; re-verify with `rebalanceBucketsIfNeeded()` before touching
// this constant either way.
export const BUCKET_COUNT = 40;
export const BUCKET_KEY_RE = /^b\d+$/;
export const BUCKET_VERSION_KEY = '__bv';

function hashUrl(url: string): number {
  // FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % BUCKET_COUNT;
}

export function bucketKey(url: string): string {
  return `b${hashUrl(url)}`;
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
