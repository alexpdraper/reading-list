import { LitElement, html, PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { customElement, property, state } from 'lit/decorators.js';
import { i18n } from '../lib/i18n';
import { rl, ListItemData, getSettings, updateSettings } from '../lib/rl';
import { syncBadgeForTab } from '../lib/badge';
import { ListFilter, SortOption, SortOrder } from '../lib/list-filter';
import { maybeGetReviewItem, dismissReview } from '../lib/review';
import { ReadingListItemElement } from './reading-list-item';
import { styles } from './reading-list-app.styles';
import './reading-list-item.js';

@customElement('reading-list-app')
export class ReadingListAppElement extends LitElement {
  static override styles = styles;

  constructor() {
    super();
    rl.getListItems().then((listItems) => {
      this._listItems = listItems;
      maybeGetReviewItem(listItems.length).then((item) => {
        this._reviewItem = item;
      });
    });
    getSettings().then((settings) => {
      this._animateItems = settings.animateItems ?? true;
      this._viewAll = settings.viewAll ?? true;
      this._sortOption = settings.sortOption ?? '';
      this._sortOrder = settings.sortOrder ?? '';
      this.theme = settings.theme ?? '';
    });
  }

  @property({ type: String, reflect: true })
  theme: '' | 'light' | 'dark' = '';

  private async _onDismissReview() {
    this._reviewItem = null;
    await dismissReview();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.title = i18n.getMessage('appName', 'Reading List');
  }

  override updated() {
    if (this._justAddedUrl !== null) this._justAddedUrl = null;
  }

  @state()
  _listItems: ListItemData[] | null = null;

  @state()
  searchQuery = '';

  @state()
  private _justAddedUrl: string | null = null;

  @state()
  private _reviewItem: ListItemData | null = null;

  @state()
  private _viewAll = true;

  @state()
  private _sortOption: SortOption = '';

  @state()
  private _sortOrder: SortOrder = '';

  private _animateItems = true;

  private _listFilter = new ListFilter();

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
    });
  }

  override render() {
    return html`
      <header>
        <h1>${i18n.getMessage('appName', 'Reading List')}</h1>
        <button
          class="save-button"
          id="save-button"
          aria-label=${i18n.getMessage('addPage', 'Add page to Reading List')}
          @click=${this._onSaveButtonClick}
        >
          +
        </button>
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

      ${this._reviewItem
        ? html`<reading-list-item
            .name=${this._reviewItem.title}
            .href=${this._reviewItem.url}
            .favIconUrl=${this._reviewItem.favIconUrl}
            .shiny=${true}
            .theme=${this.theme}
            @delete-item=${this._onDismissReview}
          ></reading-list-item>`
        : ''}

      <div class="reading-list">
        ${repeat(
          this._visibleItems,
          (item) => item.url,
          (listItem) =>
            html`<reading-list-item
              .name=${listItem.title}
              .href=${listItem.url}
              .favIconUrl=${listItem.favIconUrl}
              .isNew=${listItem.url === this._justAddedUrl}
              .theme=${this.theme}
              @delete-item=${this._onDeleteItemClicked}
            ></reading-list-item>`,
        )}
      </div>
    `;
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
    await this._syncBadgeForActiveTab();
  }

  private async _addReadingItem(url: string, title: string, favIconUrl?: string) {
    if (this._listItems) {
      const listItem: ListItemData = { url, title, addedAt: Date.now(), favIconUrl };

      try {
        await rl.addReadingItem(listItem);
      } catch (e) {
        console.error(e);
        return;
      }

      if (this._animateItems) this._justAddedUrl = url;
      this._listItems = [
        listItem,
        ...this._listItems.filter((item) => item.url !== url),
      ];
      await this._syncBadgeForActiveTab();
    }
  }

  private async _syncBadgeForActiveTab() {
    const tab = await this._getActiveTab();
    if (tab?.id) await syncBadgeForTab(tab.id, tab.url);
  }

  private async _onSaveButtonClick() {
    const tab = await this._getActiveTab();
    if (tab && tab.url && tab.title && this._listItems) {
      return this._addReadingItem(tab.url, tab.title, tab.favIconUrl);
    }
  }

  private async _getActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tab;
    } catch (e) {
      console.error(e);
    }
    return null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reading-list-app': ReadingListAppElement;
    'reading-list-item': ReadingListItemElement;
  }
}
