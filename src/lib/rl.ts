export interface ListItemData {
  addedAt: number;
  title: string;
  url: string;
}

// const storageItems = {
//   settings: {
//     addContextMenu: true,
//     addPageAction: true,
//     animateItems: false,
//     askedForReview: true,
//     openNewTab: false,
//     theme: 'light',
//     viewAll: true,
//   },
// };

const getItemsRemote = async () => {
  const pages = await chrome.storage.sync.get();
  const listItems: ListItemData[] = [];
  for (const page in pages) {
    if (pages.hasOwnProperty(page) && 'addedAt' in pages[page]) {
      listItems.push(pages[page]);
    }
  }
  return listItems;
};

class RL {
  private list: ListItemData[] = [];
  private initialized = false;

  async getListItems() {
    if (!this.initialized) {
      this.list = chrome ? await getItemsRemote() : [];
      this.list.sort((a, b) => b.addedAt - a.addedAt);
      this.initialized = true;
    }

    return this.list;
  }

  async addReadingItem(listItem: ListItemData) {
    if (!this.initialized) return;
    await chrome?.storage.sync.set({ [listItem.url]: listItem });
    this.list = [
      listItem,
      ...this.list.filter((item) => item.url !== listItem.url),
    ];
  }

  async removeReadingItem(url: string) {
    if (!this.initialized) return;
    await chrome?.storage.sync.remove(url);
    this.list = this.list.filter((item) => item.url !== url);
  }
}

export const rl = new RL();
