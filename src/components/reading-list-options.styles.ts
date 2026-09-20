import { css } from 'lit';

export const styles = css`
  :host {
    --rl-bg-color: #f9f9f9;
    --rl-text-color: #222;
    --rl-input-bg: #fff;
    --rl-input-border: #ccc;

    display: block;
    padding: 2em;
    background: var(--rl-bg-color);
    color: var(--rl-text-color);
    font-family: sans-serif;
  }

  select {
    font-size: 1em;
    padding: 0.3em;
    background: var(--rl-input-bg);
    color: var(--rl-text-color);
    border: 1px solid var(--rl-input-border);
    border-radius: 4px;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --rl-bg-color: #181a20;
      --rl-text-color: #e0e0e0;
      --rl-input-bg: #23272e;
      --rl-input-border: #444;
    }
  }

  :host([theme='dark']) {
    --rl-bg-color: #181a20;
    --rl-text-color: #e0e0e0;
    --rl-input-bg: #23272e;
    --rl-input-border: #444;
  }

  :host([theme='light']) {
    --rl-bg-color: #f9f9f9;
    --rl-text-color: #222;
    --rl-input-bg: #fff;
    --rl-input-border: #ccc;
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

  input[type='checkbox'] {
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

  button.danger {
    background: #cc4444;
  }

  button.danger:hover {
    background: #aa2222;
  }

  details {
    margin-top: 1em;
  }

  summary {
    cursor: pointer;
    font-weight: bold;
  }

  details > div {
    margin-top: 1em;
  }
`;
