import { html, css, LitElement } from 'lit';
import { rl } from '../lib/rl';

export class ReadingListOptions extends LitElement {
  static override styles = css`
    :host {
      display: block;
      padding: 2em;
      background: #f9f9f9;
      color: #222;
      font-family: sans-serif;
    }

    h2 {
      margin-top: 0;
    }

    .section {
      margin-bottom: 2em;
    }

    .option {
      margin-bottom: 1.5em;
      display: flex;
      align-items: center;
      gap: 1em;
    }

    input[type="checkbox"] {
      width: 1.2em;
      height: 1.2em;
      cursor: pointer;
    }

    label {
      cursor: pointer;
      font-size: 1em;
    }

    button {
      padding: 0.5em 1em;
      font-size: 1em;
      margin-top: 1em;
      background: #66cc98;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover {
      background: #44aa76;
    }
  `;

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
            @change=${this._onOpenNewTabChange}
          />
          <label for="openNewTab">Open items in new tab by default</label>
        </div>
      </div>

      <div class="section">
        <h3>Backup & Restore</h3>
        <button @click=${this.exportList}>Export Reading List</button>
        <input
          id="importInput"
          type="file"
          accept="application/json"
          style="display:none"
          @change=${this.importList}
        />
        <button @click=${this.openImportDialog}>Import Reading List</button>
      </div>
    `;
  }

  globalOpenNewTab = false;

  override connectedCallback() {
    super.connectedCallback();
    this._loadSettings();
  }

  private async _loadSettings() {
    const settings = await chrome.storage.sync.get('settings');
    if (settings.settings) {
      this.globalOpenNewTab = settings.settings.openNewTab ?? false;
    }
  }

  private async _onOpenNewTabChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.globalOpenNewTab = input.checked;

    const settings = await chrome.storage.sync.get('settings');
    const currentSettings = settings.settings || {};

    await chrome.storage.sync.set({
      settings: {
        ...currentSettings,
        openNewTab: this.globalOpenNewTab,
      },
    });
  }

  openImportDialog() {
    const input = this.renderRoot?.querySelector('#importInput') as HTMLInputElement;
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
