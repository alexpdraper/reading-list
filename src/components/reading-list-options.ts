import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { rl, getSettings, updateSettings } from '../lib/rl';
import { i18n } from '../lib/i18n';
import { styles } from './reading-list-options.styles';

export class ReadingListOptions extends LitElement {
  static override styles = styles;

  @state() globalOpenNewTab = false;
  @state() globalAnimateItems = true;
  @state() globalAddContextMenu = true;

  override connectedCallback() {
    super.connectedCallback();
    void this._loadSettings();
  }

  override render() {
    return html`
      <h2>Reading List Options</h2>

      <div class="section">
        <h3>Default Behavior</h3>
        <div class="option">
          <input
            type="checkbox"
            id="openNewTab"
            ?checked=${this.globalOpenNewTab}
            @change=${(e: Event) => this._onSettingChange('openNewTab', e)}
          />
          <label for="openNewTab">Open items in new tab by default</label>
        </div>
        <div class="option">
          <input
            type="checkbox"
            id="animateItems"
            ?checked=${this.globalAnimateItems}
            @change=${(e: Event) => this._onSettingChange('animateItems', e)}
          />
          <label for="animateItems">Animate items</label>
        </div>
        <div class="option">
          <input
            type="checkbox"
            id="addContextMenu"
            ?checked=${this.globalAddContextMenu}
            @change=${(e: Event) => this._onSettingChange('addContextMenu', e)}
          />
          <label for="addContextMenu">Show "Add to Reading List" in the right-click menu</label>
        </div>
      </div>

      <div class="section">
        <h3>Backup & Restore</h3>
        <button @click=${this.exportList}>Export Reading List</button>
        <input id="importInput" type="file" accept="application/json" style="display:none" @change=${this.importList} />
        <button @click=${this.openImportDialog}>Import Reading List</button>
      </div>

      <details class="section">
        <summary>Advanced</summary>
        <div>
          <button class="danger" @click=${this._onResetClick}>
            ${i18n.getMessage('clearData', 'Clear Reading List')}
          </button>
        </div>
      </details>
    `;
  }

  private async _loadSettings() {
    const settings = await getSettings();
    this.globalOpenNewTab = settings.openNewTab ?? false;
    this.globalAnimateItems = settings.animateItems ?? true;
    this.globalAddContextMenu = settings.addContextMenu ?? true;
  }

  private async _onSettingChange(
    key: 'openNewTab' | 'animateItems' | 'addContextMenu',
    e: Event,
  ) {
    const checked = (e.target as HTMLInputElement).checked;
    if (key === 'openNewTab') this.globalOpenNewTab = checked;
    if (key === 'animateItems') this.globalAnimateItems = checked;
    if (key === 'addContextMenu') this.globalAddContextMenu = checked;
    await updateSettings({ [key]: checked });
  }

  async _onResetClick() {
    const confirmed = confirm(
      i18n.getMessage(
        'confirmMsg',
        'You are about to delete everything in the reading list. Are you sure?',
      ),
    );
    if (confirmed) {
      await chrome.storage.sync.clear();
    }
  }

  openImportDialog() {
    const input = (this.renderRoot as ShadowRoot)?.getElementById('importInput') as HTMLInputElement;
    if (input) input.click();
  }

  async importList(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      const text = await file.text();
      const items = JSON.parse(text);
      if (Array.isArray(items)) {
        for (const item of items) {
          await rl.addReadingItem(item);
        }
        alert('Import complete!');
      } else {
        alert('Invalid file format.');
      }
    } catch (err) {
      alert('Failed to import: ' + err);
    }
    input.value = '';
  }

  async exportList() {
    const data = await rl.getListItems();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reading-list.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

customElements.define('reading-list-options', ReadingListOptions);
