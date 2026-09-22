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

  reading-list-item {
    display: block;
  }

  reading-list-item:not(:first-child) {
    margin-top: 0.5rem;
  }

  .sync-error {
    margin: 0 0 0.5rem;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    background: var(--rl-error-bg);
    color: var(--rl-error-text);
  }

  /* Sits above everything, including the card being edited - only its
     .edit-title input rises above this (z-index: 11 - see item.styles.ts),
     so the text box is the one thing that stays undimmed/interactive.
     inset: -1rem bleeds past :host's own box to also cover <main>'s
     padding: 1rem in popup.html/sidebar.html - that padding lives outside
     this shadow root, so :host's own bounds alone don't reach it. */
  .editing-overlay {
    position: absolute;
    inset: -1rem;
    background: var(--rl-overlay-color);
    z-index: 10;
  }
`;
