import { css } from 'lit';

export const animations = css`
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
`;
