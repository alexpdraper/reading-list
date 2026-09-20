import {ListItemData, rl} from './lib/rl';
import {i18n} from './lib/i18n';

function createContextMenu(id: string, i18nKey: string, defaultTitle: string, contexts: chrome.contextMenus.ContextType[]) {
  chrome.contextMenus.create({
    id,
    title: i18n.getMessage(i18nKey, defaultTitle),
    contexts
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu('add-page-to-reading-list', 'addPage', 'Add page to Reading List', ['page']);
  createContextMenu('add-link-to-reading-list', 'addLink', 'Add link to Reading List', ['link']);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  rl.getListItems().then(() => {
    if (info.menuItemId === 'add-link-to-reading-list' && info.linkUrl) {
      void addToReadingList(info.linkUrl, info.selectionText || info.linkUrl);
    } else if (info.menuItemId === 'add-page-to-reading-list' && tab && tab.url) {
      void addToReadingList(tab.url, tab.title || tab.url);
    }
  });
});

async function addToReadingList(url: string, title: string) {
  const newItem: ListItemData = {url, title, addedAt: Date.now()};
  await rl.addReadingItem(newItem);
}
