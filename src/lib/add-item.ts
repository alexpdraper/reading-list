import { rl } from './rl.js';
import { ListItemData } from './buckets.js';
import { syncBadgeForTab } from './badge.js';
import { getActiveTab } from './browser.js';

export async function addReadingItemAndSyncBadge(
  url: string,
  title: string,
  favIconUrl?: string,
): Promise<ListItemData | null> {
  let stored: ListItemData | null;
  try {
    stored = await rl.addReadingItem({ url, title, addedAt: Date.now(), favIconUrl });
  } catch (e) {
    console.error(e);
    return null;
  }
  if (!stored) return null;
  const tab = await getActiveTab();
  if (tab?.id) void syncBadgeForTab(tab.id, tab.url);
  return stored;
}
