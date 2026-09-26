import { ListItemData } from './buckets.js';
import { getSettings, updateSettings } from './settings.js';
import { isFirefox } from './browser.js';

const REVIEW_URL_FIREFOX = 'https://addons.mozilla.org/en-US/firefox/addon/reading_list/';
const REVIEW_URL_CHROME =
  'https://chrome.google.com/webstore/detail/reading-list/lloccabjgblebdmncjndmiibianflabo/reviews';

export async function maybeGetReviewItem(itemCount: number): Promise<ListItemData | null> {
  if (itemCount < 6) return null;
  const settings = await getSettings();
  if (settings.askedForReview) return null;

  return {
    title: 'Like the Reading List? Give us a review!',
    url: isFirefox ? REVIEW_URL_FIREFOX : REVIEW_URL_CHROME,
    addedAt: Date.now(),
    favIconUrl: chrome.runtime.getURL('icons/icon48.png'),
  };
}

export async function dismissReview(): Promise<void> {
  await updateSettings({ askedForReview: true });
}
