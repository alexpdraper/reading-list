import Fuse from 'fuse.js';
import { SortOption, SortOrder } from './settings.js';
import { ListItemData } from './storage/store.js';

export interface FilterOptions {
  query: string;
  viewAll: boolean;
  sortOption: SortOption;
  sortOrder: SortOrder;
  keepCurrentOrder?: boolean;
}

const searchIndexes = new WeakMap<ListItemData[], Fuse<ListItemData>>();

function search(items: ListItemData[], query: string): ListItemData[] {
  let index = searchIndexes.get(items);
  if (!index) {
    index = new Fuse(items, { keys: ['title', 'url'], threshold: 0.4 });
    searchIndexes.set(items, index);
  }
  return index.search(query).map((result) => result.item);
}

function compareBySort(sortOption: SortOption, sortOrder: SortOrder) {
  const direction = sortOrder === 'up' ? -1 : 1;
  return (a: ListItemData, b: ListItemData) =>
    sortOption === 'date'
      ? direction * (b.addedAt - a.addedAt)
      : direction *
        a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
}

function compareByDragOrder(a: ListItemData, b: ListItemData): number {
  if (a.index == null && b.index == null) return b.addedAt - a.addedAt;
  if (a.index == null) return 1;
  if (b.index == null) return -1;
  return a.index - b.index;
}

export function visibleItems(
  items: ListItemData[],
  { query, viewAll, sortOption, sortOrder, keepCurrentOrder }: FilterOptions,
): ListItemData[] {
  let result = query ? search(items, query) : items;
  if (!viewAll) result = result.filter((item) => !item.viewed);
  if (sortOption) return [...result].sort(compareBySort(sortOption, sortOrder));
  if (keepCurrentOrder) return result;
  return [...result].sort(compareByDragOrder);
}
