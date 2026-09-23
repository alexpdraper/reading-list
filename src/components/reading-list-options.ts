import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { rl } from '../lib/rl.js';
import { getSettings, updateSettings, onSettingsChanged } from '../lib/settings.js';
import { getStorageDiagnostics } from '../lib/storage/diagnostics.js';
import { ListItemData } from '../lib/storage/buckets.js';
import { i18n } from '../lib/i18n.js';
import { styles } from '../styles/options.styles.js';
import { theme } from '../styles/theme.styles.js';
import { reset } from '../styles/reset.styles.js';

type CheckboxSettingKey = 'openNewTab' | 'animateItems' | 'addContextMenu';

const CHECKBOX_SETTINGS: { key: CheckboxSettingKey; label: string }[] = [
  { key: 'openNewTab', label: 'Open items in new tab by default' },
  { key: 'animateItems', label: 'Animate items' },
  { key: 'addContextMenu', label: 'Show "Add to Reading List" in the right-click menu' },
];

export class ReadingListOptions extends LitElement {
  static override styles = [theme, reset, styles];

  @state() settings: Record<CheckboxSettingKey, boolean> = {
    openNewTab: false,
    animateItems: true,
    addContextMenu: true,
  };

  private _unsubscribeSettings?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    void this._loadSettings();
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = onSettingsChanged((settings) => {
      this.settings = {
        openNewTab: settings.openNewTab,
        animateItems: settings.animateItems,
        addContextMenu: settings.addContextMenu,
      };
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribeSettings?.();
    this._unsubscribeSettings = undefined;
  }

  override render() {
    return html`
      <h2>Reading List Options</h2>

      <div class="section">
        <h3>Default Behavior</h3>
        ${CHECKBOX_SETTINGS.map(
          ({ key, label }) => html`
            <div class="option">
              <input
                type="checkbox"
                id=${key}
                ?checked=${this.settings[key]}
                @change=${(e: Event) => this._onSettingChange(key, e)}
              />
              <label for=${key}>${label}</label>
            </div>
          `,
        )}
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
          <button @click=${this._onDiagnosticsClick}>Storage Diagnostics</button>
          <button class="danger" @click=${this._onResetClick}>
            ${i18n.getMessage('clearData', 'Clear Reading List')}
          </button>
        </div>
      </details>
    `;
  }

  private async _loadSettings() {
    const settings = await getSettings();
    this.settings = {
      openNewTab: settings.openNewTab,
      animateItems: settings.animateItems,
      addContextMenu: settings.addContextMenu,
    };
  }

  private async _onSettingChange(key: CheckboxSettingKey, e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.settings = { ...this.settings, [key]: checked };
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
      await rl.clearAll();
    }
  }

  async _onDiagnosticsClick() {
    alert(await getStorageDiagnostics());
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
      const parsed = JSON.parse(text);
      // The old extension's export is a raw chrome.storage.sync dump: one
      // key per item URL, plus a "settings" key - not an array like this
      // app's own export. Only the URL-keyed entries are reading items.
      const items: ListItemData[] | null = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? Object.entries(parsed as Record<string, ListItemData>)
              .filter(([key]) => /^https?:\/\//i.test(key))
              .map(([, value]) => value)
          : null;

      if (items) {
        await rl.getListItems();
        const { succeeded, firstError, diagnostics } =
          await rl.bulkAddReadingItems(items);
        if (succeeded === items.length) {
          alert(`Import complete! Added ${succeeded} items.`);
        } else {
          alert(
            `Imported ${succeeded} of ${items.length} items. ` +
              `${items.length - succeeded} failed` +
              (firstError ? ` (first error: ${firstError})` : '') +
              (diagnostics ? `\n\nDiagnostics: ${diagnostics}` : ''),
          );
        }
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
