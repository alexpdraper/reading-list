import {ListItemData, rl, getSettings} from './lib/rl';
import {i18n} from './lib/i18n';
import {syncBadgeForTab} from './lib/badge';

chrome.action.setBadgeBackgroundColor({color: '#2ea99c'});

function createContextMenu(id: string, i18nKey: string, defaultTitle: string, contexts: chrome.contextMenus.ContextType[]) {
  chrome.contextMenus.create({
    id,
    title: i18n.getMessage(i18nKey, defaultTitle),
    contexts
  });
}

async function syncContextMenu() {
  const settings = await getSettings();
  await chrome.contextMenus.removeAll();
  if (settings.addContextMenu ?? true) {
    createContextMenu('add-page-to-reading-list', 'addPage', 'Add page to Reading List', ['page']);
    createContextMenu('add-link-to-reading-list', 'addLink', 'Add link to Reading List', ['link']);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void syncContextMenu();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && 'settings' in changes) {
    void syncContextMenu();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  rl.getListItems().then(() => {
    if (info.menuItemId === 'add-link-to-reading-list' && info.linkUrl) {
      void addToReadingList(info.linkUrl, info.selectionText || info.linkUrl);
    } else if (info.menuItemId === 'add-page-to-reading-list' && tab && tab.url) {
      void addToReadingList(tab.url, tab.title || tab.url, tab.favIconUrl);
    }
  });
});

async function addToReadingList(url: string, title: string, favIconUrl?: string) {
  const newItem: ListItemData = {url, title, addedAt: Date.now(), favIconUrl};
  try {
    await rl.addReadingItem(newItem);
  } catch (e) {
    console.error(e);
    return;
  }
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (tab?.id) void syncBadgeForTab(tab.id, tab.url);
}

chrome.tabs.onActivated.addListener(({tabId}) => {
  chrome.tabs.get(tabId).then((tab) => {
    if (tab.url) void syncBadgeForTab(tabId, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    void syncBadgeForTab(tabId, tab.url);
  }
});
