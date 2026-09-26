import { rl } from './lib/rl.js';
import { getSettings } from './lib/settings.js';
import { addPage, message, syncBadgeForTab } from './lib/browser.js';

const ADD_PAGE_MENU = 'add-page-to-reading-list';
const ADD_LINK_MENU = 'add-link-to-reading-list';

chrome.action.setBadgeBackgroundColor({ color: '#2ea99c' });

async function syncContextMenu() {
  const settings = await getSettings();
  await chrome.contextMenus.removeAll();
  if (!settings.addContextMenu) return;
  chrome.contextMenus.create({
    id: ADD_PAGE_MENU,
    title: message('addPage', 'Add page to Reading List'),
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: ADD_LINK_MENU,
    title: message('addLink', 'Add link to Reading List'),
    contexts: ['link'],
  });
}

chrome.runtime.onInstalled.addListener(() => void syncContextMenu());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && 'settings' in changes) void syncContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const added =
    info.menuItemId === ADD_LINK_MENU && info.linkUrl
      ? addPage(info.linkUrl, info.selectionText || info.linkUrl)
      : info.menuItemId === ADD_PAGE_MENU && tab?.url
        ? addPage(tab.url, tab.title || tab.url, tab.favIconUrl)
        : null;
  added?.catch(console.error);
});

async function markViewedAndSyncBadge(tabId: number, url: string) {
  await syncBadgeForTab(tabId, url);
  await rl.updateReadingItem(url, { viewed: true });
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) void markViewedAndSyncBadge(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url)
    void markViewedAndSyncBadge(tabId, tab.url);
});
