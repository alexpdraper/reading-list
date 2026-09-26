import { rl } from './rl.js';
import { ListItemData } from './buckets.js';

export const isFirefox = navigator.userAgent.includes('Firefox');

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function openLink(url: string, newTab: boolean) {
  if (newTab) {
    chrome?.tabs.create({ url: url, active: false }).catch(console.error);
    return;
  }

  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.update(tab.id, { url: url }).catch(console.error);

    const isPopup = document.body.classList.contains('popup-page');
    if (isPopup) {
      window.close();
    }
  }
}

export async function syncBadgeForTab(tabId: number, url?: string) {
  if (!url) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const items = await rl.getListItems();
  const onList = items.some((item) => item.url === url);
  await chrome.action.setBadgeText({ tabId, text: onList ? '✔' : '' });
}

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

export const i18n = {
  getMessage(key: string, defaultValue = ''): string {
    return chrome?.i18n.getMessage(key) ?? defaultValue;
  },
};
