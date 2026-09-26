import { rl } from './rl.js';
import { ListItemData } from './storage/store.js';

export const isFirefox = navigator.userAgent.includes('Firefox');

export function message(key: string, fallback = ''): string {
  return chrome?.i18n.getMessage(key) || fallback;
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab ?? null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function openLink(url: string, newTab: boolean) {
  if (newTab) {
    chrome?.tabs.create({ url, active: false }).catch(console.error);
    return;
  }
  const tab = await getActiveTab();
  if (!tab?.id) return;
  chrome.tabs.update(tab.id, { url }).catch(console.error);
  if (document.body.classList.contains('popup-page')) window.close();
}

export async function syncBadgeForTab(tabId: number, url?: string) {
  const onList = url
    ? (await rl.getListItems()).some((item) => item.url === url)
    : false;
  await chrome.action.setBadgeText({ tabId, text: onList ? '✔' : '' });
}

export async function syncBadgeForActiveTab() {
  const tab = await getActiveTab();
  if (tab?.id) await syncBadgeForTab(tab.id, tab.url);
}

export async function addPage(
  url: string,
  title: string,
  favIconUrl?: string,
): Promise<ListItemData> {
  const stored = await rl.addReadingItem({
    url,
    title,
    addedAt: Date.now(),
    favIconUrl,
  });
  void syncBadgeForActiveTab();
  return stored;
}
