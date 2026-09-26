export interface ListItemData {
  addedAt: number;
  title: string;
  url: string;
  favIconUrl?: string;
  viewed?: boolean;
  index?: number;
}

export type SyncData = Record<string, unknown>;

export interface SyncWrite {
  set: SyncData;
  remove: string[];
}

export interface StoreLayout {
  data: SyncData;
  bucketCount?: number;
}

export interface ItemStore {
  readonly name: 'buckets' | 'flat';
  ownsKey(key: string): boolean;
  readItems(data: SyncData): ListItemData[];
  layout(items: ListItemData[]): StoreLayout;
  planUpsert(items: ListItemData[]): Promise<SyncWrite>;
  planRemove(urls: string[]): Promise<SyncWrite>;
  afterLoad(data: SyncData, items: ListItemData[]): Promise<void>;
}

export class StorageFullError extends Error {
  override name = 'StorageFullError';
}

export const syncQuotaBytes = (): number =>
  chrome.storage.sync.QUOTA_BYTES ?? 102400;
export const syncQuotaBytesPerKey = (): number =>
  chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8192;

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function syncBytes(key: string, value: unknown): number {
  return utf8ByteLength(key) + utf8ByteLength(JSON.stringify(value));
}

export async function writeSync({ set, remove }: SyncWrite): Promise<void> {
  if (Object.keys(set).length > 0) await chrome.storage.sync.set(set);
  if (remove.length > 0) await chrome.storage.sync.remove(remove);
}

export function mergeByUrl(
  primary: ListItemData[],
  secondary: ListItemData[],
): ListItemData[] {
  const seen = new Set(primary.map((item) => item.url));
  return [...primary, ...secondary.filter((item) => !seen.has(item.url))];
}
