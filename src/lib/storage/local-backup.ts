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
  // Set by the first successful load after the error, so Storage
  // Diagnostics doesn't present an already-fixed failure as current.
  resolvedAt?: number;
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

// Only writes when there's an unresolved error, so a normal load costs one
// chrome.storage.local read.
export async function markLoadErrorResolved(): Promise<void> {
  const err = await getLoadError();
  if (!err || err.resolvedAt) return;
  await chrome.storage.local.set({
    [LOAD_ERROR_KEY]: { ...err, resolvedAt: Date.now() },
  });
}

const MIGRATION_LOG_KEY = 'lastMigration';

// A record of the last legacy-format conversion, shown in Storage
// Diagnostics. Deliberately counts and sizes only - no URLs or titles - so a
// user can send it without exposing their list.
export interface MigrationLog {
  startedAt: number;
  finishedAt?: number;
  // Finishing a conversion an earlier load started but didn't complete.
  resumed: boolean;
  legacyItems: number;
  legacyBytes: number;
  // Length of the whole serialized storage object, which is what Firefox
  // actually enforces QUOTA_BYTES against (getBytesInUse() is smaller).
  serializedBytesBefore: number;
  bucketCount?: number;
  // The bucket write failed and the legacy keys were written back.
  restored?: boolean;
  outcome: 'succeeded' | 'failed';
  error?: string;
}

export async function saveMigrationLog(log: MigrationLog): Promise<void> {
  await chrome.storage.local.set({ [MIGRATION_LOG_KEY]: log });
}

export async function getMigrationLog(): Promise<MigrationLog | null> {
  const stored = await chrome.storage.local.get(MIGRATION_LOG_KEY);
  return (stored[MIGRATION_LOG_KEY] as MigrationLog | undefined) ?? null;
}

// Set between removing legacy keys from sync and writing their buckets, the
// only window where some items exist only in the local backup. A load that
// finds it set finishes the conversion from the backup.
const CONVERSION_PENDING_KEY = 'conversionPending';

export async function setConversionPending(): Promise<void> {
  await chrome.storage.local.set({
    [CONVERSION_PENDING_KEY]: { since: Date.now() },
  });
}

export async function clearConversionPending(): Promise<void> {
  await chrome.storage.local.remove(CONVERSION_PENDING_KEY);
}

export async function getConversionPending(): Promise<{
  since: number;
} | null> {
  const stored = await chrome.storage.local.get(CONVERSION_PENDING_KEY);
  return (
    (stored[CONVERSION_PENDING_KEY] as { since: number } | undefined) ?? null
  );
}
