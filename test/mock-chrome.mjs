function utf8ByteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function itemByteSize(key, value) {
  return utf8ByteLength(key) + utf8ByteLength(JSON.stringify(value));
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeGetKeys(keysArg) {
  if (keysArg === null || keysArg === undefined) return null;
  if (typeof keysArg === 'string') return [keysArg];
  if (Array.isArray(keysArg)) return keysArg;
  if (typeof keysArg === 'object') return Object.keys(keysArg);
  throw new Error(`Unsupported chrome.storage.get() argument: ${String(keysArg)}`);
}

class ChangeEmitter {
  constructor() {
    this.listeners = new Set();
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  emit(changes, areaName) {
    if (Object.keys(changes).length === 0) return;
    for (const listener of this.listeners) listener(changes, areaName);
  }
}

function createLocalArea(onChanged) {
  let store = {};
  let failurePredicate = null;

  return {
    async get(keysArg) {
      const keys = normalizeGetKeys(keysArg);
      if (keys === null) return cloneValue(store);
      const result = {};
      for (const key of keys) {
        if (key in store) result[key] = cloneValue(store[key]);
      }
      return result;
    },

    async set(items) {
      if (failurePredicate) {
        const err = failurePredicate('set', items);
        if (err) throw err instanceof Error ? err : new Error(String(err));
      }
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        const oldValue = store[key];
        const hadKey = key in store;
        store[key] = cloneValue(value);
        changes[key] = hadKey
          ? { oldValue: cloneValue(oldValue), newValue: cloneValue(value) }
          : { newValue: cloneValue(value) };
      }
      onChanged.emit(changes, 'local');
    },

    async remove(keysArg) {
      const keys = Array.isArray(keysArg) ? keysArg : [keysArg];
      const changes = {};
      for (const key of keys) {
        if (!(key in store)) continue;
        changes[key] = { oldValue: cloneValue(store[key]) };
        delete store[key];
      }
      onChanged.emit(changes, 'local');
    },

    async clear() {
      const changes = {};
      for (const [key, value] of Object.entries(store)) {
        changes[key] = { oldValue: cloneValue(value) };
      }
      store = {};
      onChanged.emit(changes, 'local');
    },

    __dump() {
      return cloneValue(store);
    },

    __seed(fixture) {
      store = cloneValue(fixture) ?? {};
    },

    __setFailurePredicate(predicate) {
      failurePredicate = predicate;
    },
  };
}

const QUOTA_BYTES = 102400;
const QUOTA_BYTES_PER_ITEM = 8192;
const MAX_WRITE_OPERATIONS_PER_MINUTE = 120;

function quotaExceededError() {
  return new Error('QuotaExceededError: storage.sync API call exceeded its quota limitations.');
}

function writeRateError() {
  return new Error(
    'QuotaExceededError: MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded. storage.sync API call exceeded its quota limitations.',
  );
}

function createSyncArea(onChanged) {
  let store = {};
  let writeOpsThisWindow = 0;
  let setCallCount = 0;
  let removeCallCount = 0;
  let failurePredicate = null;

  function totalBytes(candidateStore) {
    let total = 0;
    for (const [key, value] of Object.entries(candidateStore)) {
      total += itemByteSize(key, value);
    }
    return total;
  }

  function checkFailurePredicate(kind, items) {
    if (!failurePredicate) return;
    const err = failurePredicate(kind, items);
    if (err) throw err instanceof Error ? err : new Error(String(err));
  }

  function consumeWriteOp() {
    if (writeOpsThisWindow >= MAX_WRITE_OPERATIONS_PER_MINUTE) {
      throw writeRateError();
    }
    writeOpsThisWindow += 1;
  }

  return {
    QUOTA_BYTES,
    QUOTA_BYTES_PER_ITEM,
    MAX_WRITE_OPERATIONS_PER_MINUTE,

    async get(keysArg) {
      const keys = normalizeGetKeys(keysArg);
      if (keys === null) return cloneValue(store);
      const result = {};
      for (const key of keys) {
        if (key in store) result[key] = cloneValue(store[key]);
      }
      return result;
    },

    async set(items) {
      checkFailurePredicate('set', items);
      consumeWriteOp();

      for (const [key, value] of Object.entries(items)) {
        const size = itemByteSize(key, value);
        if (size > QUOTA_BYTES_PER_ITEM) throw quotaExceededError();
      }

      const candidateStore = { ...store, ...items };
      if (totalBytes(candidateStore) > QUOTA_BYTES) throw quotaExceededError();

      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        const oldValue = store[key];
        const hadKey = key in store;
        changes[key] = hadKey
          ? { oldValue: cloneValue(oldValue), newValue: cloneValue(value) }
          : { newValue: cloneValue(value) };
      }
      store = candidateStore;
      setCallCount += 1;
      onChanged.emit(changes, 'sync');
    },

    async remove(keysArg) {
      const keys = Array.isArray(keysArg) ? keysArg : [keysArg];
      checkFailurePredicate('remove', keys);
      consumeWriteOp();

      const changes = {};
      for (const key of keys) {
        if (!(key in store)) continue;
        changes[key] = { oldValue: cloneValue(store[key]) };
        delete store[key];
      }
      removeCallCount += 1;
      onChanged.emit(changes, 'sync');
    },

    async clear() {
      const changes = {};
      for (const [key, value] of Object.entries(store)) {
        changes[key] = { oldValue: cloneValue(value) };
      }
      store = {};
      onChanged.emit(changes, 'sync');
    },

    async getBytesInUse(keysArg) {
      const keys = normalizeGetKeys(keysArg);
      if (keys === null) return totalBytes(store);
      let total = 0;
      for (const key of keys) {
        if (key in store) total += itemByteSize(key, store[key]);
      }
      return total;
    },

    __dump() {
      return cloneValue(store);
    },

    __seed(fixture) {
      store = cloneValue(fixture) ?? {};
    },

    __getWriteCounts() {
      return { set: setCallCount, remove: removeCallCount };
    },

    __resetWriteCounts() {
      setCallCount = 0;
      removeCallCount = 0;
    },

    __resetRateLimit() {
      writeOpsThisWindow = 0;
    },

    __setFailurePredicate(predicate) {
      failurePredicate = predicate;
    },
  };
}

export function installMockChrome() {
  const onChanged = new ChangeEmitter();
  const sync = createSyncArea(onChanged);
  const local = createLocalArea(onChanged);

  const runtimeListeners = new Set();

  const mockChrome = {
    storage: { sync, local, onChanged },
    runtime: {
      async sendMessage() {
        return undefined;
      },
      onMessage: {
        addListener(listener) {
          runtimeListeners.add(listener);
        },
        removeListener(listener) {
          runtimeListeners.delete(listener);
        },
      },
      getManifest() {
        return { version: 'test' };
      },
      getURL(path) {
        return `chrome-extension://test-extension-id/${path}`;
      },
    },
    i18n: {
      getMessage() {
        return '';
      },
    },
  };

  globalThis.chrome = mockChrome;
  return mockChrome;
}

export function resetMockChrome() {
  return installMockChrome();
}

export function getMockChrome() {
  return globalThis.chrome;
}

export function seedSync(fixture) {
  globalThis.chrome.storage.sync.__seed(fixture);
}

export function seedLocal(fixture) {
  globalThis.chrome.storage.local.__seed(fixture);
}

export function dumpSync() {
  return globalThis.chrome.storage.sync.__dump();
}

export function dumpLocal() {
  return globalThis.chrome.storage.local.__dump();
}

export function getWriteCounts() {
  return globalThis.chrome.storage.sync.__getWriteCounts();
}

export function resetWriteCounts() {
  globalThis.chrome.storage.sync.__resetWriteCounts();
}

export function resetSyncRateLimit() {
  globalThis.chrome.storage.sync.__resetRateLimit();
}

export function setSyncFailurePredicate(predicate) {
  globalThis.chrome.storage.sync.__setFailurePredicate(predicate);
}

export function clearSyncFailurePredicate() {
  globalThis.chrome.storage.sync.__setFailurePredicate(null);
}

export function setLocalFailurePredicate(predicate) {
  globalThis.chrome.storage.local.__setFailurePredicate(predicate);
}

export function clearLocalFailurePredicate() {
  globalThis.chrome.storage.local.__setFailurePredicate(null);
}
