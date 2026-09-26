import Fuse from 'fuse.js';
import { ListItemData } from './buckets.js';

export type SortOption = 'date' | 'title' | '';
export type SortOrder = 'up' | 'down' | '';

export interface FilterOptions {
  query: string;
  viewAll: boolean;
  sortOption: SortOption;
  sortOrder: SortOrder;
  preserveOrder?: boolean;
}

function compareItems(
  a: ListItemData,
  b: ListItemData,
  sortOption: SortOption,
  sortOrder: SortOrder,
): number {
  if (sortOption === 'date') {
    return sortOrder === 'up' ? a.addedAt - b.addedAt : b.addedAt - a.addedAt;
  }
  const cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  return sortOrder === 'up' ? -cmp : cmp;
}

function compareByManualDragOrderThenNewestFirst(a: ListItemData, b: ListItemData): number {
  if (a.index == null && b.index == null) return b.addedAt - a.addedAt;
  if (a.index == null) return 1;
  if (b.index == null) return -1;
  return a.index - b.index;
}

export class ListFilter {
  private fuse: Fuse<ListItemData> | null = null;

  setItems(items: ListItemData[] | null) {
    this.fuse = items ? new Fuse(items, { keys: ['title', 'url'], threshold: 0.4 }) : null;
  }

  visibleItems(
    items: ListItemData[],
    { query, viewAll, sortOption, sortOrder, preserveOrder }: FilterOptions,
  ): ListItemData[] {
    let result = query ? (this.fuse?.search(query).map((r) => r.item) ?? []) : items;

    if (!viewAll) {
      result = result.filter((item) => !item.viewed);
    }

    if (sortOption) {
      result = [...result].sort((a, b) => compareItems(a, b, sortOption, sortOrder));
    } else if (!preserveOrder) {
      result = [...result].sort(compareByManualDragOrderThenNewestFirst);
    }

    return result;
  }
}
