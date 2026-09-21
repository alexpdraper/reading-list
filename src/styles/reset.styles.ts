import { css } from 'lit';

export const reset = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :focus-visible {
    outline: 3px solid var(--rl-focus-color);
  }
`;
