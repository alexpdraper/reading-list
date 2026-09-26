import { html, LitElement } from 'lit';
import { query, state } from 'lit/decorators.js';
import { rl } from '../lib/rl.js';
import {
  getSettings,
  updateSettings,
  onSettingsChanged,
} from '../lib/settings.js';
import { message } from '../lib/browser.js';
import { getStorageDiagnostics } from '../lib/storage/diagnostics.js';
import { readItemsWithoutWriting } from '../lib/storage/load.js';
import { getLocalBackup } from '../lib/storage/local-backup.js';
import { flatStore } from '../lib/storage/flat-store.js';
import { ListItemData } from '../lib/storage/store.js';
import { styles } from '../styles/options.styles.js';
import { theme } from '../styles/theme.styles.js';
import { reset } from '../styles/reset.styles.js';

type CheckboxSettingKey = 'openNewTab' | 'animateItems' | 'addContextMenu';

const CHECKBOX_SETTINGS: { key: CheckboxSettingKey; label: string }[] = [
  { key: 'openNewTab', label: 'Open items in new tab by default' },
  { key: 'animateItems', label: 'Animate items' },
  {
    key: 'addContextMenu',
    label: 'Show "Add to Reading List" in the right-click menu',
  },
];

export class ReadingListOptions extends LitElement {
  static override styles = [theme, reset, styles];

  @state() settings: Record<CheckboxSettingKey, boolean> = {
    openNewTab: false,
    animateItems: true,
    addContextMenu: true,
  };

  @state() private _diagnostics = '';
  @state() private _diagnosticsCopied = false;
  @query('#importInput') private _importInput?: HTMLInputElement;

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
        <input
          id="importInput"
          type="file"
          accept="application/json"
          style="display:none"
          @change=${this.importList}
        />
        <button @click=${this.openImportDialog}>Import Reading List</button>
      </div>

      <details class="section">
        <summary>Advanced</summary>
        <div>
          <button @click=${this._onDiagnosticsClick}>
            Storage Diagnostics
          </button>
          <button @click=${this._onDownloadLocalBackupClick}>
            Download Local Backup
          </button>
          <button class="danger" @click=${this._onResetClick}>
            ${message('clearData', 'Clear Reading List')}
          </button>
        </div>
        ${
          this._diagnostics
            ? html`
                <div class="diagnostics">
                  <p>
                    Contains counts and sizes only - no page addresses or titles
                    - so it's safe to send in a bug report.
                  </p>
                  <button @click=${this._onCopyDiagnosticsClick}>
                    ${this._diagnosticsCopied ? 'Copied' : 'Copy to Clipboard'}
                  </button>
                  <pre>${this._diagnostics}</pre>
                </div>
              `
            : ''
        }
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
    if (
      confirm(
        message(
          'confirmMsg',
          'You are about to delete everything in the reading list. Are you sure?',
        ),
      )
    ) {
      await rl.clearAll();
    }
  }

  async _onDiagnosticsClick() {
    this._diagnosticsCopied = false;
    try {
      this._diagnostics = await getStorageDiagnostics();
    } catch (err) {
      this._diagnostics = `Storage Diagnostics itself failed: ${err}`;
    }
  }

  async _onCopyDiagnosticsClick() {
    await navigator.clipboard.writeText(this._diagnostics);
    this._diagnosticsCopied = true;
  }

  async _onDownloadLocalBackupClick() {
    const backup = await getLocalBackup();
    if (!backup) {
      alert(
        'No local backup found yet. One is saved automatically before the extension migrates data from an older version.',
      );
      return;
    }
    downloadJson('reading-list-backup.json', backup.items);
  }

  openImportDialog() {
    this._importInput?.click();
  }

  async importList(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const items: ListItemData[] | null = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? flatStore.readItems(parsed)
          : null;

      if (items) {
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
    downloadJson('reading-list.json', await readItemsWithoutWriting());
  }
}

function downloadJson(filename: string, data: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
}

customElements.define('reading-list-options', ReadingListOptions);
