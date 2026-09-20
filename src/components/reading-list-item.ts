import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getSettings } from '../lib/rl';
import { isFirefox, openLink } from '../lib/browser';
import { styles } from './reading-list-item.styles';

@customElement('reading-list-item')
export class ReadingListItemElement extends LitElement {
  static override styles = styles;

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

  @property({ type: String })
  favIconUrl?: string;

  @property({ type: Boolean, attribute: false })
  isNew = false;

  @property({ type: Boolean })
  shiny = false;

  @property({ type: String, reflect: true })
  theme: '' | 'light' | 'dark' = '';

  @state()
  private _slidein = false;

  override firstUpdated() {
    if (this.isNew) {
      this._slidein = true;
    }
  }

  private get url() {
    return this.href ? new URL(this.href) : null;
  }

  /**
   * The src for the favicon image.
   */
  private get favicon() {
    if (!isFirefox && this.favIconUrl) {
      return this.favIconUrl;
    }
    if (!this.url || !this.url.hostname) {
      return null;
    }
    return `https://icons.duckduckgo.com/ip2/${this.url.hostname}.ico`;
  }

  @state()
  faviconError = false;

  override render() {
    return html`
      <div
        class="reading-list-item ${this._slidein ? 'slidein' : ''} ${this.shiny ? 'shiny' : ''}"
        @animationend=${() => (this._slidein = false)}
      >
        <div class="item-content">
          <a class="title" href=${this.href} @click=${this._onLinkClick}>${this.name}</a>
          <div class="host">${this.url?.hostname ?? this.href}</div>
          <div class="favicon">
            ${this.favicon && !this.faviconError
              ? html`<img
                  class="favicon-img"
                  @error=${() => (this.faviconError = true)}
                  src=${this.favicon}
                />`
              : ''}
          </div>
        </div>
        <button class="delete-button" @click=${this._onDeleteClick}>
          <span class="delete-button-content">&times;</span>
        </button>
      </div>
    `;
  }

  private async _onLinkClick(event: MouseEvent) {
    if (this.href) {
      event.preventDefault();
      const settings = await getSettings();
      const modifierDown = event.ctrlKey || event.metaKey || (settings.openNewTab ?? false);
      openLink(this.href, modifierDown);
    }
  }

  private _onDeleteClick() {
    this.dispatchEvent(
      new Event('delete-item', { bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reading-list-item': ReadingListItemElement;
  }
}
