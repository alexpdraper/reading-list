import { css } from 'lit';

export const theme = css`
  :host {
    --base-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
    --base-font-size: 13px;
    --base-line-height: 1.4;
    --rl-item-gap: 0.5rem;

    --rl-page-bg-color: #fff;
    --rl-bg-color: #f7f7f7;
    --rl-hover-bg-color: #f7f7f7;
    --rl-border-color: #eee;
    --rl-tab-bg: #e9e9ed;
    --rl-text-color: #555;
    --rl-on-accent-color: #fff;
    --rl-muted-color: #ccc;

    --primary-color: #66cc98;
    --primary-color-focus: #44aa76;
    --rl-danger-color: #cc4444;
    --rl-danger-color-hover: #aa2222;

    --rl-error-bg: #fdecea;
    --rl-error-text: #611a15;

    --rl-focus-color: lightblue;
    --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
    --rl-edit-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    --rl-icon-shadow: 1px 0 1px rgba(0, 0, 0, 0.15);
    --rl-overlay-color: rgba(0, 0, 0, 0.4);

    /* Decorative, same in both color schemes. */
    --rl-shiny-gradient-start: #fa709a;
    --rl-shiny-gradient-end: #fee140;
    --rl-shiny-text-color: #000;
    --rl-shiny-shadow: 1px 3px 17px rgba(254, 225, 64, 0.9), 0px -1px 5px rgba(254, 225, 64, 0.7);
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --rl-page-bg-color: #777;
      --rl-bg-color: #555;
      --rl-hover-bg-color: #333;
      --rl-border-color: #555;
      --rl-tab-bg: var(--rl-bg-color);
      --rl-text-color: #eee;

      --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);

      --rl-error-bg: #4a2320;
      --rl-error-text: #f8d7d5;
    }
  }
`;
