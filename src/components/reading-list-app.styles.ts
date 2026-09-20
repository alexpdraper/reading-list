import { css } from 'lit';

export const styles = css`
  :host {
    --base-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
    --base-font-size: 13px;
    --base-line-height: 1.4;
    --container-width: 360px;
    --spacer: 15px;
    --rl-bg-color: #f7f7f7;
    --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
    --rl-link-color: #555;
    --rl-link-hover-bg: #fff;
    --primary-color: #66cc98;
    --primary-color-focus: #44aa76;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :focus-visible {
    outline: 3px solid lightblue;
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

    width: var(--button-size);
    height: var(--button-size);
    line-height: var(--button-size);
    font-weight: bold;
    border: 0;
    border-radius: 9999px;
    text-align: center;
  }

  .save-button {
    color: #fff;
    background: var(--primary-color);
  }

  .save-button:hover,
  .save-button:focus {
    background-color: var(--primary-color-focus);
  }

  .settings-button {
    background: transparent;
    color: var(--rl-link-color);
    font-size: 1.1rem;
    cursor: pointer;
  }

  .settings-button:hover,
  .settings-button:focus {
    background-color: var(--rl-bg-color);
  }

  .save-button:focus,
  .settings-button:focus {
    outline: 3px solid lightblue;
  }

  .sidebar-button {
    background: transparent;
    color: var(--rl-link-color);
    border: 1px solid var(--rl-link-color);
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
    outline: 3px solid lightblue;
  }

  search {
    margin: 0;
    padding-bottom: 0.5rem;
  }

  input {
    font-size: inherit;
    border: 1px solid #eee;
    border-radius: 0.25rem;
    padding: 0.5rem;
    background: transparent;
    width: 100%;
    margin: 0;
  }

  input:focus {
    outline: 3px solid lightblue;
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
    background: var(--rl-bg-color);
    color: var(--rl-link-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.7rem;
    padding: 0.5rem;
    cursor: pointer;
  }

  .filter button:hover,
  .filter button:focus,
  .filter button.active,
  .sort button:hover,
  .sort button:focus,
  .sort button.active {
    background: var(--rl-link-hover-bg);
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

  @media (prefers-color-scheme: dark) {
    :host {
      --rl-bg-color: #23272e;
      --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
      --rl-link-color: #e0e0e0;
      --rl-link-hover-bg: #2c313a;
      --primary-color: #66cc98;
      --primary-color-focus: #44aa76;
    }
    input {
      background: #181a20;
      color: #e0e0e0;
      border-color: #444;
    }
    input:focus {
      border-color: var(--primary-color);
    }
    body,
    main {
      background: #181a20;
      color: #e0e0e0;
    }
  }

  :host([theme='dark']) {
    --rl-bg-color: #23272e;
    --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
    --rl-link-color: #e0e0e0;
    --rl-link-hover-bg: #2c313a;
    --primary-color: #66cc98;
    --primary-color-focus: #44aa76;
  }
  :host([theme='dark']) input {
    background: #181a20;
    color: #e0e0e0;
    border-color: #444;
  }

  :host([theme='light']) {
    --rl-bg-color: #f7f7f7;
    --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
    --rl-link-color: #555;
    --rl-link-hover-bg: #fff;
    --primary-color: #66cc98;
    --primary-color-focus: #44aa76;
  }
  :host([theme='light']) input {
    background: transparent;
    color: inherit;
    border-color: #eee;
  }
`;
