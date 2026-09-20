import { css } from 'lit';

export const theme = css`
  :host {
    --rl-bg-color: #f7f7f7;
    --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
    --primary-color: #66cc98;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --rl-bg-color: #555;
      --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
      --primary-color: #66cc98;
    }
  }
`;
