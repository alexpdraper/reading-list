import { LitElement, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { animate } from '@lit-labs/motion';
import { customElement, state } from 'lit/decorators.js';
import { rl } from '../lib/rl.js';
import { ListItemData } from '../lib/storage/store.js';
import {
  getSettings,
  onSettingsChanged,
  Settings,
  SortOption,
  SortOrder,
  updateSettings,
} from '../lib/settings.js';
import { visibleItems } from '../lib/list-filter.js';
import {
  addPage,
  getActiveTab,
  isFirefox,
  message,
  syncBadgeForActiveTab,
} from '../lib/browser.js';
import { ReadingListItemElement } from './reading-list-item.js';
import { styles } from '../styles/app.styles.js';
import { header } from '../styles/header.styles.js';
import { search } from '../styles/search.styles.js';
import { controls } from '../styles/controls.styles.js';
import { theme } from '../styles/theme.styles.js';
import { reset } from '../styles/reset.styles.js';
import './reading-list-item.js';

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

const ENTER_EXIT_TIMING: KeyframeAnimationOptions = {
  duration: 220,
  easing: 'ease',
};
const DRAG_TIMING: KeyframeAnimationOptions = { duration: 180, easing: 'ease' };

const REVEAL_ITEM_LIMIT = 10;
const REVEAL_FIRST_DELAY_MS = 150;
const SYNC_ERROR_VISIBLE_MS = 4000;

const REVIEW_AFTER_ITEM_COUNT = 6;
const REVIEW_URL = isFirefox
  ? 'https://addons.mozilla.org/en-US/firefox/addon/reading_list/'
  : 'https://chrome.google.com/webstore/detail/reading-list/lloccabjgblebdmncjndmiibianflabo/reviews';

function itemElementFrom(event: Event): ReadingListItemElement | undefined {
  return (event.composedPath() as HTMLElement[]).find(
    (el) => el.tagName === 'READING-LIST-ITEM',
  ) as ReadingListItemElement | undefined;
}

@customElement('reading-list-app')
export class ReadingListAppElement extends LitElement {
  static override styles = [theme, reset, header, search, controls, styles];

  @state() private _listItems: ListItemData[] | null = null;
  @state() private _searchQuery = '';
  @state() private _revealedUrls: Set<string> | null = null;
  @state() private _reviewItem: ListItemData | null = null;
  @state() private _viewAll = true;
  @state() private _sortOption: SortOption = '';
  @state() private _sortOrder: SortOrder = '';
  @state() private _editingUrl: string | null = null;
  @state() private _draggedUrl: string | null = null;
  @state() private _animateItems = true;
  @state() private _syncError = false;
  @state() private _loadError = false;

  private _syncErrorTimer?: ReturnType<typeof setTimeout>;
  private _unsubscribeList?: () => void;
  private _unsubscribeSettings?: () => void;

  constructor() {
    super();
    void this._load();
  }

  private async _load() {
    try {
      const [items, settings] = await Promise.all([
        rl.getListItems(),
        getSettings(),
      ]);
      this._applySettings(settings);
      this._listItems = items;
      if (items.length >= REVIEW_AFTER_ITEM_COUNT && !settings.askedForReview) {
        this._reviewItem = {
          title: 'Like the Reading List? Give us a review!',
          url: REVIEW_URL,
          addedAt: Date.now(),
          favIconUrl: chrome.runtime.getURL('icons/icon48.png'),
        };
      }
      if (this._animateItems) this._staggerReveal(this._filteredItems());
    } catch (err) {
      console.error('Failed to load reading list', err);
      this._loadError = true;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.title = message('appName', 'Reading List');
    this._unsubscribeList?.();
    this._unsubscribeList = rl.subscribe(async () => {
      this._listItems = await rl.getListItems();
    });
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = onSettingsChanged((settings) =>
      this._applySettings(settings),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribeList?.();
    this._unsubscribeList = undefined;
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = undefined;
    this._draggedUrl = null;
    clearTimeout(this._syncErrorTimer);
  }

  private _applySettings(settings: Required<Settings>) {
    this._animateItems = settings.animateItems;
    this._viewAll = settings.viewAll;
    this._sortOption = settings.sortOption;
    this._sortOrder = settings.sortOrder;
  }

  private _showSyncError() {
    clearTimeout(this._syncErrorTimer);
    this._syncError = true;
    this._syncErrorTimer = setTimeout(
      () => (this._syncError = false),
      SYNC_ERROR_VISIBLE_MS,
    );
  }

  private async _saveChange(change: () => Promise<unknown>) {
    try {
      await change();
    } catch (err) {
      console.error(err);
      this._showSyncError();
    }
    this._listItems = await rl.getListItems();
  }

  private get _canReorder(): boolean {
    return !this._sortOption && !this._searchQuery;
  }

  private _filteredItems(query = ''): ListItemData[] {
    return visibleItems(this._listItems ?? [], {
      query,
      viewAll: this._viewAll,
      sortOption: this._sortOption,
      sortOrder: this._sortOrder,
      keepCurrentOrder: this._draggedUrl !== null,
    });
  }

  private get _visibleItems(): ListItemData[] {
    const visible = this._filteredItems(this._searchQuery);
    return this._revealedUrls
      ? visible.filter((item) => this._revealedUrls!.has(item.url))
      : visible;
  }

  private _staggerReveal(items: ListItemData[]) {
    const count = Math.min(REVEAL_ITEM_LIMIT, items.length);
    this._revealedUrls = new Set();
    const revealNext = (index: number, delay: number) => {
      if (index >= count) {
        this._revealedUrls = null;
        return;
      }
      setTimeout(() => {
        this._revealedUrls = new Set([
          ...this._revealedUrls!,
          items[index].url,
        ]);
        revealNext(
          index + 1,
          Math.trunc(delay * ((count - (index + 1)) / count)),
        );
      }, delay);
    };
    revealNext(0, REVEAL_FIRST_DELAY_MS);
  }

  private _motion(url: string) {
    if (!this._animateItems) return { disabled: true };
    return {
      properties: ['top'],
      keyframeOptions:
        this._draggedUrl !== null ? DRAG_TIMING : ENTER_EXIT_TIMING,
      in: CARD_IN_KEYFRAMES,
      out: CARD_OUT_KEYFRAMES,
      skipInitial: true,
      disabled: this._draggedUrl === url,
    };
  }

  override render() {
    return html`
      ${this._renderHeader()} ${this._renderSearch()} ${this._renderControls()}
      ${
        this._syncError
          ? this._renderError(
              message(
                'syncFailed',
                "Couldn't save that change. It may not appear on your other devices.",
              ),
            )
          : ''
      }
      ${
        this._loadError
          ? this._renderError(
              message(
                'loadFailed',
                'Converting your reading list to the new format failed. Your saved pages are still safe in storage — open Options (the gear icon above) → Advanced to download a backup.',
              ),
            )
          : ''
      }
      ${this._renderList()}
      ${this._editingUrl !== null ? html`<div class="editing-overlay"></div>` : ''}
    `;
  }

  private _renderError(text: string) {
    return html`<p class="sync-error" role="status" aria-live="polite">
      ${text}
    </p>`;
  }

  private _renderHeader() {
    const isSidebar = document.body.classList.contains('sidebar-page');
    return html`
      <header>
        <div class="header-top">
          ${
            isFirefox && !isSidebar
              ? html`<button
                  class="sidebar-button"
                  aria-label="Open sidebar"
                  @click=${this._onSidebarClick}
                >
                  Sidebar
                </button>`
              : html`<span></span>`
          }
          <button
            class="settings-button"
            aria-label="Options"
            @click=${() => chrome.runtime.openOptionsPage()}
          >
            &#9881;
          </button>
        </div>
        <div class="header-title">
          <h1>${message('appName', 'Reading List')}</h1>
          <button
            class="save-button${isFirefox ? ' save-button-nudge' : ''}"
            id="save-button"
            aria-label=${message('addPage', 'Add page to Reading List')}
            @click=${this._onSaveClick}
          >
            +
          </button>
        </div>
      </header>
    `;
  }

  private _renderSearch() {
    return html`
      <search class="search">
        <label class="visually-hidden" for="list-search"
          >${message('search', 'Search')}</label
        >
        <input
          type="search"
          id="list-search"
          name="search"
          placeholder=${message('search', 'Search')}
          autocomplete="off"
          @input=${(e: InputEvent) => (this._searchQuery = (e.target as HTMLInputElement).value.trim())}
        />
      </search>
    `;
  }

  private _renderControls() {
    const unreadCount = (this._listItems ?? []).filter(
      (item) => !item.viewed,
    ).length;
    const sortButton = (option: 'date' | 'title', label: string) => html`
      <button
        class=${this._sortOption === option ? 'active' : ''}
        @click=${() => this._onSortClick(option)}
      >
        ${label}
        <em
          class="arrow ${this._sortOption === option ? this._sortOrder : ''}"
        ></em>
      </button>
    `;
    return html`
      <div class="controls">
        <div class="filter">
          <button
            class=${this._viewAll ? 'active' : ''}
            @click=${() => this._onFilterClick(true)}
          >
            ${message('allButton', 'all')}
            <span class="count">${this._listItems?.length ?? 0}</span>
          </button>
          <button
            class=${!this._viewAll ? 'active' : ''}
            @click=${() => this._onFilterClick(false)}
          >
            ${message('unreadButton', 'unread')}
            <span class="count">${unreadCount}</span>
          </button>
        </div>
        <div class="sort">
          ${sortButton('date', message('dateButton', 'date'))}
          ${sortButton('title', message('titleButton', 'title'))}
        </div>
      </div>
    `;
  }

  private _renderList() {
    return html`
      <div
        class="reading-list"
        @dragstart=${this._onDragStart}
        @dragover=${this._onDragOver}
        @drop=${(e: DragEvent) => e.preventDefault()}
        @dragend=${this._onDragEnd}
        @edit-start=${(e: Event) => (this._editingUrl = (e.target as ReadingListItemElement).href)}
        @edit-end=${this._onEditEnd}
      >
        ${
          this._reviewItem
            ? html`<reading-list-item
                ${animate(this._motion(this._reviewItem.url))}
                .name=${this._reviewItem.title}
                .href=${this._reviewItem.url}
                .favIconUrl=${this._reviewItem.favIconUrl}
                .shiny=${true}
                .animateItems=${this._animateItems}
                .locked=${this._editingUrl !== null}
                @delete-item=${this._onDismissReview}
              ></reading-list-item>`
            : ''
        }
        ${repeat(
          this._visibleItems,
          (item) => item.url,
          (item) =>
            html`<reading-list-item
              ${animate(this._motion(item.url))}
              .name=${item.title}
              .href=${item.url}
              .favIconUrl=${item.favIconUrl}
              .animateItems=${this._animateItems}
              .reorderable=${this._canReorder}
              .locked=${this._editingUrl !== null && this._editingUrl !== item.url}
              @delete-item=${this._onDeleteClick}
              @edit-item=${this._onEditItem}
            ></reading-list-item>`,
        )}
      </div>
    `;
  }

  private _onEditEnd(event: Event) {
    if (this._editingUrl === (event.target as ReadingListItemElement).href)
      this._editingUrl = null;
  }

  private async _onFilterClick(viewAll: boolean) {
    this._viewAll = viewAll;
    await updateSettings({ viewAll });
  }

  private async _onSortClick(option: 'date' | 'title') {
    const repeatClick = this._sortOption === option;
    const nextOption: SortOption =
      repeatClick && this._sortOrder !== 'down' ? '' : option;
    const nextOrder: SortOrder = !repeatClick
      ? 'down'
      : this._sortOrder === 'down'
        ? 'up'
        : '';
    this._sortOption = nextOption;
    this._sortOrder = nextOrder;
    await updateSettings({ sortOption: nextOption, sortOrder: nextOrder });
  }

  private async _onDismissReview() {
    this._reviewItem = null;
    await updateSettings({ askedForReview: true });
  }

  private async _onDeleteClick(event: Event) {
    const url = (event.target as ReadingListItemElement).href;
    await this._saveChange(() => rl.removeReadingItem(url));
    await syncBadgeForActiveTab();
  }

  private async _onEditItem(event: CustomEvent<{ title: string }>) {
    const url = (event.target as ReadingListItemElement).href;
    await this._saveChange(() =>
      rl.updateReadingItem(url, { title: event.detail.title }),
    );
  }

  private async _onSaveClick() {
    const tab = await getActiveTab();
    if (!tab?.url || !tab.title || !this._listItems) return;
    await this._saveChange(() => addPage(tab.url!, tab.title!, tab.favIconUrl));
  }

  private _onSidebarClick() {
    (
      window as unknown as {
        browser?: { sidebarAction?: { toggle: () => void } };
      }
    ).browser?.sidebarAction?.toggle();
  }

  private _onDragStart = (event: DragEvent) => {
    if (!this._canReorder) {
      event.preventDefault();
      return;
    }
    this._draggedUrl = itemElementFrom(event)?.href ?? null;
  };

  private _onDragOver = (event: DragEvent) => {
    if (!this._canReorder || !this._listItems || !this._draggedUrl) return;
    event.preventDefault();
    const targetUrl = itemElementFrom(event)?.href;
    if (!targetUrl || targetUrl === this._draggedUrl) return;
    const items = [...this._listItems];
    const from = items.findIndex((item) => item.url === this._draggedUrl);
    const to = items.findIndex((item) => item.url === targetUrl);
    if (from === -1 || to === -1) return;
    items.splice(to, 0, ...items.splice(from, 1));
    this._listItems = items;
  };

  private _onDragEnd = async () => {
    const wasDragging = this._draggedUrl !== null;
    this._draggedUrl = null;
    if (!wasDragging || !this._canReorder || !this._listItems) return;
    const orderedUrls = this._listItems.map((item) => item.url);
    this._listItems = this._listItems.map((item, index) => ({
      ...item,
      index,
    }));
    await this._saveChange(() => rl.reorderItems(orderedUrls));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'reading-list-app': ReadingListAppElement;
  }
}
