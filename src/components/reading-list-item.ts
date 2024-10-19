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

      font-family: var(--base-font);
      font-size: var(--base-font-size);
      line-height: var(--base-line-height);
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .reading-list-item {
      border-radius: 3px;
      padding: 0;
      margin: 10px 0 0 0;
      position: relative;
      overflow: hidden;
      transition: all 0.5s ease 0s;
      color: var(--rl-link-color);
      background-color: var(--rl-bg-color);
      box-shadow: var(--rl-shadow);
    }

    .favicon {
      position: absolute;
      top: 10px;
      left: 10px;
      width: 36px;
      height: 36px;
      border-radius: 4px;
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

    .delete-button {
      position: absolute;
      text-align: center;
      font-weight: bold;
      top: 5px;
      right: 5px;
      border-radius: 100%;
      padding: 0;
      width: 20px;
      height: 20px;
      border: 0;
      background: transparent;
      color: #ccc;
      transform: rotateZ(0) scale(1);
      transition:
        transform 0.3s ease,
        box-shadow 0.5s ease;
      z-index: 2;
    }

    .delete-button:hover {
      cursor: pointer;
      background: #ccc;
      color: #fff;
      transform: rotateZ(90deg) scale(2);
      box-shadow: 1px 0 1px rgba(0, 0, 0, 0.15);
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
        <button class="delete-button" @click=${this._onDeleteClick}>
          &times;
        </button>
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
      </div>
    `;
  }

  private _onLinkClick(event: MouseEvent) {
    if (this.href) {
      event.preventDefault();
      // If the control or meta key (⌘ on Mac, ⊞ on Windows) is pressed or if options is selected…
      const modifierDown = event.ctrlKey || event.metaKey || this.newtab;
      openLink(this.href, modifierDown);
    }
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
