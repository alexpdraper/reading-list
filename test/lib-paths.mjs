const LIB_DIR = new URL('../extension/scripts/lib/', import.meta.url);
const STORAGE_DIR = new URL('storage/', LIB_DIR);

export const RL_URL = new URL('rl.js', LIB_DIR).href;
export const BUCKETS_URL = new URL('buckets.js', STORAGE_DIR).href;
export const MIGRATIONS_URL = new URL('migrations.js', STORAGE_DIR).href;
export const LOCAL_BACKUP_URL = new URL('local-backup.js', STORAGE_DIR).href;
export const DIAGNOSTICS_URL = new URL('diagnostics.js', STORAGE_DIR).href;
