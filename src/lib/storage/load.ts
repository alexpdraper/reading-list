import { bucketStore } from './bucket-store.js';
import { flatStore } from './flat-store.js';
import {
  ConversionLog,
  finishConversion,
  getLocalBackup,
  getPendingConversionSince,
  markLoadErrorResolved,
  saveBackupBeforeConversion,
  saveConversionLog,
  saveLoadError,
} from './local-backup.js';
import {
  ItemStore,
  ListItemData,
  mergeByUrl,
  StorageFullError,
  SyncData,
  syncBytes,
  syncQuotaBytes,
  utf8ByteLength,
  writeSync,
} from './store.js';

export const PREFERRED_STORE: ItemStore = bucketStore;
export const OTHER_STORE: ItemStore =
  PREFERRED_STORE === bucketStore ? flatStore : bucketStore;

export interface LoadResult {
  items: ListItemData[];
  store: ItemStore;
}

export async function loadItems(): Promise<LoadResult> {
  try {
    let data = await chrome.storage.sync.get(null);
    let store = PREFERRED_STORE;
    const interrupted = (await getPendingConversionSince()) !== null;
    if (interrupted || Object.keys(data).some(OTHER_STORE.ownsKey)) {
      const converted = await convertToPreferred(data, interrupted);
      if (converted) data = await chrome.storage.sync.get(null);
      else store = OTHER_STORE;
    }
    const items = store.readItems(data);
    await store.afterLoad(data, items);
    await markLoadErrorResolved().catch(() => {});
    return { items, store };
  } catch (err) {
    await saveLoadError(err).catch(() => {});
    throw err;
  }
}

export async function readItemsWithoutWriting(): Promise<ListItemData[]> {
  const data = await chrome.storage.sync.get(null);
  let items = [
    ...PREFERRED_STORE.readItems(data),
    ...OTHER_STORE.readItems(data),
  ];
  if ((await getPendingConversionSince()) !== null) {
    items = mergeByUrl(items, (await getLocalBackup())?.items ?? []);
  }
  return items.sort((a, b) => b.addedAt - a.addedAt);
}

async function interruptedItems(): Promise<ListItemData[]> {
  const backup = await getLocalBackup();
  if (!backup)
    throw new Error(
      'A conversion was interrupted and its local backup is missing',
    );
  return backup.items;
}

async function backUp(items: ListItemData[]): Promise<void> {
  try {
    await saveBackupBeforeConversion(items);
    const saved = new Set(
      (await getLocalBackup())?.items.map((item) => item.url),
    );
    if (
      saved.size !== new Set(items.map((item) => item.url)).size ||
      !items.every((item) => saved.has(item.url))
    ) {
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

function assertFitsTotalQuota(data: SyncData, layout: SyncData): void {
  const after: SyncData = {};
  for (const [key, value] of Object.entries(data)) {
    if (!PREFERRED_STORE.ownsKey(key) && !OTHER_STORE.ownsKey(key))
      after[key] = value;
  }
  Object.assign(after, layout);
  const bytes = utf8ByteLength(JSON.stringify(after));
  if (bytes > syncQuotaBytes()) {
    throw new StorageFullError(
      `Converted list would need ${bytes} of ${syncQuotaBytes()} bytes`,
    );
  }
}

async function writeVerified(data: SyncData): Promise<void> {
  await chrome.storage.sync.set(data);
  const check = await chrome.storage.sync.get(Object.keys(data));
  for (const [key, value] of Object.entries(data)) {
    if (JSON.stringify(check[key]) !== JSON.stringify(value)) {
      throw new Error(`Conversion verification failed for ${key}`);
    }
  }
}

async function convertToPreferred(
  data: SyncData,
  resuming: boolean,
): Promise<boolean> {
  const from = OTHER_STORE;
  const to = PREFERRED_STORE;
  const fromKeys = Object.keys(data).filter(from.ownsKey);
  const log: ConversionLog = {
    startedAt: Date.now(),
    resumed: resuming,
    legacyItems: from.readItems(data).length,
    legacyBytes: fromKeys.reduce(
      (total, key) => total + syncBytes(key, data[key]),
      0,
    ),
    serializedBytesBefore: utf8ByteLength(JSON.stringify(data)),
    outcome: 'failed',
  };
  const fromItems = resuming
    ? mergeByUrl(from.readItems(data), await interruptedItems())
    : from.readItems(data);
  const alreadyConverted = to.readItems(data);
  const needsRestore = () => {
    const converted = new Set(alreadyConverted.map((item) => item.url));
    return fromItems.filter((item) => !converted.has(item.url));
  };

  try {
    const layout = to.layout(mergeByUrl(alreadyConverted, fromItems));
    log.bucketCount = layout.bucketCount;
    assertFitsTotalQuota(data, layout.data);

    if (!resuming) await backUp(fromItems);
    try {
      await writeSync({ set: {}, remove: fromKeys });
      await writeVerified(layout.data);
    } catch (err) {
      await chrome.storage.sync.set(from.layout(needsRestore()).data);
      log.restored = true;
      await finishConversion();
      throw err;
    }

    const stale = Object.keys(data).filter(
      (key) => to.ownsKey(key) && !(key in layout.data),
    );
    if (stale.length > 0) await chrome.storage.sync.remove(stale);
    await finishConversion();
    log.outcome = 'succeeded';
    return true;
  } catch (err) {
    log.error =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    if (!(err instanceof StorageFullError)) throw err;
    if (resuming) {
      await chrome.storage.sync.set(from.layout(needsRestore()).data);
      log.restored = true;
      await finishConversion();
    }
    log.outcome = 'blocked';
    return false;
  } finally {
    log.finishedAt = Date.now();
    await saveConversionLog(log).catch(() => {});
  }
}
