import { LitElement, html, css, PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { customElement, property, state } from 'lit/decorators.js';
import Fuse from 'fuse.js';
import { i18n } from '../lib/i18n';
import { rl, ListItemData, getSettings, updateSettings } from '../lib/rl';
import { syncBadgeForTab } from '../lib/badge';
import { ReadingListItemElement } from './reading-list-item';
import './reading-list-item.js';

@customElement('reading-list-app')
export class ReadingListAppElement extends LitElement {
  static override styles = css`
    :host {
      --base-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
        Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
      --base-font-size: 13px;
      --base-line-height: 1.4;
      --container-width: 360px;
      --spacer: 15px;
      --rl-bg-color: #f7f7f7;
      --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
      --rl-link-color: #555;
      --rl-link-hover-bg: #fff;
      --primary-color: #66cc98;
      --primary-color-focus: #44aa76;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :focus-visible {
      outline: 3px solid lightblue;
    }

    .visually-hidden:not(caption) {
      position: absolute !important;
    }

    .visually-hidden {
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    h1 {
      margin: 0;
      font-size: 1.6rem;
      line-height: 1.25;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      width: 100%;
      gap: 1rem;
      padding-bottom: 0.5rem;
    }

    .save-button {
      --button-size: 2rem;

      color: #fff;
      background: var(--primary-color);
      width: var(--button-size);
      height: var(--button-size);
      line-height: var(--button-size);
      font-weight: bold;
      border: 0;
      border-radius: 9999px;
      text-align: center;
    }

    .save-button:hover,
    .save-button:focus {
      background-color: var(--primary-color-focus);
    }

    .save-button:focus {
      outline: 3px solid lightblue;
    }

    search {
      margin: 0;
      padding-bottom: 0.5rem;
    }

    /* label {
      display: block;
      margin-top: 0;
      margin-bottom: 0.125rem;
      padding: 0;
      font-size: inherit;
    } */

    input {
      font-size: inherit;
      border: 1px solid #eee;
      border-radius: 0.25rem;
      padding: 0.5rem;
      background: transparent;
      width: 100%;
      margin: 0;
    }

    input:focus {
      outline: 3px solid lightblue;
      border-color: var(--primary-color);
    }

    [type='search'] {
      -webkit-appearance: textfield;
    }
    [type='search']::-webkit-search-cancel-button,
    [type='search']::-webkit-search-decoration {
      -webkit-appearance: none;
    }

    reading-list-item {
      display: block;
    }

    reading-list-item:not(:first-child) {
      margin-top: 0.5rem;
    }

    .controls {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .filter,
    .sort {
      display: flex;
      flex: 1;
      box-shadow: var(--rl-shadow);
      border-radius: 4px;
      overflow: hidden;
    }

    .filter button,
    .sort button {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.25rem;
      border: 0;
      background: var(--rl-bg-color);
      color: var(--rl-link-color);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.7rem;
      padding: 0.5rem;
      cursor: pointer;
    }

    .filter button:hover,
    .filter button:focus,
    .filter button.active,
    .sort button:hover,
    .sort button:focus,
    .sort button.active {
      background: var(--rl-link-hover-bg);
      color: var(--primary-color);
    }

    .count {
      font-size: 80%;
      display: inline-block;
      border: 1px solid currentColor;
      padding: 0.1rem 0.4rem;
      border-radius: 8px;
    }

    .arrow {
      display: none;
      border: solid currentColor;
      border-width: 0 2px 2px 0;
      padding: 3px;
      transition: transform 0.3s ease;
    }

    .arrow.up,
    .arrow.down {
      display: inline-block;
    }

    .arrow.up {
      transform: rotate(-135deg);
    }

    .arrow.down {
      transform: rotate(45deg);
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --rl-bg-color: #23272e;
        --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
        --rl-link-color: #e0e0e0;
        --rl-link-hover-bg: #2c313a;
        --primary-color: #66cc98;
        --primary-color-focus: #44aa76;
      }
      input {
        background: #181a20;
        color: #e0e0e0;
        border-color: #444;
      }
      input:focus {
        border-color: var(--primary-color);
      }
      body,
      main {
        background: #181a20;
        color: #e0e0e0;
      }
    }

    :host([theme='dark']) {
      --rl-bg-color: #23272e;
      --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
      --rl-link-color: #e0e0e0;
      --rl-link-hover-bg: #2c313a;
      --primary-color: #66cc98;
      --primary-color-focus: #44aa76;
    }
    :host([theme='dark']) input {
      background: #181a20;
      color: #e0e0e0;
      border-color: #444;
    }

    :host([theme='light']) {
      --rl-bg-color: #f7f7f7;
      --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
      --rl-link-color: #555;
      --rl-link-hover-bg: #fff;
      --primary-color: #66cc98;
      --primary-color-focus: #44aa76;
    }
    :host([theme='light']) input {
      background: transparent;
      color: inherit;
      border-color: #eee;
    }
  `;

  constructor() {
    super();
    rl.getListItems().then((listItems) => {
      this._listItems = listItems;
      void this._maybeAskForReview(listItems);
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

  private async _maybeAskForReview(listItems: ListItemData[]) {
    if (listItems.length < 6) return;
    const settings = await getSettings();
    if (settings.askedForReview) return;

    const isFirefox = navigator.userAgent.includes('Firefox');
    this._reviewItem = {
      title: 'Like the Reading List? Give us a review!',
      url: isFirefox
        ? 'https://addons.mozilla.org/en-US/firefox/addon/reading_list/'
        : 'https://chrome.google.com/webstore/detail/reading-list/lloccabjgblebdmncjndmiibianflabo/reviews',
      addedAt: Date.now(),
      favIconUrl: chrome.runtime.getURL('icons/icon48.png'),
    };
  }

  private async _onDismissReview() {
    this._reviewItem = null;
    await updateSettings({ askedForReview: true });
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
  private _sortOption: 'date' | 'title' | '' = '';

  @state()
  private _sortOrder: 'up' | 'down' | '' = '';

  private _animateItems = true;

  private _fuse: Fuse<ListItemData> | null = null;

  override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('_listItems')) {
      this._fuse = this._listItems
        ? new Fuse(this._listItems, { keys: ['title', 'url'], threshold: 0.4 })
        : null;
    }
  }

  private get _unreadCount(): number {
    return (this._listItems ?? []).filter((item) => !item.viewed).length;
  }

  private _compareItems = (a: ListItemData, b: ListItemData): number => {
    if (this._sortOption === 'date') {
      return this._sortOrder === 'up' ? a.addedAt - b.addedAt : b.addedAt - a.addedAt;
    }
    const cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
    return this._sortOrder === 'up' ? -cmp : cmp;
  };

  private get _visibleItems(): ListItemData[] {
    let items = this.searchQuery
      ? (this._fuse?.search(this.searchQuery).map((result) => result.item) ?? [])
      : (this._listItems ?? []);

    if (!this._viewAll) {
      items = items.filter((item) => !item.viewed);
    }

    if (this._sortOption) {
      items = [...items].sort(this._compareItems);
    }

    return items;
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
    let nextOption: 'date' | 'title' | '' = option;
    let nextOrder: 'up' | 'down' | '' = 'down';
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
