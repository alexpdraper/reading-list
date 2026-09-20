export interface ListItemData {
  addedAt: number;
  title: string;
  url: string;
  openNewTab?: boolean;
  favIconUrl?: string;
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
    // Browsers block extensions from navigating tabs to privileged URLs
    // (about:, chrome:, etc.) via tabs.create/update, so saving one here
    // would just produce an unusable item that errors when clicked.
    if (!/^https?:\/\//i.test(listItem.url)) {
      throw new Error(`Unsupported URL scheme: ${listItem.url}`);
    }
    // Some sites (e.g. Gmail) serve a data: URI favicon that can be many KB,
    // which blows past storage.sync's 8KB-per-item quota. Only persist
    // favicons that are plain URLs; the UI falls back to a icon lookup
    // service otherwise.
    if (listItem.favIconUrl?.startsWith('data:')) {
      listItem = { ...listItem, favIconUrl: undefined };
    }
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

  async updateReadingItem(url: string, updates: Partial<ListItemData>) {
    if (!this.initialized) return;
    const item = this.list.find((item) => item.url === url);
    if (item) {
      const updatedItem = { ...item, ...updates };
      await chrome?.storage.sync.set({ [url]: updatedItem });
      Object.assign(item, updates);
    }
  }
}

export const rl = new RL();
