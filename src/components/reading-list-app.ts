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

    h1 {
      margin: 0;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      width: 100%;
      gap: 1rem;
    }

    .save-button {
      color: #fff;
      background: var(--primary-color);
      width: 30px;
      height: 30px;
      line-height: 30px;
      margin: 0 10px;
      font-weight: bold;
      border: 0;
      border-radius: 50%;
      text-align: center;
    }

    .save-button:hover,
    .save-button:focus {
      background-color: var(--primary-color-focus);
    }

    .save-button:focus {
      outline: 3px solid lightblue;
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

      ${repeat(
        this._listItems ?? [],
        (item) => item.url,
        (listItem) =>
          html`<reading-list-item
            .name=${listItem.title}
            .href=${listItem.url}
            @delete-item=${this._onDeleteItemClicked}
          ></reading-list-item>`,
      )}
    `;
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
