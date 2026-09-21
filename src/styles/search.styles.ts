import { css } from 'lit';

export const search = css`
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
`;
