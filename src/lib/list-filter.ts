import Fuse from 'fuse.js';
import { ListItemData } from './storage/buckets.js';

export type SortOption = 'date' | 'title' | '';
export type SortOrder = 'up' | 'down' | '';

export interface FilterOptions {
  query: string;
  viewAll: boolean;
  sortOption: SortOption;
  sortOrder: SortOrder;
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

// Manual drag order when no explicit sort is active. Indexed items sort
// first by index; items without one (never dragged) fall after, newest first.
function compareByIndex(a: ListItemData, b: ListItemData): number {
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

  visibleItems(items: ListItemData[], { query, viewAll, sortOption, sortOrder }: FilterOptions): ListItemData[] {
    let result = query ? (this.fuse?.search(query).map((r) => r.item) ?? []) : items;

    if (!viewAll) {
      result = result.filter((item) => !item.viewed);
    }

    result = sortOption
      ? [...result].sort((a, b) => compareItems(a, b, sortOption, sortOrder))
      : [...result].sort(compareByIndex);

    return result;
  }
}
