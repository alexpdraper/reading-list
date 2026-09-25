import { ListItemData } from './buckets.js';

const LOCAL_BACKUP_KEY = 'legacyBackup';

interface LocalBackup {
  items: ListItemData[];
  savedAt: number;
}

export async function saveLocalBackup(items: ListItemData[]): Promise<void> {
  const backup: LocalBackup = { items, savedAt: Date.now() };
  await chrome.storage.local.set({ [LOCAL_BACKUP_KEY]: backup });
}

export async function getLocalBackup(): Promise<LocalBackup | null> {
  const stored = await chrome.storage.local.get(LOCAL_BACKUP_KEY);
  return (stored[LOCAL_BACKUP_KEY] as LocalBackup | undefined) ?? null;
}

const LOAD_ERROR_KEY = 'lastLoadError';

interface StoredLoadError {
  name: string;
  message: string;
  occurredAt: number;
}

export async function saveLoadError(err: unknown): Promise<void> {
  const stored: StoredLoadError = {
    name: err instanceof Error ? err.name : typeof err,
    message: err instanceof Error ? err.message : String(err),
    occurredAt: Date.now(),
  };
  await chrome.storage.local.set({ [LOAD_ERROR_KEY]: stored });
}

export async function getLoadError(): Promise<StoredLoadError | null> {
  const stored = await chrome.storage.local.get(LOAD_ERROR_KEY);
  return (stored[LOAD_ERROR_KEY] as StoredLoadError | undefined) ?? null;
}
