import { css } from 'lit';

export const header = css`
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

  @media (prefers-color-scheme: dark) {
    .save-button {
      background: var(--rl-bg-color);
    }
    .save-button:hover,
    .save-button:focus {
      background: var(--rl-hover-bg-color);
    }
  }
`;
