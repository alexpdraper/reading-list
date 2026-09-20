import { rl } from './rl.js';

export async function syncBadgeForTab(tabId: number, url?: string) {
  if (!url) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const items = await rl.getListItems();
  const onList = items.some((item) => item.url === url);
  await chrome.action.setBadgeText({ tabId, text: onList ? '✔' : '' });
}
