export const isFirefox = navigator.userAgent.includes('Firefox');

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function openLink(url: string, newTab: boolean) {
  if (newTab) {
    chrome?.tabs.create({ url: url, active: false }).catch(console.error);
    return;
  }

  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.update(tab.id, { url: url }).catch(console.error);

    const isPopup = document.body.classList.contains('popup-page');
    if (isPopup) {
      window.close();
    }
  }
}
