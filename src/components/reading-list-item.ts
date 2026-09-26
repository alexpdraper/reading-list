import { LitElement, html, PropertyValues } from 'lit';
import { animate } from '@lit-labs/motion';
import { customElement, property, query, state } from 'lit/decorators.js';
import { getSettings } from '../lib/settings.js';
import { isFirefox, openLink } from '../lib/browser.js';
import { styles } from '../styles/item.styles.js';
import { theme } from '../styles/theme.styles.js';
import { reset } from '../styles/reset.styles.js';

// Matches the original CSS `slidein-bounce` keyframes (src/styles/animations.styles.ts
// on v3_beta) exactly - same offsets, same shape. Runs on the inner content only,
// at the same time as (but slower than) the outer card's own quick reveal in
// reading-list-app.ts, reproducing the original's two-target layered motion.
// Exit never had a separate content animation in the original - only the outer
// card animates out - so there's no CONTENT_OUT_KEYFRAMES.
const CONTENT_IN_KEYFRAMES: Keyframe[] = [
  { transform: 'translateX(100%) scaleY(0)', offset: 0 },
  { transform: 'translateX(100%) scaleY(0)', offset: 0.2 },
  { transform: 'translateX(30px) scaleY(1)', offset: 0.35 },
  { transform: 'translateX(0) scaleY(1)', offset: 0.5 },
  { transform: 'translateX(35px) scaleY(1)', offset: 0.75 },
  { transform: 'translateX(0) scaleY(1)', offset: 1 },
];

const CONTENT_TIMING: KeyframeAnimationOptions = {
  duration: 950,
  easing: 'ease-out',
};

@customElement('reading-list-item')
export class ReadingListItemElement extends LitElement {
  static override styles = [theme, reset, styles];

  @property()
  name = '';

  @property({ type: String })
  href = '';

  @property({ type: String })
  favIconUrl?: string;

  @property({ type: Boolean })
  animateItems = true;

  @property({ type: Boolean })
  shiny = false;

  @property({ type: Boolean })
  locked = false;

  @property({ type: Boolean })
  reorderable = true;

  @state()
  private _dragging = false;

  @state()
  _editing = false;

  @state()
  private _editValue = '';

  @query('.edit-title')
  private _editInput?: HTMLInputElement;

  override updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('_editing') && this._editing) {
      this._editInput?.focus();
      this._editInput?.select();
    }
  }

  private get url() {
    return this.href ? new URL(this.href) : null;
  }

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
  private _faviconError = false;

  private _contentMotionOptions() {
    if (!this.animateItems) return { disabled: true };
    return {
      properties: [],
      keyframeOptions: CONTENT_TIMING,
      in: CONTENT_IN_KEYFRAMES,
    };
  }

  override render() {
    const classes = [
      'reading-list-item',
      this.shiny ? 'shiny' : '',
      this._dragging ? 'dragging' : '',
    ].join(' ');

    return html`
      <div
        class=${classes}
        draggable=${this.reorderable && !this.shiny && !this._editing && !this.locked}
        @dragstart=${this._onDragStart}
        @dragend=${() => (this._dragging = false)}
      >
        <div class="item-content" ${animate(this._contentMotionOptions())}>
          ${
            this._editing
              ? html`<input
                  class="edit-title"
                  autocomplete="off"
                  .value=${this._editValue}
                  @input=${(e: Event) => (this._editValue = (e.target as HTMLInputElement).value)}
                  @keydown=${this._onEditKeydown}
                  @blur=${() => this._commitEdit(true)}
                />`
              : html`<a
                  class="title"
                  href=${this.href}
                  draggable="false"
                  @click=${this._onLinkClick}
                  >${this.name}</a
                >`
          }
          <div class="host">${this.url?.hostname ?? this.href}</div>
          <div class="favicon">
            ${
              this.favicon && !this._faviconError
                ? html`<img
                    class="favicon-img"
                    @error=${() => (this._faviconError = true)}
                    src=${this.favicon}
                  />`
                : ''
            }
          </div>
        </div>
        ${
          this.shiny
            ? ''
            : html`<button
                class="edit-button"
                aria-label="Edit title"
                @mousedown=${(e: Event) => e.preventDefault()}
                @click=${this._onEditClick}
              >
                <span class="edit-button-content"
                  >${this._editing ? '\u{1F4BE}' : '✎'}</span
                >
              </button>`
        }
        <button class="delete-button" @click=${() => this._emit('delete-item')}>
          <span class="delete-button-content">&times;</span>
        </button>
      </div>
    `;
  }

  private async _onLinkClick(event: MouseEvent) {
    if (this.href) {
      event.preventDefault();
      const settings = await getSettings();
      const modifierDown =
        event.ctrlKey || event.metaKey || settings.openNewTab;
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
      this._emit('edit-start');
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

  private _commitEdit(save: boolean) {
    if (!this._editing) return;
    this._editing = false;
    const title = this._editValue.trim();
    if (save && title && title !== this.name)
      this._emit('edit-item', { title });
    this._emit('edit-end');
  }

  private _emit(type: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true }),
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
