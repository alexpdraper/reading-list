import { css } from 'lit';

export const styles = css`
  :host {
    --base-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
    --base-font-size: 13px;
    --base-line-height: 1.4;
    --container-width: 360px;
    --spacer: 15px;
    --rl-bg-color: #f7f7f7;
    --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
    --rl-link-color: #555;
    --rl-link-hover-bg: #fff;
    --primary-color: #66cc98;
    --rl-item-gap: 0.5rem;

    font-family: var(--base-font);
    font-size: var(--base-font-size);
    line-height: var(--base-line-height);

    /* clips the slidein transform so it can't scroll the popup */
    display: block;
    overflow: hidden;
  }

  :host([theme='dark']) {
    --rl-bg-color: #23272e;
    --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
    --rl-link-color: #e0e0e0;
    --rl-link-hover-bg: #2c313a;
    --primary-color: #66cc98;
  }

  :host([theme='light']) {
    --rl-bg-color: #f7f7f7;
    --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.05);
    --rl-link-color: #555;
    --rl-link-hover-bg: #fff;
    --primary-color: #66cc98;
  }

  :host([theme='dark']) .favicon {
    border-color: #444;
  }
  :host([theme='dark']) .delete-button-content,
  :host([theme='dark']) .edit-button-content {
    color: #888;
  }
  :host([theme='dark']) .delete-button:focus-visible .delete-button-content,
  :host([theme='dark']) .delete-button:hover .delete-button-content,
  :host([theme='dark']) .edit-button:focus-visible .edit-button-content,
  :host([theme='dark']) .edit-button:hover .edit-button-content {
    background: #444;
  }

  :host([theme='light']) .favicon {
    border-color: #ccc;
  }
  :host([theme='light']) .delete-button-content,
  :host([theme='light']) .edit-button-content {
    color: #ccc;
  }
  :host([theme='light']) .delete-button:focus-visible .delete-button-content,
  :host([theme='light']) .delete-button:hover .delete-button-content,
  :host([theme='light']) .edit-button:focus-visible .edit-button-content,
  :host([theme='light']) .edit-button:hover .edit-button-content {
    background: #ccc;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :focus-visible {
    outline: 3px solid lightblue;
  }

  .reading-list-item {
    border-radius: 3px;
    padding: 0;
    margin: 0;
    position: relative;
    overflow: hidden;
    transition: all 0.5s ease 0s;
    color: var(--rl-link-color);
    background-color: var(--rl-bg-color);
    box-shadow: var(--rl-shadow);
  }

  .reading-list-item.slidein {
    animation: 0.2s linear slidein;
  }

  .reading-list-item.slidein .item-content {
    animation: 0.8s ease-out slidein-bounce;
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

  .reading-list-item.dragging {
    opacity: 0.5;
  }

  .reading-list-item.shiny {
    background: linear-gradient(to right, #fa709a 0%, #fee140 100%);
  }

  .reading-list-item.shiny .item-content,
  .reading-list-item.shiny .delete-button-content {
    color: #000;
  }

  .reading-list-item.shiny .item-content:hover,
  .reading-list-item.shiny .item-content:focus {
    color: #fee140;
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
    color: #fa709a;
  }

  .reading-list-item.shiny:hover,
  .reading-list-item.shiny:focus-within {
    box-shadow: 1px 3px 17px rgba(254, 225, 64, 0.9), 0px -1px 5px rgba(254, 225, 64, 0.7);
  }

  .favicon {
    position: absolute;
    top: var(--rl-item-gap);
    left: var(--rl-item-gap);
    width: 36px;
    height: 36px;
    border-radius: 0.25rem;
    border: 1px solid #ccc;
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
    padding: 10px 74px 10px 56px;
    min-height: 56px;
    position: relative;
  }

  .item-content:hover,
  .item-content:focus {
    color: var(--primary-color);
    background-color: var(--rl-link-hover-bg);
  }

  .item-content:hover .favicon,
  .item-content:focus .favicon {
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
    padding: 0;
    margin: 0;
    border: 0;
    border-bottom: 1px solid var(--primary-color);
    background: transparent;
    color: inherit;
    position: relative;
    z-index: 2;
  }

  .edit-title:focus {
    outline: none;
  }

  .delete-button,
  .edit-button {
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
    right: 1.5rem;
  }

  .delete-button-content,
  .edit-button-content {
    color: #ccc;
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
    outline: 3px solid lightblue;
  }

  .delete-button:focus-visible .delete-button-content,
  .delete-button:hover .delete-button-content {
    color: #fff;
    transform: rotateZ(90deg) scale(2);
    box-shadow: 1px 0 1px rgba(0, 0, 0, 0.15);
    background: #ccc;
  }

  .edit-button:focus-visible .edit-button-content,
  .edit-button:hover .edit-button-content {
    color: #fff;
    transform: scale(1.2);
    box-shadow: 1px 0 1px rgba(0, 0, 0, 0.15);
    background: #ccc;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --rl-bg-color: #23272e;
      --rl-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3);
      --rl-link-color: #e0e0e0;
      --rl-link-hover-bg: #2c313a;
      --primary-color: #66cc98;
    }

    .reading-list-item {
      background-color: var(--rl-bg-color);
      color: var(--rl-link-color);
      box-shadow: var(--rl-shadow);
    }

    .item-content {
      color: var(--rl-link-color);
    }

    .item-content:hover,
    .item-content:focus {
      background-color: var(--rl-link-hover-bg);
      color: var(--primary-color);
    }

    .favicon {
      border-color: #444;
    }

    .delete-button-content,
    .edit-button-content {
      color: #888;
    }

    .delete-button:focus-visible .delete-button-content,
    .delete-button:hover .delete-button-content,
    .edit-button:focus-visible .edit-button-content,
    .edit-button:hover .edit-button-content {
      background: #444;
      color: #fff;
    }
  }
`;
