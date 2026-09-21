import { css } from 'lit';

export const styles = css`
  :host {
    font-family: var(--base-font);
    font-size: var(--base-font-size);
    line-height: var(--base-line-height);

    /* clips the slidein transform so it can't scroll the popup */
    display: block;
    overflow: hidden;
  }


  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :focus-visible {
    outline: 3px solid var(--rl-focus-color);
  }

  .reading-list-item {
    border-radius: 3px;
    padding: 0;
    margin: 0;
    position: relative;
    overflow: hidden;
    transition: all 0.5s ease 0s;
    color: var(--rl-text-color);
    background-color: var(--rl-bg-color);
    box-shadow: var(--rl-shadow);
  }

  .reading-list-item.slidein {
    animation: 0.2s linear slidein;
  }

  .reading-list-item.slidein .item-content {
    animation: 0.8s ease-out slidein-bounce;
    animation-fill-mode: forwards;
  }

  @keyframes slidein-bounce {
    0% {
      transform: translateX(100%) scaleY(0);
    }
    40% {
      transform: translateX(100%) scaleY(0);
    }
    50% {
      transform: translateX(30px) scaleY(1);
    }
    60% {
      transform: translateX(0) scaleY(1);
    }
    80% {
      transform: translateX(35px) scaleY(1);
    }
    100% {
      transform: translateX(0) scaleY(1);
    }
  }

  @keyframes slidein {
    0% {
      max-height: 0px;
      transform: translateX(100%) scaleY(0);
    }
    80% {
      max-height: 100px;
    }
    100% {
      transform: translateX(0) scaleY(1);
    }
  }

  .reading-list-item.slideout {
    margin: 0;
    animation: 0.65s slideout;
    /* holds the collapsed end state through the async gap before the DOM node is actually removed */
    animation-fill-mode: forwards;
  }

  @keyframes slideout {
    0% {
      max-height: 100px;
      transform: translateX(0) scaleY(1);
    }
    40% {
      max-height: 0px;
    }
    100% {
      max-height: 0px;
      transform: translateX(100%) scaleY(0);
    }
  }

  [draggable='true'] {
    cursor: grab;
  }


  /* Dimming while another item is being edited is handled by
     reading-list-app's app-wide .editing-overlay, which also blocks clicks
     to everything it covers - this item just needs to rise above it. */
  .reading-list-item.editing {
    position: relative;
    z-index: 11;
  }

  .reading-list-item.shiny {
    background: linear-gradient(
      to right,
      var(--rl-shiny-gradient-start) 0%,
      var(--rl-shiny-gradient-end) 100%
    );
  }

  .reading-list-item.shiny .item-content,
  .reading-list-item.shiny .delete-button-content {
    color: var(--rl-shiny-text-color);
  }

  .reading-list-item.shiny .item-content:hover,
  .reading-list-item.shiny .item-content:focus {
    color: var(--rl-shiny-gradient-end);
    background: transparent;
  }

  .reading-list-item.shiny .item-content:hover .favicon,
  .reading-list-item.shiny .item-content:focus .favicon,
  .reading-list-item.shiny .favicon {
    border-color: transparent;
  }

  .reading-list-item.shiny .delete-button:focus-visible .delete-button-content,
  .reading-list-item.shiny .delete-button:hover .delete-button-content {
    background: transparent;
    color: var(--rl-shiny-gradient-start);
  }

  .reading-list-item.shiny:hover,
  .reading-list-item.shiny:focus-within {
    box-shadow: var(--rl-shiny-shadow);
  }

  .favicon {
    position: absolute;
    top: var(--rl-item-gap);
    left: var(--rl-item-gap);
    width: 36px;
    height: 36px;
    border-radius: 0.25rem;
    border: 1px solid var(--rl-muted-color);
    padding: 1px;
  }

  .favicon-img {
    width: 100%;
    height: 100%;
    border-radius: 2px;
  }

  .item-content {
    text-decoration: none;
    display: block;
    width: 100%;
    padding: 10px 50px 10px 56px;
    min-height: 56px;
    position: relative;
  }

  .item-content:hover,
  .item-content:focus,
  .reading-list-item.dragging .item-content {
    color: var(--primary-color);
    background-color: var(--rl-hover-bg-color);
  }

  .item-content:hover .favicon,
  .item-content:focus .favicon,
  .reading-list-item.dragging .item-content .favicon {
    border-color: var(--primary-color);
  }

  .title,
  .host {
    overflow-wrap: break-word;
    color: inherit;
  }

  @media screen and (max-width: 200px) {
    .title,
    .host {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
  }

  .title {
    display: block;
    font-weight: bold;
    text-decoration: none;
    border-radius: 0.25rem;
  }

  .title::after {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1;
    content: '';
  }

  .host {
    display: block;
  }

  .edit-title {
    font: inherit;
    font-weight: bold;
    width: 100%;
    padding: 0.125rem 0.25rem;
    margin: 0;
    border: 0;
    border-radius: 0.25rem;
    background-color: var(--rl-hover-bg-color);
    box-shadow: var(--rl-edit-shadow);
    color: inherit;
    position: relative;
    z-index: 3;
  }

  .edit-title:focus {
    outline: none;
  }

  .delete-button {
    position: absolute;
    text-align: center;
    font-weight: bold;
    top: 0;
    right: 0;
    padding: 0;
    border-radius: 0;
    width: 1.5rem;
    height: 1.5rem;
    border: 0;
    background: transparent;
    z-index: 2;
  }

  .edit-button {
    position: absolute;
    bottom: 0.4rem;
    right: 0.4rem;
    padding: 0;
    width: 0.7rem;
    height: 0.7rem;
    border: 0;
    border-radius: 0;
    margin: 0;
    text-align: center;
    background: transparent;
    color: var(--rl-muted-color);
    transition: all 0.5s ease;
    z-index: 2;
  }

  .edit-button:hover,
  .edit-button:focus-visible {
    cursor: pointer;
    width: 1.5rem;
    height: 1.5rem;
    bottom: -0.1rem;
    right: 0.1rem;
    border-radius: 100%;
    box-shadow: var(--rl-icon-shadow);
  }

  .delete-button-content,
  .edit-button-content {
    color: var(--rl-muted-color);
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    transform: rotateZ(0) scale(1);
    background: transparent;
    transition: transform 0.3s ease, box-shadow 0.5s ease;
  }

  .delete-button:focus-visible,
  .edit-button:focus-visible {
    outline: none;
  }

  .delete-button:focus-visible .delete-button-content,
  .edit-button:focus-visible .edit-button-content {
    outline: 3px solid var(--rl-focus-color);
  }

  .delete-button:focus-visible .delete-button-content,
  .delete-button:hover .delete-button-content {
    color: var(--rl-on-accent-color);
    transform: rotateZ(90deg) scale(2);
    box-shadow: var(--rl-icon-shadow);
    background: var(--rl-muted-color);
  }

  .edit-button:focus-visible .edit-button-content,
  .edit-button:hover .edit-button-content {
    color: var(--rl-on-accent-color);
    transform: scale(2);
    /* Nudges the pencil glyph, not the circle - the circle's size/position
       comes from this span's own (fixed) box, unaffected by its padding. */
    padding-bottom: 4px;
    background: var(--rl-muted-color);
  }

  @media (prefers-color-scheme: dark) {
    .favicon {
      border: 0;
    }

    .delete-button:focus-visible .delete-button-content,
    .delete-button:hover .delete-button-content,
    .edit-button:focus-visible .edit-button-content,
    .edit-button:hover .edit-button-content {
      background: var(--rl-hover-bg-color);
    }
  }
`;
