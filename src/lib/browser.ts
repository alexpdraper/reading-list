export const isFirefox = navigator.userAgent.includes('Firefox');

export function openLink(url: string, newTab: boolean) {
  if (newTab) {
    chrome?.tabs.create({ url: url, active: false }).catch(console.error);
  } else {
    chrome?.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      (tabs) => {
        const tab = tabs[0];

        if (tab.id) {
          chrome.tabs.update(tab.id, { url: url }).catch(console.error);

          const isPopup = document.body.classList.contains('popup-page');
          if (isPopup) {
            window.close();
          }
        }
      },
    );
  }
}
