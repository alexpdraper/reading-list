import { LitElement, html, PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { animate } from '@lit-labs/motion';
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
import { styles } from '../styles/app.styles.js';
import { header } from '../styles/header.styles.js';
import { search } from '../styles/search.styles.js';
import { controls } from '../styles/controls.styles.js';
import { theme } from '../styles/theme.styles.js';
import { reset } from '../styles/reset.styles.js';
import './reading-list-item.js';

// Matches the original CSS `slidein`/`slideout` keyframes (src/styles/animations.styles.ts
// on v3_beta): only the outer card animates on exit, and on entry it's a quick,
// non-bouncy reveal - the bounce lives entirely on the inner .item-content
// (see CONTENT_IN_KEYFRAMES in reading-list-item.ts), running at its own,
// slower pace at the same time.
const CARD_IN_KEYFRAMES: Keyframe[] = [
  { maxHeight: '0px', transform: 'translateX(100%) scaleY(0)', offset: 0 },
  { maxHeight: '100px', offset: 0.8 },
  { transform: 'translateX(0) scaleY(1)', offset: 1 },
];

const CARD_OUT_KEYFRAMES: Keyframe[] = [
  { maxHeight: '100px', transform: 'translateX(0) scaleY(1)', offset: 0 },
  { maxHeight: '0px', offset: 0.4 },
  { transform: 'translateX(100%) scaleY(0)', offset: 1 },
];

const ITEM_ENTER_EXIT_TIMING: KeyframeAnimationOptions = {
  duration: 220,
  easing: 'ease',
};

const ITEM_DRAG_FLIP_TIMING: KeyframeAnimationOptions = {
  duration: 180,
  easing: 'ease',
};

@customElement('reading-list-app')
export class ReadingListAppElement extends LitElement {
  static override styles = [theme, reset, header, search, controls, styles];

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
        const revealOrder = this._listFilter.visibleItems(listItems, {
          query: '',
          viewAll: this._viewAll,
          sortOption: this._sortOption,
          sortOrder: this._sortOrder,
        });
        this._staggerReveal(revealOrder);
      }
    }).catch((err) => {
      console.error('Failed to load reading list', err);
      this._loadError = true;
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
    clearTimeout(this._syncErrorTimer);
  }

  notifySyncFailure() {
    clearTimeout(this._syncErrorTimer);
    this._syncError = true;
    this._syncErrorTimer = setTimeout(() => {
      this._syncError = false;
    }, 4000);
  }

  private async _onRemoteChange() {
    const generation = ++this._remoteChangeGeneration;
    const items = await rl.getListItems();
    if (generation !== this._remoteChangeGeneration) return;
    this._listItems = items;
  }

  @state()
  _listItems: ListItemData[] | null = null;

  @state()
  searchQuery = '';

  @state()
  private _revealedUrls: Set<string> | null = null;

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

  @state()
  private _syncError = false;

  @state()
  private _loadError = false;

  private _syncErrorTimer?: ReturnType<typeof setTimeout>;

  private _remoteChangeGeneration = 0;

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
    const visible = this._listFilter.visibleItems(this._listItems ?? [], {
      query: this.searchQuery,
      viewAll: this._viewAll,
      sortOption: this._sortOption,
      sortOrder: this._sortOrder,
      preserveOrder: this._dragReorder.isDragging,
    });
    return this._revealedUrls === null
      ? visible
      : visible.filter((item) => this._revealedUrls!.has(item.url));
  }

  private _staggerReveal(items: ListItemData[]) {
    const itemsToAnimate = Math.min(10, items.length);
    this._revealedUrls = new Set();
    const animateNext = (index: number, waitTime: number) => {
      if (index >= itemsToAnimate) {
        this._revealedUrls = null;
        return;
      }
      setTimeout(() => {
        this._revealedUrls = new Set([...this._revealedUrls!, items[index].url]);
        const nextWait = Math.trunc(waitTime * ((itemsToAnimate - (index + 1)) / itemsToAnimate));
        animateNext(index + 1, nextWait);
      }, waitTime);
    };
    animateNext(0, 150);
  }

  private _itemMotionOptions(url: string) {
    if (!this._animateItems) return { disabled: true };
    return {
      properties: ['top'],
      keyframeOptions: this._dragReorder.isDragging
        ? ITEM_DRAG_FLIP_TIMING
        : ITEM_ENTER_EXIT_TIMING,
      in: CARD_IN_KEYFRAMES,
      out: CARD_OUT_KEYFRAMES,
      skipInitial: true,
      disabled: this._dragReorder.draggedUrl === url,
    };
  }

  override render() {
    return html`
      ${this._renderHeader()} ${this._renderSearch()} ${this._renderControls()}
      ${this._syncError
        ? html`<p class="sync-error" role="status" aria-live="polite">
            ${i18n.getMessage(
              'syncFailed',
              "Couldn't save that change. It may not appear on your other devices.",
            )}
          </p>`
        : ''}
      ${this._loadError
        ? html`<p class="sync-error" role="status" aria-live="polite">
            ${i18n.getMessage(
              'loadFailed',
              'Converting your reading list to the new format failed. Your saved pages are still safe in storage — open Options (the gear icon above) → Advanced to download a backup.',
            )}
          </p>`
        : ''}
      ${this._renderList()}
      ${this._editingUrl !== null ? html`<div class="editing-overlay"></div>` : ''}
    `;
  }

  private _renderHeader() {
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
          >&#9881;</button>
        </div>
        <div class="header-title">
          <h1>${i18n.getMessage('appName', 'Reading List')}</h1>
          <button
            class="save-button${isFirefox ? ' save-button-nudge' : ''}"
            id="save-button"
            aria-label=${i18n.getMessage('addPage', 'Add page to Reading List')}
            @click=${this._onSaveButtonClick}
          >+</button>
        </div>
      </header>
    `;
  }

  private _renderSearch() {
    return html`
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
    `;
  }

  private _renderControls() {
    return html`
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
    `;
  }

  private _renderList() {
    return html`
      <div
        class="reading-list"
        @dragstart=${this._dragReorder.onDragStart}
        @dragover=${this._dragReorder.onDragOver}
        @drop=${this._dragReorder.onDrop}
        @dragend=${this._dragReorder.onDragEnd}
        @edit-start=${this._onEditStart}
        @edit-end=${this._onEditEnd}
      >
        ${this._reviewItem
          ? html`<reading-list-item
              ${animate(this._itemMotionOptions(this._reviewItem.url))}
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
              ${animate(this._itemMotionOptions(listItem.url))}
              .name=${listItem.title}
              .href=${listItem.url}
              .favIconUrl=${listItem.favIconUrl}
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
    const ok = await rl.removeReadingItem(url);
    if (!ok) {
      this.notifySyncFailure();
      return;
    }
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
