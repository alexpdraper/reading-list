import { ReactiveController, ReactiveControllerHost } from 'lit';
import { rl } from '../lib/rl.js';
import { ListItemData } from '../lib/buckets.js';
import { SortOption } from '../lib/list-filter.js';
import { ReadingListItemElement } from './reading-list-item.js';

export interface DragReorderHost extends ReactiveControllerHost {
  _listItems: ListItemData[] | null;
  _sortOption: SortOption;
  searchQuery: string;
  shadowRoot: ShadowRoot | null;
  notifySyncFailure(): void;
}

export class DragReorderController implements ReactiveController {
  private _draggedUrl: string | null = null;

  constructor(private host: DragReorderHost) {
    host.addController(this);
  }

  get isDragging(): boolean {
    return this._draggedUrl !== null;
  }

  get draggedUrl(): string | null {
    return this._draggedUrl;
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this._draggedUrl = null;
  }

  private get _reorderSuppressed(): boolean {
    return Boolean(this.host._sortOption || this.host.searchQuery);
  }

  private _findItemElement(event: DragEvent): ReadingListItemElement | undefined {
    return (event.composedPath() as HTMLElement[]).find(
      (el) => el.tagName === 'READING-LIST-ITEM',
    ) as ReadingListItemElement | undefined;
  }

  onDragStart = (event: DragEvent) => {
    if (this._reorderSuppressed) {
      event.preventDefault();
      return;
    }
    this._draggedUrl = this._findItemElement(event)?.href ?? null;
  };

  onDragOver = (event: DragEvent) => {
    if (this._reorderSuppressed || !this.host._listItems || !this._draggedUrl) return;
    event.preventDefault();

    const targetUrl = this._findItemElement(event)?.href;
    if (!targetUrl || targetUrl === this._draggedUrl) return;

    const items = [...this.host._listItems];
    const fromIndex = items.findIndex((item) => item.url === this._draggedUrl);
    const toIndex = items.findIndex((item) => item.url === targetUrl);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [dragged] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, dragged);
    this.host._listItems = items;
  };

  onDrop = (event: DragEvent) => {
    event.preventDefault();
  };

  onDragEnd = async () => {
    const wasDragging = this._draggedUrl !== null;
    this._draggedUrl = null;
    if (!wasDragging || this._reorderSuppressed || !this.host._listItems) return;

    const items = this.host._listItems.map((item, index) => ({ ...item, index }));
    this.host._listItems = items;
    const ok = await rl.reorderItems(items.map((item) => item.url));
    if (!ok) {
      this.host._listItems = await rl.getListItems();
      this.host.notifySyncFailure();
    }
  };
}
