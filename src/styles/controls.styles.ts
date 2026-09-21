import { css } from 'lit';

export const controls = css`
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

  @media (prefers-color-scheme: dark) {
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
