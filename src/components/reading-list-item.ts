import { LitElement, html, PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
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

  @property({ type: Boolean })
  animateItems = true;

  @property({ type: Boolean })
  locked = false;

  @state()
  private _slidein = false;

  @state()
  private _slideout = false;

  @state()
  private _dragging = false;

  @state()
  _editing = false;

  @state()
  private _editValue = '';

  @query('.edit-title')
  private _editInput?: HTMLInputElement;

  override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('isNew') && this.isNew) {
      this._slidein = true;
    }
  }

  override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('_editing') && this._editing) {
      this._editInput?.focus();
      this._editInput?.select();
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
    const classes = [
      'reading-list-item',
      this._slidein ? 'slidein' : '',
      this._slideout ? 'slideout' : '',
      this.shiny ? 'shiny' : '',
      this._dragging ? 'dragging' : '',
      this.locked ? 'locked' : '',
    ].join(' ');

    return html`
      <div
        class=${classes}
        draggable=${!this.shiny && !this._editing && !this.locked}
        @animationend=${this._onAnimationEnd}
        @dragstart=${this._onDragStart}
        @dragend=${() => (this._dragging = false)}
      >
        <div class="item-content">
          ${this._editing
            ? html`<input
                class="edit-title"
                autocomplete="off"
                .value=${this._editValue}
                @input=${(e: Event) => (this._editValue = (e.target as HTMLInputElement).value)}
                @keydown=${this._onEditKeydown}
                @blur=${this._onEditBlur}
              />`
            : html`<a class="title" href=${this.href} @click=${this._onLinkClick}>${this.name}</a>`}
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
        ${this.shiny
          ? ''
          : html`<button
              class="edit-button"
              aria-label="Edit title"
              @mousedown=${(e: Event) => e.preventDefault()}
              @click=${this._onEditClick}
            >
              <span class="edit-button-content">${this._editing ? '\u{1F4BE}' : '✎'}</span>
            </button>`}
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
      const modifierDown = event.ctrlKey || event.metaKey || settings.openNewTab;
      openLink(this.href, modifierDown);
    }
  }

  private _onEditClick(event: Event) {
    event.preventDefault();
    if (this._editing) {
      this._commitEdit(true);
    } else {
      this._editValue = this.name;
      this._editing = true;
      this.dispatchEvent(
        new Event('edit-start', { bubbles: true, composed: true }),
      );
    }
  }

  private _onEditKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this._commitEdit(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this._commitEdit(false);
    }
  }

  private _onEditBlur() {
    this._commitEdit(true);
  }

  private _commitEdit(save: boolean) {
    if (!this._editing) return;
    this._editing = false;
    const title = this._editValue.trim();
    if (save && title && title !== this.name) {
      this.dispatchEvent(
        new CustomEvent('edit-item', {
          detail: { title },
          bubbles: true,
          composed: true,
        }),
      );
    }
    this.dispatchEvent(
      new Event('edit-end', { bubbles: true, composed: true }),
    );
  }

  private _onDeleteClick() {
    if (this.animateItems) {
      this._slideout = true;
    } else {
      this._dispatchDelete();
    }
  }

  private _onAnimationEnd(event: AnimationEvent) {
    if (event.animationName === 'slidein') {
      this._slidein = false;
    } else if (event.animationName === 'slideout') {
      this._dispatchDelete();
    }
  }

  private _dispatchDelete() {
    this.dispatchEvent(
      new Event('delete-item', { bubbles: true, composed: true }),
    );
  }

  private _onDragStart(event: DragEvent) {
    if (this.shiny || this._editing) {
      event.preventDefault();
      return;
    }
    this._dragging = true;
    event.dataTransfer?.setData('text/plain', this.href);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reading-list-item': ReadingListItemElement;
  }
}
