import { ReactiveController, ReactiveControllerHost } from 'lit';
import { rl } from '../lib/rl.js';
import { ListItemData } from '../lib/storage/buckets.js';
import { SortOption } from '../lib/list-filter.js';
import { ReadingListItemElement } from './reading-list-item.js';

const FLIP_DURATION_MS = 180;

export interface DragReorderHost extends ReactiveControllerHost {
  _listItems: ListItemData[] | null;
  _sortOption: SortOption;
  searchQuery: string;
  shadowRoot: ShadowRoot | null;
}

export class DragReorderController implements ReactiveController {
  private _draggedUrl: string | null = null;
  private _flipPositions: Map<string, number> | null = null;
  private _flipCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private host: DragReorderHost) {
    host.addController(this);
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this._draggedUrl = null;
    this._flipPositions = null;
  }

  hostUpdate(): void {
    this._flipPositions = this._draggedUrl === null ? null : this._measurePositions();
  }

  hostUpdated(): void {
    const before = this._flipPositions;
    this._flipPositions = null;
    if (!before) return;
    this._playFlip(before);
  }

  private _measurePositions(): Map<string, number> {
    const positions = new Map<string, number>();
    for (const el of this._itemElements()) {
      if (el.href === this._draggedUrl) continue;
      positions.set(el.href, el.getBoundingClientRect().top);
    }
    return positions;
  }

  private _playFlip(before: Map<string, number>): void {
    for (const el of this._itemElements()) {
      if (el.href === this._draggedUrl) continue;
      const oldTop = before.get(el.href);
      if (oldTop === undefined) continue;

      const newTop = el.getBoundingClientRect().top;
      const delta = oldTop - newTop;
      if (Math.abs(delta) < 1) continue;

      const pending = this._flipCleanupTimers.get(el.href);
      if (pending !== undefined) clearTimeout(pending);

      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      // Force layout so the inverted position is committed before the
      // transition below is re-enabled, or the browser has nothing to animate from.
      el.getBoundingClientRect();

      requestAnimationFrame(() => {
        el.style.transition = `transform ${FLIP_DURATION_MS}ms ease`;
        el.style.transform = '';
      });

      this._flipCleanupTimers.set(
        el.href,
        setTimeout(() => {
          el.style.transition = '';
          this._flipCleanupTimers.delete(el.href);
        }, FLIP_DURATION_MS),
      );
    }
  }

  private _itemElements(): ReadingListItemElement[] {
    const root = this.host.shadowRoot;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<ReadingListItemElement>('.reading-list > reading-list-item'),
    );
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
    await rl.reorderItems(items.map((item) => item.url));
  };
}
