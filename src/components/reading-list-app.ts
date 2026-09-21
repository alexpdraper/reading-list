import { LitElement, html, PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { customElement, state } from 'lit/decorators.js';
import { i18n } from '../lib/i18n.js';
import { rl } from '../lib/rl.js';
import { ListItemData } from '../lib/storage/buckets.js';
import { getSettings, updateSettings, onSettingsChanged } from '../lib/settings.js';
import { syncBadgeForTab } from '../lib/badge.js';
import { ListFilter, SortOption, SortOrder } from '../lib/list-filter.js';
import { maybeGetReviewItem, dismissReview } from '../lib/review.js';
import { isFirefox, getActiveTab } from '../lib/browser.js';
import { addReadingItemAndSyncBadge } from '../lib/add-item.js';
import { ReadingListItemElement } from './reading-list-item.js';
import { DragReorderController } from './drag-reorder-controller.js';
import { styles } from './reading-list-app.styles.js';
import { theme } from './theme.styles.js';
import './reading-list-item.js';

// Slightly past the 0.65s slideout animation (reading-list-item.styles.ts).
const REMOTE_REMOVE_TIMEOUT_MS = 850;

@customElement('reading-list-app')
export class ReadingListAppElement extends LitElement {
  static override styles = [theme, styles];

  constructor() {
    super();
    Promise.all([rl.getListItems(), getSettings()]).then(([listItems, settings]) => {
      this._animateItems = settings.animateItems;
      this._viewAll = settings.viewAll;
      this._sortOption = settings.sortOption;
      this._sortOrder = settings.sortOrder;

      this._listItems = listItems;
      maybeGetReviewItem(listItems.length).then((item) => {
        this._reviewItem = item;
      });
      if (this._animateItems) {
        this._staggerReveal(listItems);
      }
    });
  }

  private async _onDismissReview() {
    this._reviewItem = null;
    await dismissReview();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.title = i18n.getMessage('appName', 'Reading List');
    this._unsubscribe?.();
    this._unsubscribe = rl.subscribe(() => void this._onRemoteChange());
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = onSettingsChanged((settings) => {
      this._animateItems = settings.animateItems;
      this._viewAll = settings.viewAll;
      this._sortOption = settings.sortOption;
      this._sortOrder = settings.sortOrder;
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = undefined;
  }

  private async _onRemoteChange() {
    const previous = this._listItems ?? [];
    const items = await rl.getListItems();

    const previousUrls = new Set(previous.map((item) => item.url));
    const nextUrls = new Set(items.map((item) => item.url));

    const removed = previous.filter((item) => !nextUrls.has(item.url));
    const removedVisible = this._animateItems
      ? removed.filter((item) =>
          this._visibleItems.some((visible) => visible.url === item.url),
        )
      : [];
    const added = items.filter((item) => !previousUrls.has(item.url));

    this._listItems = [...items, ...removedVisible];

    if (removedVisible.length > 0) {
      this._removingUrls = new Set([
        ...this._removingUrls,
        ...removedVisible.map((item) => item.url),
      ]);
      for (const item of removedVisible) {
        setTimeout(() => this._finishRemoval(item.url), REMOTE_REMOVE_TIMEOUT_MS);
      }
    }

    if (this._animateItems && added.length > 0) {
      this._animatingUrls = new Set(added.map((item) => item.url));
    }
  }

  private _finishRemoval(url: string) {
    if (!this._removingUrls.has(url)) return;
    this._removingUrls = new Set(
      [...this._removingUrls].filter((removingUrl) => removingUrl !== url),
    );
    this._listItems = (this._listItems ?? []).filter((item) => item.url !== url);
  }

  private _onRemoteRemoveAnimationEnd(event: Event) {
    this._finishRemoval((event.target as ReadingListItemElement).href);
  }

  override updated() {
    if (this._animatingUrls.size > 0) this._animatingUrls = new Set();
  }

  @state()
  _listItems: ListItemData[] | null = null;

  @state()
  searchQuery = '';

  @state()
  private _animatingUrls: Set<string> = new Set();

  @state()
  private _removingUrls: Set<string> = new Set();

  @state()
  private _reviewItem: ListItemData | null = null;

  @state()
  private _viewAll = true;

  @state()
  _sortOption: SortOption = '';

  @state()
  private _sortOrder: SortOrder = '';

  @state()
  private _editingUrl: string | null = null;

  @state()
  private _animateItems = true;

  private _unsubscribe?: () => void;

  private _unsubscribeSettings?: () => void;

  private _listFilter = new ListFilter();

  private _dragReorder = new DragReorderController(this);

  override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('_listItems')) {
      this._listFilter.setItems(this._listItems);
    }
  }

  private get _unreadCount(): number {
    return (this._listItems ?? []).filter((item) => !item.viewed).length;
  }

  private get _visibleItems(): ListItemData[] {
    return this._listFilter.visibleItems(this._listItems ?? [], {
      query: this.searchQuery,
      viewAll: this._viewAll,
      sortOption: this._sortOption,
      sortOrder: this._sortOrder,
      preserveOrder: this._dragReorder.isDragging,
    });
  }

  private _staggerReveal(items: ListItemData[]) {
    const itemsToAnimate = Math.min(10, items.length);
    const animateNext = (index: number, waitTime: number) => {
      if (index >= itemsToAnimate) return;
      setTimeout(() => {
        this._animatingUrls = new Set([items[index].url]);
        const nextWait = Math.trunc(waitTime * ((itemsToAnimate - (index + 1)) / itemsToAnimate));
        animateNext(index + 1, nextWait);
      }, waitTime);
    };
    animateNext(0, 150);
  }

  override render() {
    return html`
      <header>
        <div class="header-top">
          ${isFirefox && !this._isSidebar
            ? html`<button
                class="sidebar-button"
                aria-label="Open sidebar"
                @click=${this._onSidebarClick}
              >
                Sidebar
              </button>`
            : html`<span></span>`}
          <button
            class="settings-button"
            aria-label="Options"
            @click=${this._onSettingsClick}
          >
            &#9881;
          </button>
        </div>
        <div class="header-title">
          <h1>${i18n.getMessage('appName', 'Reading List')}</h1>
          <button
            class="save-button"
            id="save-button"
            aria-label=${i18n.getMessage('addPage', 'Add page to Reading List')}
            @click=${this._onSaveButtonClick}
          >
            +
          </button>
        </div>
      </header>

      <search class="search">
        <label class="visually-hidden" for="list-search"
          >${i18n.getMessage('search', 'Search')}</label
        >
        <input
          type="search"
          id="list-search"
          name="search"
          placeholder=${i18n.getMessage('search', 'Search')}
          autocomplete="off"
          @input=${this._onSearchInput}
        />
      </search>

      <div class="controls">
        <div class="filter">
          <button
            class=${this._viewAll ? 'active' : ''}
            @click=${() => this._onFilterClick(true)}
          >
            ${i18n.getMessage('allButton', 'all')}
            <span class="count">${this._listItems?.length ?? 0}</span>
          </button>
          <button
            class=${!this._viewAll ? 'active' : ''}
            @click=${() => this._onFilterClick(false)}
          >
            ${i18n.getMessage('unreadButton', 'unread')}
            <span class="count">${this._unreadCount}</span>
          </button>
        </div>

        <div class="sort">
          <button
            class=${this._sortOption === 'date' ? 'active' : ''}
            @click=${() => this._onSortClick('date')}
          >
            ${i18n.getMessage('dateButton', 'date')}
            <em class="arrow ${this._sortOption === 'date' ? this._sortOrder : ''}"></em>
          </button>
          <button
            class=${this._sortOption === 'title' ? 'active' : ''}
            @click=${() => this._onSortClick('title')}
          >
            ${i18n.getMessage('titleButton', 'title')}
            <em class="arrow ${this._sortOption === 'title' ? this._sortOrder : ''}"></em>
          </button>
        </div>
      </div>

      <div
        class="reading-list"
        @dragstart=${this._dragReorder.onDragStart}
        @dragover=${this._dragReorder.onDragOver}
        @drop=${this._dragReorder.onDrop}
        @dragend=${this._dragReorder.onDragEnd}
        @edit-start=${this._onEditStart}
        @edit-end=${this._onEditEnd}
        @remove-animation-end=${this._onRemoteRemoveAnimationEnd}
      >
        ${this._reviewItem
          ? html`<reading-list-item
              .name=${this._reviewItem.title}
              .href=${this._reviewItem.url}
              .favIconUrl=${this._reviewItem.favIconUrl}
              .shiny=${true}
              .animateItems=${this._animateItems}
              .locked=${this._editingUrl !== null}
              @delete-item=${this._onDismissReview}
            ></reading-list-item>`
          : ''}
        ${repeat(
          this._visibleItems,
          (item) => item.url,
          (listItem) =>
            html`<reading-list-item
              .name=${listItem.title}
              .href=${listItem.url}
              .favIconUrl=${listItem.favIconUrl}
              .isNew=${this._animatingUrls.has(listItem.url)}
              .removing=${this._removingUrls.has(listItem.url)}
              .animateItems=${this._animateItems}
              .reorderable=${!this._sortOption && !this.searchQuery}
              .locked=${this._editingUrl !== null && this._editingUrl !== listItem.url}
              @delete-item=${this._onDeleteItemClicked}
              @edit-item=${this._onEditItemClicked}
            ></reading-list-item>`,
        )}
      </div>
    `;
  }

  private _onEditStart(event: Event) {
    this._editingUrl = (event.target as ReadingListItemElement).href;
  }

  private _onEditEnd(event: Event) {
    const url = (event.target as ReadingListItemElement).href;
    if (this._editingUrl === url) this._editingUrl = null;
  }

  private _onSearchInput(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value.trim();
  }

  private async _onFilterClick(viewAll: boolean) {
    this._viewAll = viewAll;
    await updateSettings({ viewAll });
  }

  private async _onSortClick(option: 'date' | 'title') {
    let nextOption: SortOption = option;
    let nextOrder: SortOrder = 'down';
    if (this._sortOption === option) {
      if (this._sortOrder === 'down') {
        nextOrder = 'up';
      } else {
        nextOption = '';
        nextOrder = '';
      }
    }
    this._sortOption = nextOption;
    this._sortOrder = nextOrder;
    await updateSettings({ sortOption: nextOption, sortOrder: nextOrder });
  }

  private async _onDeleteItemClicked(event: Event) {
    if (!this._listItems) return;
    const url = (event.target as ReadingListItemElement).href;
    await rl.removeReadingItem(url);
    this._listItems = this._listItems.filter((item) => item.url !== url);
    const tab = await getActiveTab();
    if (tab?.id) await syncBadgeForTab(tab.id, tab.url);
  }

  private async _onEditItemClicked(event: Event) {
    if (!this._listItems) return;
    const target = event.target as ReadingListItemElement;
    const { title } = (event as CustomEvent<{ title: string }>).detail;
    await rl.updateReadingItem(target.href, { title });
    this._listItems = this._listItems.map((item) =>
      item.url === target.href ? { ...item, title } : item,
    );
  }

  private async _addReadingItem(url: string, title: string, favIconUrl?: string) {
    if (!this._listItems) return;

    const listItem = await addReadingItemAndSyncBadge(url, title, favIconUrl);
    if (!listItem) return;

    if (this._animateItems) this._animatingUrls = new Set([url]);
    this._listItems = [
      listItem,
      ...this._listItems.filter((item) => item.url !== url),
    ];
  }

  private async _onSaveButtonClick() {
    const tab = await getActiveTab();
    if (tab && tab.url && tab.title && this._listItems) {
      return this._addReadingItem(tab.url, tab.title, tab.favIconUrl);
    }
  }

  private _onSettingsClick() {
    chrome.runtime.openOptionsPage();
  }

  private get _isSidebar() {
    return document.body.classList.contains('sidebar-page');
  }

  private _onSidebarClick() {
    (window as unknown as { browser?: { sidebarAction?: { toggle: () => void } } }).browser
      ?.sidebarAction?.toggle();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reading-list-app': ReadingListAppElement;
    'reading-list-item': ReadingListItemElement;
  }
}
