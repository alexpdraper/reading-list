const LIB_DIR = new URL('../extension/scripts/lib/', import.meta.url);

export const RL_URL = new URL('rl.js', LIB_DIR).href;
export const BUCKETS_URL = new URL('buckets.js', LIB_DIR).href;
export const MIGRATIONS_URL = new URL('buckets.js', LIB_DIR).href;
export const LOCAL_BACKUP_URL = new URL('buckets.js', LIB_DIR).href;
export const DIAGNOSTICS_URL = new URL('buckets.js', LIB_DIR).href;
