import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    padding: 2em;
    background: var(--rl-page-bg-color);
    color: var(--rl-text-color);
    font-family: var(--base-font);
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
    background: var(--primary-color);
    color: var(--rl-on-accent-color);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background: var(--primary-color-focus);
  }

  button.danger {
    background: var(--rl-danger-color);
  }

  button.danger:hover {
    background: var(--rl-danger-color-hover);
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

  @media (prefers-color-scheme: dark) {
    button {
      background: var(--rl-bg-color);
      color: var(--rl-text-color);
    }

    button:hover {
      background: var(--rl-hover-bg-color);
    }
  }
`;
