import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('reading-list-item')
export class ReadingListItemElement extends LitElement {
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
      --rl-item-gap: 0.5rem;

      font-family: var(--base-font);
      font-size: var(--base-font-size);
      line-height: var(--base-line-height);
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :focus-visible {
      outline: 3px solid lightblue;
    }

    .reading-list-item {
      border-radius: 3px;
      padding: 0;
      margin: 0;
      position: relative;
      overflow: hidden;
      transition: all 0.5s ease 0s;
      color: var(--rl-link-color);
      background-color: var(--rl-bg-color);
      box-shadow: var(--rl-shadow);
    }

    .favicon {
      position: absolute;
      top: var(--rl-item-gap);
      left: var(--rl-item-gap);
      width: 36px;
      height: 36px;
      border-radius: 0.25rem;
      border: 1px solid #ccc;
      padding: 1px;
    }

    .favicon-img {
      width: 100%;
      height: 100%;
      border-radius: 2px;
    }

    .item-content {
      text-decoration: none;
      display: block;
      width: 100%;
      padding: 10px 50px 10px 56px;
      min-height: 56px;
      position: relative;
    }

    .item-content:hover,
    .item-content:focus {
      color: var(--primary-color);
      background-color: var(--rl-link-hover-bg);
    }

    .item-content:hover .favicon,
    .item-content:focus .favicon {
      border-color: var(--primary-color);
    }

    .title,
    .host {
      overflow-wrap: break-word;
      color: inherit;
    }

    @media screen and (max-width: 200px) {
      .title,
      .host {
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
    }

    .title {
      display: block;
      font-weight: bold;
      text-decoration: none;
      border-radius: 0.25rem;
    }

    .title::after {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 1;
      content: '';
    }

    .host {
      display: block;
    }

    .action-buttons {
      position: absolute;
      display: flex;
      top: 0;
      right: 0;
      z-index: 2;
      height: 1.5rem;
    }

    .delete-button,
    .new-tab-button {
      position: relative;
      text-align: center;
      font-weight: bold;
      padding: 0;
      border-radius: 0;
      width: 1.5rem;
      height: 1.5rem;
      border: 0;
      background: transparent;
      z-index: 2;
    }


    .delete-button-content,
    .new-tab-button-content {
      color: #ccc;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      transform: rotateZ(0) scale(1);
      background: transparent;
      transition: transform 0.3s ease, box-shadow 0.5s ease;
    }

    .delete-button:focus-visible,
    .new-tab-button:focus-visible {
      outline: none;
    }

    .delete-button:focus-visible .delete-button-content {
      outline: 3px solid lightblue;
    }

    .new-tab-button:focus-visible .new-tab-button-content {
      outline: 3px solid lightblue;
    }

    .delete-button:focus-visible .delete-button-content,
    .delete-button:hover .delete-button-content {
      color: #fff;
      transform: rotateZ(90deg) scale(2);
      box-shadow: 1px 0 1px rgba(0, 0, 0, 0.15);
      background: #ccc;
    }

    .new-tab-button:focus-visible .new-tab-button-content,
    .new-tab-button:hover .new-tab-button-content {
      color: #fff;
      box-shadow: 1px 0 1px rgba(0, 0, 0, 0.15);
      background: var(--primary-color);
    }

    .new-tab-button.active .new-tab-button-content {
      color: #fff;
      background: var(--primary-color);
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --rl-bg-color: #23272e;
        --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
        --rl-link-color: #e0e0e0;
        --rl-link-hover-bg: #2c313a;
        --primary-color: #66cc98;
      }

      .reading-list-item {
        background-color: var(--rl-bg-color);
        color: var(--rl-link-color);
        box-shadow: var(--rl-shadow);
      }

      .item-content {
        color: var(--rl-link-color);
      }

      .item-content:hover,
      .item-content:focus {
        background-color: var(--rl-link-hover-bg);
        color: var(--primary-color);
      }

      .favicon {
        border-color: #444;
      }

      .delete-button-content {
        color: #888;
      }

      .delete-button:focus-visible .delete-button-content,
      .delete-button:hover .delete-button-content {
        background: #444;
        color: #fff;
      }

      .new-tab-button:focus-visible .new-tab-button-content,
      .new-tab-button:hover .new-tab-button-content {
        background: var(--primary-color);
        color: #fff;
      }

      .new-tab-button.active .new-tab-button-content {
        background: var(--primary-color);
        color: #fff;
      }
    }
  `;

  /**
   * The URL title text.
   */
  @property()
  name = '';

  /**
   * The URL to link to.
   */
  @property({ type: String })
  href = '';

  @property({ type: Boolean })
  newtab = false;

  private get url() {
    return this.href ? new URL(this.href) : null;
  }

  /**
   * The src for the favicon image.
   */
  private get favicon() {
    return this.url
      ? `https://icons.duckduckgo.com/ip2/${this.url.hostname}.ico`
      : null;
  }

  @state()
  faviconError = false;

  override render() {
    return html`
      <div class="reading-list-item">
        <div class="item-content">
          <a class="title" href=${this.href} @click=${this._onLinkClick}
            >${this.name}</a
          >
          <div class="host">${this.url?.hostname ?? this.href}</div>
          <div class="favicon">
            ${this.favicon && !this.faviconError
              ? html`<img
                  class="favicon-img"
                  onerror="this.onerror=null;this.hidden=true"
                  src=${this.favicon}
                />`
              : ''}
          </div>
        </div>
        <div class="action-buttons">
          <button
            class="new-tab-button ${this.newtab ? 'active' : ''}"
            @click=${this._onNewTabToggle}
            title="Open in new tab"
          >
            <span class="new-tab-button-content">⧉</span>
          </button>
          <button class="delete-button" @click=${this._onDeleteClick}>
            <span class="delete-button-content">&times;</span>
          </button>
        </div>
      </div>
    `;
  }

  private async _onLinkClick(event: MouseEvent) {
    if (this.href) {
      event.preventDefault();
      // Check if newtab is set, or fall back to global setting
      let shouldOpenNewTab = this.newtab;
      if (!shouldOpenNewTab) {
        const settings = await chrome.storage.sync.get('settings');
        shouldOpenNewTab = settings.settings?.openNewTab ?? false;
      }
      const modifierDown = event.ctrlKey || event.metaKey || shouldOpenNewTab;
      openLink(this.href, modifierDown);
    }
  }

  private _onNewTabToggle() {
    this.newtab = !this.newtab;
    this.dispatchEvent(
      new CustomEvent('toggle-new-tab', {
        detail: { href: this.href, openNewTab: this.newtab },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onDeleteClick() {
    this.dispatchEvent(
      new Event('delete-item', { bubbles: true, composed: true }),
    );
  }
}

function openLink(url: string, newTab: boolean) {
  if (newTab) {
    // Create a new tab with the URL
    chrome?.tabs.create({ url: url, active: false });
  } else {
    // Query for the active tab
    chrome?.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      (tabs) => {
        const tab = tabs[0];

        if (tab.id) {
          // Update the URL of the current tab
          chrome.tabs.update(tab.id, { url: url });

          // Close the popup
          const isPopup = document.body.classList.contains('popup-page');
          if (isPopup) {
            window.close();
          }
        }
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reading-list-item': ReadingListItemElement;
  }
}
