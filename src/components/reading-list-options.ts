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
    `;
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

