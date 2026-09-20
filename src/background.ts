import {rl} from './lib/rl.js';
import {getSettings} from './lib/settings.js';
import {i18n} from './lib/i18n.js';
import {syncBadgeForTab} from './lib/badge.js';
import {addReadingItemAndSyncBadge} from './lib/add-item.js';

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
  if (settings.addContextMenu) {
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
      void addReadingItemAndSyncBadge(info.linkUrl, info.selectionText || info.linkUrl);
    } else if (info.menuItemId === 'add-page-to-reading-list' && tab && tab.url) {
      void addReadingItemAndSyncBadge(tab.url, tab.title || tab.url, tab.favIconUrl);
    }
  });
});

async function handleTabUrl(tabId: number, url: string) {
  await syncBadgeForTab(tabId, url);
  await rl.updateReadingItem(url, {viewed: true});
}

chrome.tabs.onActivated.addListener(({tabId}) => {
  chrome.tabs.get(tabId).then((tab) => {
    if (tab.url) void handleTabUrl(tabId, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    void handleTabUrl(tabId, tab.url);
  }
});
