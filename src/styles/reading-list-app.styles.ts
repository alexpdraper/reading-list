import { css } from 'lit';

export const styles = css`
  :host {
    /* containing block for .editing-overlay */
    position: relative;
    display: block;
  }

  .visually-hidden:not(caption) {
    position: absolute !important;
  }

  .visually-hidden {
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }

  h1 {
    margin: 0;
    font-size: 1.6rem;
    line-height: 1.25;
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding-bottom: 0.5rem;
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .save-button,
  .settings-button {
    --button-size: 2rem;

    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--button-size);
    height: var(--button-size);
    font-weight: bold;
    border: 0;
    border-radius: 9999px;
    text-align: center;
    /* The glyph's line box carries more space above it than below within
       this flex item; nudge it down to actually center the ink. */
    padding-bottom: 4px;
  }

  .save-button {
    color: var(--rl-on-accent-color);
    background: var(--primary-color);
  }

  .save-button:hover,
  .save-button:focus {
    background-color: var(--primary-color-focus);
  }

  .settings-button {
    background: transparent;
    color: var(--rl-text-color);
    font-size: 1.4rem;
    cursor: pointer;
  }

  .settings-button:hover,
  .settings-button:focus {
    background-color: var(--rl-bg-color);
  }

  .save-button:focus,
  .settings-button:focus {
    outline: 3px solid var(--rl-focus-color);
  }

  .sidebar-button {
    background: transparent;
    color: var(--rl-text-color);
    border: 1px solid var(--rl-text-color);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
  }

  .sidebar-button:hover,
  .sidebar-button:focus {
    background-color: var(--rl-bg-color);
    color: var(--primary-color);
    border-color: var(--primary-color);
  }

  .sidebar-button:focus {
    outline: 3px solid var(--rl-focus-color);
  }

  search {
    margin: 0;
    padding-bottom: 0.5rem;
  }

  input {
    font-size: inherit;
    border: 1px solid var(--rl-border-color);
    border-radius: 0.25rem;
    padding: 0.5rem;
    background: transparent;
    width: 100%;
    margin: 0;
    color: var(--rl-text-color);
  }

  input:focus {
    outline: 3px solid var(--rl-focus-color);
    border-color: var(--primary-color);
  }

  [type='search'] {
    -webkit-appearance: textfield;
  }
  [type='search']::-webkit-search-cancel-button,
  [type='search']::-webkit-search-decoration {
    -webkit-appearance: none;
  }

  reading-list-item {
    display: block;
  }

  reading-list-item:not(:first-child) {
    margin-top: 0.5rem;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .filter,
  .sort {
    display: flex;
    flex: 1;
    box-shadow: var(--rl-shadow);
    border-radius: 4px;
    overflow: hidden;
  }

  .filter button,
  .sort button {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.25rem;
    border: 0;
    background: var(--rl-tab-bg);
    color: var(--rl-text-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.5rem;
    cursor: pointer;
  }

  .filter button:hover,
  .filter button:focus,
  .filter button.active,
  .sort button:hover,
  .sort button:focus,
  .sort button.active {
    background: var(--rl-hover-bg-color);
    color: var(--primary-color);
  }

  .count {
    font-size: 80%;
    display: inline-block;
    border: 1px solid currentColor;
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
  }

  .arrow {
    display: none;
    border: solid currentColor;
    border-width: 0 2px 2px 0;
    padding: 3px;
    transition: transform 0.3s ease;
  }

  .arrow.up,
  .arrow.down {
    display: inline-block;
  }

  .arrow.up {
    transform: rotate(-135deg);
  }

  .arrow.down {
    transform: rotate(45deg);
  }

  .sync-error {
    margin: 0 0 0.5rem;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    background: var(--rl-error-bg);
    color: var(--rl-error-text);
  }

  /* Sits above everything except the item currently being edited (which
     lifts itself to z-index: 11 - see reading-list-item.styles.ts).
     inset: -1rem bleeds past :host's own box to also cover <main>'s
     padding: 1rem in popup.html/sidebar.html - that padding lives outside
     this shadow root, so :host's own bounds alone don't reach it. */
  .editing-overlay {
    position: absolute;
    inset: -1rem;
    background: var(--rl-overlay-color);
    z-index: 10;
  }

  @media (prefers-color-scheme: dark) {
    .save-button {
      background: var(--rl-bg-color);
    }
    .save-button:hover,
    .save-button:focus {
      background: var(--rl-hover-bg-color);
    }
    .filter button:hover,
    .filter button:focus,
    .filter button.active,
    .sort button:hover,
    .sort button:focus,
    .sort button.active {
      color: var(--rl-text-color);
    }
  }
`;
