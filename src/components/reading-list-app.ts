import { LitElement, html, css } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { customElement, state } from 'lit/decorators.js';
import { i18n } from '../lib/i18n';
import { rl, ListItemData } from '../lib/rl';
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
  `;

  constructor() {
    super();
    rl.getListItems().then((listItems) => {
      this._listItems = listItems;
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.title = i18n.getMessage('appName', 'Reading List');
  }

  @state()
  _listItems: ListItemData[] | null = null;

  @state()
  searchQuery = '';

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

      <div class="reading-list">
        ${repeat(
          this._listItems?.filter(
            (item) =>
              !this.searchQuery ||
              item.url.toLocaleUpperCase().includes(this.searchQuery) ||
              item.title.toLocaleUpperCase().includes(this.searchQuery),
          ) ?? [],
          (item) => item.url,
          (listItem) =>
            html`<reading-list-item
              .name=${listItem.title}
              .href=${listItem.url}
              @delete-item=${this._onDeleteItemClicked}
            ></reading-list-item>`,
        )}
      </div>
    `;
  }

  private _onSearchInput(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value.trim().toLocaleUpperCase();
  }

  private async _onDeleteItemClicked(event: Event) {
    if (!this._listItems) return;
    const url = (event.target as ReadingListItemElement).href;
    await rl.removeReadingItem(url);
    this._listItems = this._listItems.filter((item) => item.url !== url);
  }

  private async _addReadingItem(url: string, title: string) {
    if (this._listItems) {
      const listItem: ListItemData = { url, title, addedAt: Date.now() };

      try {
        await rl.addReadingItem(listItem);
      } catch (e) {
        console.error(e);
        return;
      }

      this._listItems = [
        listItem,
        ...this._listItems.filter((item) => item.url !== url),
      ];
    }
  }

  private async _onSaveButtonClick() {
    const tab = await this._getActiveTab();
    if (tab && tab.url && tab.title && this._listItems) {
      return this._addReadingItem(tab.url, tab.title);
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
