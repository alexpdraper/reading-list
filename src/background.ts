import { ListItemData, rl } from './lib/rl';
import { i18n } from './lib/i18n';

// Register the context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-reading-list',
    title: i18n.getMessage('addPage', 'Add page to Reading List'),
    contexts: ['page']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-to-reading-list' && tab && tab.url) {
    const newItem: ListItemData = {
      url: tab.url,
      title: tab.title || tab.url,
      addedAt: Date.now()
    };
    rl.getListItems().then(async () => {
      try {
        await rl.addReadingItem(newItem);
      } catch (e) {
        console.error(e);
        return;
      }
    });
  }
});
