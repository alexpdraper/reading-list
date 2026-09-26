import { ListItemData, loadItems, saveItems, clearItems, onItemsChanged } from './buckets.js';

function stripOversizedDataUriFavicon(item: ListItemData): ListItemData {
  return item.favIconUrl?.startsWith('data:') ? { ...item, favIconUrl: undefined } : item;
}

function normalizeItemForStorage(item: ListItemData): ListItemData {
  if (!/^https?:\/\//i.test(item.url)) {
    throw new Error(`Unsupported URL scheme: ${item.url}`);
  }
  return stripOversizedDataUriFavicon(item);
}

class RL {
  private list: ListItemData[] = [];
  private initialized = false;
  private subscribers = new Set<(list: ListItemData[]) => void>();
  private reloadGeneration = 0;

  constructor() {
    onItemsChanged(() => void this.reloadFromRemoteChange());
  }

  subscribe(callback: (list: ListItemData[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    for (const callback of this.subscribers) callback(this.list);
  }

  private async fetchItems(): Promise<ListItemData[]> {
    if (!chrome) return [];
    const items = await loadItems();
    items.sort((a, b) => b.addedAt - a.addedAt);
    return items;
  }

  private async reloadFromRemoteChange() {
    const startedDuringGeneration = ++this.reloadGeneration;
    this.initialized = false;
    const items = await this.fetchItems();
    if (startedDuringGeneration !== this.reloadGeneration) return;
    this.list = items;
    this.initialized = true;
    this.notifySubscribers();
  }

  async getListItems() {
    if (!this.initialized) {
      this.list = await this.fetchItems();
      this.initialized = true;
    }

    return this.list;
  }

  private lowestExistingIndex(): number {
    let min = 0;
    for (const item of this.list) {
      if (item.index != null && item.index < min) min = item.index;
    }
    return min;
  }

  private async persist(touchedUrls: string[]): Promise<{ ok: boolean; error?: unknown }> {
    try {
      await saveItems(this.list, touchedUrls);
      this.notifySubscribers();
      return { ok: true };
    } catch (error) {
      console.error('Failed to save reading list', error);
      return { ok: false, error };
    }
  }

  async addReadingItem(listItem: ListItemData): Promise<ListItemData | null> {
    if (!this.initialized) await this.getListItems();
    listItem = normalizeItemForStorage(listItem);
    listItem = { ...listItem, index: this.lowestExistingIndex() - 1 };

    const previousList = this.list;
    this.list = [listItem, ...this.list.filter((item) => item.url !== listItem.url)];

    const { ok } = await this.persist([listItem.url]);
    if (!ok) {
      this.list = previousList;
      this.notifySubscribers();
      return null;
    }
    return listItem;
  }

  async bulkAddReadingItems(
    rawItems: ListItemData[],
  ): Promise<{ succeeded: number; failed: number; firstError: unknown }> {
    if (!this.initialized) await this.getListItems();

    const BATCH_SIZE = 25;
    let succeeded = 0;
    let firstError: unknown = null;

    const importInsertionBaseIndex = this.lowestExistingIndex();

    for (let i = 0; i < rawItems.length; i += BATCH_SIZE) {
      const batch = rawItems.slice(i, i + BATCH_SIZE);
      const validated: ListItemData[] = [];
      batch.forEach((raw, j) => {
        try {
          const item = normalizeItemForStorage(raw);
          validated.push({ ...item, index: importInsertionBaseIndex - rawItems.length + i + j });
        } catch (err) {
          firstError ??= err;
        }
      });

      const previousList = this.list;
      for (const item of validated) {
        this.list = [item, ...this.list.filter((existing) => existing.url !== item.url)];
      }

      const { ok, error } = await this.persist(validated.map((item) => item.url));
      if (!ok) {
        this.list = previousList;
        this.notifySubscribers();
        firstError ??= error;
        break;
      }
      succeeded += validated.length;
    }

    return { succeeded, failed: rawItems.length - succeeded, firstError };
  }

  async removeReadingItem(url: string): Promise<boolean> {
    if (!this.initialized) await this.getListItems();

    const previousList = this.list;
    this.list = this.list.filter((item) => item.url !== url);

    const { ok } = await this.persist([url]);
    if (!ok) {
      this.list = previousList;
      this.notifySubscribers();
    }
    return ok;
  }

  async updateReadingItem(url: string, updates: Partial<ListItemData>): Promise<boolean> {
    if (!this.initialized) await this.getListItems();
    const item = this.list.find((item) => item.url === url);
    if (!item) return false;

    const isNoop = (Object.keys(updates) as (keyof ListItemData)[]).every(
      (key) => item[key] === updates[key],
    );
    if (isNoop) return true;

    const previous = { ...item };
    Object.assign(item, updates);

    const { ok } = await this.persist([url]);
    if (!ok) {
      Object.assign(item, previous);
      this.notifySubscribers();
    }
    return ok;
  }

  async reorderItems(orderedUrls: string[]): Promise<boolean> {
    if (!this.initialized) await this.getListItems();
    const indexByUrl = new Map(orderedUrls.map((url, index) => [url, index]));
    const touchedUrls: string[] = [];
    const previousIndices = new Map<ListItemData, number | undefined>();
    for (const item of this.list) {
      const index = indexByUrl.get(item.url);
      if (index === undefined) continue;
      previousIndices.set(item, item.index);
      item.index = index;
      touchedUrls.push(item.url);
    }
    if (touchedUrls.length === 0) return true;

    const { ok } = await this.persist(touchedUrls);
    if (!ok) {
      for (const [item, index] of previousIndices) item.index = index;
      this.notifySubscribers();
    }
    return ok;
  }

  async clearAll() {
    await clearItems();
    this.list = [];
    this.initialized = true;
    this.notifySubscribers();
  }
}

export const rl = new RL();
