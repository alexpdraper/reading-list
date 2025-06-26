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

    button {
      padding: 0.5em 1em;
      font-size: 1em;
      margin-top: 1em;
    }
  `;

  override render() {
    return html`
      <h2>Reading List Options</h2>
      <button @click=${this.exportList}>Export Reading List</button>
      <input id="importInput" type="file" accept="application/json" style="display:none" @change=${this.importList} />
      <button @click=${this.openImportDialog}>Import Reading List</button>
    `;
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
