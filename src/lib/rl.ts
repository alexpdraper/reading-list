import { loadItems, PREFERRED_STORE } from './storage/load.js';
import {
  ItemStore,
  ListItemData,
  syncBytes,
  writeSync,
} from './storage/store.js';

const LIST_CHANGED_MESSAGE = 'reading-list:changed';
const IMPORT_BATCH_SIZE = 25;

export interface ImportResult {
  succeeded: number;
  failed: number;
  firstError: unknown;
  diagnostics: string;
}

function assertHttpUrl(url: string): void {
  if (!/^https?:\/\//i.test(url))
    throw new Error(`Unsupported URL scheme: ${url}`);
}

function withoutDataFavicon(item: ListItemData): ListItemData {
  return item.favIconUrl?.startsWith('data:')
    ? { ...item, favIconUrl: undefined }
    : item;
}

function toStoredItem(item: ListItemData, index: number): ListItemData {
  assertHttpUrl(item.url);
  return { ...withoutDataFavicon(item), index };
}

const newestFirst = (a: ListItemData, b: ListItemData) => b.addedAt - a.addedAt;

class RL {
  private list: ListItemData[] = [];
  private store: ItemStore = PREFERRED_STORE;
  private loaded = false;
  private reloadGeneration = 0;
  private subscribers = new Set<() => void>();

  constructor() {
    chrome?.runtime?.onMessage?.addListener((message: unknown) => {
      if (
        (message as { kind?: unknown } | null)?.kind === LIST_CHANGED_MESSAGE
      ) {
        void this.reloadAfterRemoteChange();
      }
    });
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async getListItems(): Promise<ListItemData[]> {
    if (!this.loaded) {
      const { items, store } = await loadItems();
      this.store = store;
      this.list = items.sort(newestFirst);
      this.loaded = true;
    }
    return this.list;
  }

  private async reloadAfterRemoteChange() {
    const generation = ++this.reloadGeneration;
    this.loaded = false;
    const { items, store } = await loadItems();
    if (generation !== this.reloadGeneration) return;
    this.store = store;
    this.list = items.sort(newestFirst);
    this.loaded = true;
    for (const callback of this.subscribers) callback();
  }

  private broadcastChange() {
    void chrome?.runtime
      ?.sendMessage?.({ kind: LIST_CHANGED_MESSAGE })
      ?.catch(() => {});
  }

  private topIndex(): number {
    return Math.min(0, ...this.list.map((item) => item.index ?? 0));
  }

  private replaceItems(items: ListItemData[]) {
    const byUrl = new Map(items.map((item) => [item.url, item]));
    this.list = [
      ...[...byUrl.values()].reverse(),
      ...this.list.filter((item) => !byUrl.has(item.url)),
    ];
  }

  async addReadingItem(item: ListItemData): Promise<ListItemData> {
    await this.getListItems();
    const stored = toStoredItem(item, this.topIndex() - 1);
    await writeSync(await this.store.planUpsert([stored]));
    this.replaceItems([stored]);
    this.broadcastChange();
    return stored;
  }

  async bulkAddReadingItems(rawItems: ListItemData[]): Promise<ImportResult> {
    await this.getListItems();
    const firstIndex = this.topIndex() - rawItems.length;
    let succeeded = 0;
    let firstError: unknown = null;
    let bytesWrittenSoFar = 0;
    let diagnostics = '';

    for (let start = 0; start < rawItems.length; start += IMPORT_BATCH_SIZE) {
      const batch: ListItemData[] = [];
      rawItems
        .slice(start, start + IMPORT_BATCH_SIZE)
        .forEach((raw, offset) => {
          try {
            batch.push(toStoredItem(raw, firstIndex + start + offset));
          } catch (err) {
            firstError ??= err;
          }
        });

      const write = await this.store.planUpsert(batch);
      const keyBytes = Object.entries(write.set).map(([key, value]) =>
        syncBytes(key, value),
      );
      const batchBytes = keyBytes.reduce((total, bytes) => total + bytes, 0);
      try {
        await writeSync(write);
      } catch (err) {
        diagnostics =
          `at item ${start}/${rawItems.length}, ~${bytesWrittenSoFar}B written so far, ` +
          `this batch: ${keyBytes.length} keys / ~${batchBytes}B (largest key ~${Math.max(0, ...keyBytes)}B), ` +
          `error: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`;
        firstError ??= err;
        break;
      }
      bytesWrittenSoFar += batchBytes;
      this.replaceItems(batch);
      succeeded += batch.length;
    }

    if (succeeded > 0) this.broadcastChange();
    return {
      succeeded,
      failed: rawItems.length - succeeded,
      firstError,
      diagnostics,
    };
  }

  async removeReadingItem(url: string): Promise<void> {
    await this.getListItems();
    await writeSync(await this.store.planRemove([url]));
    this.list = this.list.filter((item) => item.url !== url);
    this.broadcastChange();
  }

  async updateReadingItem(
    url: string,
    updates: Partial<ListItemData>,
  ): Promise<void> {
    await this.getListItems();
    const item = this.list.find((existing) => existing.url === url);
    const changesSomething = (
      Object.keys(updates) as (keyof ListItemData)[]
    ).some((key) => item?.[key] !== updates[key]);
    if (!item || !changesSomething) return;
    const updated = { ...item, ...updates };
    await writeSync(await this.store.planUpsert([updated]));
    this.list = this.list.map((existing) =>
      existing.url === url ? updated : existing,
    );
    this.broadcastChange();
  }

  async reorderItems(orderedUrls: string[]): Promise<void> {
    await this.getListItems();
    const indexByUrl = new Map(orderedUrls.map((url, index) => [url, index]));
    const reordered = this.list
      .filter((item) => indexByUrl.has(item.url))
      .map((item) => ({ ...item, index: indexByUrl.get(item.url) }));
    if (reordered.length === 0) return;
    await writeSync(await this.store.planUpsert(reordered));
    const reorderedByUrl = new Map(reordered.map((item) => [item.url, item]));
    this.list = this.list.map((item) => reorderedByUrl.get(item.url) ?? item);
    this.broadcastChange();
  }

  async clearAll(): Promise<void> {
    await chrome.storage.sync.clear();
    this.list = [];
    this.loaded = true;
    this.broadcastChange();
  }
}

export const rl = new RL();
