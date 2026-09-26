export type SortOption = 'date' | 'title' | '';
export type SortOrder = 'up' | 'down' | '';

export interface Settings {
  openNewTab?: boolean;
  animateItems?: boolean;
  addContextMenu?: boolean;
  sortOption?: SortOption;
  sortOrder?: SortOrder;
  viewAll?: boolean;
  askedForReview?: boolean;
}

export const DEFAULT_SETTINGS: Required<Settings> = {
  openNewTab: false,
  animateItems: true,
  addContextMenu: true,
  sortOption: '',
  sortOrder: '',
  viewAll: true,
  askedForReview: false,
};

export async function getSettings(): Promise<Required<Settings>> {
  const stored = await chrome.storage.sync.get<{ settings?: Settings }>(
    'settings',
  );
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

export async function updateSettings(
  updates: Partial<Settings>,
): Promise<Settings> {
  const next = { ...(await getSettings()), ...updates };
  await chrome.storage.sync.set({ settings: next });
  return next;
}

export function onSettingsChanged(
  callback: (settings: Required<Settings>) => void,
): () => void {
  if (!chrome?.storage?.onChanged) return () => {};
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'sync' || !('settings' in changes)) return;
    callback({
      ...DEFAULT_SETTINGS,
      ...(changes.settings.newValue as Settings | undefined),
    });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
