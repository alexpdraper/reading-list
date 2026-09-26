import { ListItemData } from './store.js';

const BACKUP_KEY = 'legacyBackup';
const PENDING_KEY_FROM_3_3 = 'conversionPending';
const LOAD_ERROR_KEY = 'lastLoadError';
const CONVERSION_LOG_KEY = 'lastMigration';

export interface LocalBackup {
  items: ListItemData[];
  savedAt: number;
  pendingSince?: number;
}

export interface StoredLoadError {
  name: string;
  message: string;
  occurredAt: number;
  resolvedAt?: number;
}

export interface ConversionLog {
  startedAt: number;
  finishedAt?: number;
  resumed: boolean;
  legacyItems: number;
  legacyBytes: number;
  serializedBytesBefore: number;
  bucketCount?: number;
  restored?: boolean;
  outcome: 'succeeded' | 'failed' | 'blocked';
  error?: string;
}

async function readLocal<T>(key: string): Promise<T | null> {
  const stored = await chrome.storage.local.get(key);
  return (stored[key] as T | undefined) ?? null;
}

export const getLocalBackup = () => readLocal<LocalBackup>(BACKUP_KEY);

export async function saveBackupBeforeConversion(
  items: ListItemData[],
): Promise<void> {
  const now = Date.now();
  const backup: LocalBackup = { items, savedAt: now, pendingSince: now };
  await chrome.storage.local.set({ [BACKUP_KEY]: backup });
}

export async function getPendingConversionSince(): Promise<number | null> {
  const backup = await getLocalBackup();
  if (backup?.pendingSince) return backup.pendingSince;
  return (
    (await readLocal<{ since: number }>(PENDING_KEY_FROM_3_3))?.since ?? null
  );
}

export async function finishConversion(): Promise<void> {
  const backup = await getLocalBackup();
  if (backup?.pendingSince) {
    await chrome.storage.local.set({
      [BACKUP_KEY]: { items: backup.items, savedAt: backup.savedAt },
    });
  }
  await chrome.storage.local.remove(PENDING_KEY_FROM_3_3);
}

export const getLoadError = () => readLocal<StoredLoadError>(LOAD_ERROR_KEY);

export async function saveLoadError(err: unknown): Promise<void> {
  const stored: StoredLoadError = {
    name: err instanceof Error ? err.name : typeof err,
    message: err instanceof Error ? err.message : String(err),
    occurredAt: Date.now(),
  };
  await chrome.storage.local.set({ [LOAD_ERROR_KEY]: stored });
}

export async function markLoadErrorResolved(): Promise<void> {
  const err = await getLoadError();
  if (!err || err.resolvedAt) return;
  await chrome.storage.local.set({
    [LOAD_ERROR_KEY]: { ...err, resolvedAt: Date.now() },
  });
}

export const getConversionLog = () =>
  readLocal<ConversionLog>(CONVERSION_LOG_KEY);

export async function saveConversionLog(log: ConversionLog): Promise<void> {
  await chrome.storage.local.set({ [CONVERSION_LOG_KEY]: log });
}
