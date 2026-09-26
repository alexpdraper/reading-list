import { makeSyntheticItems } from '../helpers/items.mjs';

export const LEGACY_301_SMALL_ITEMS = makeSyntheticItems(20, { baseTimestamp: 1_640_000_000_000 });

export const LEGACY_301_WITH_SETTINGS_ITEMS = makeSyntheticItems(25, {
  baseTimestamp: 1_650_000_000_000,
});
export const LEGACY_301_SETTINGS = {
  addContextMenu: true,
  addPageAction: false,
  animateItems: true,
  askedForReview: true,
  openNewTab: false,
  theme: 'light',
  viewAll: true,
};

export const V31_40_BUCKETS_ITEMS = makeSyntheticItems(60, { baseTimestamp: 1_680_000_000_000 });

export const V32_TIER_25_ITEMS = makeSyntheticItems(100, { baseTimestamp: 1_700_000_000_000 });
export const V32_TIER_30_ITEMS = makeSyntheticItems(200, { baseTimestamp: 1_710_000_000_000 });
export const V32_TIER_35_ITEMS = makeSyntheticItems(280, { baseTimestamp: 1_720_000_000_000 });

export const V32_NEAR_CAPACITY_SOURCE_ITEMS = makeSyntheticItems(1000, {
  baseTimestamp: 1_690_000_000_000,
});

export const LEGACY_V2_ITEMS = [
  { url: 'https://news.oldreader.test/2019/06/12/browser-extensions-then-and-now', title: 'Browser extensions, then and now', addedAt: 1560340000000, viewed: true },
  { url: 'https://blog.oldreader.test/posts/manifest-v2-migration-notes', title: 'Manifest V2 migration notes', addedAt: 1561000000000, viewed: false },
  { url: 'https://docs.oldreader.test/guide/sync-storage-limits', title: 'Understanding sync storage limits', addedAt: 1561500000000, viewed: false },
  { url: 'https://forum.oldreader.test/t/reading-list-workflows/482', title: 'Reading list workflows megathread', addedAt: 1562000000000, viewed: true, index: 0 },
  { url: 'https://shop.oldreader.test/reviews/mechanical-keyboards-2019', title: 'Mechanical keyboards worth buying in 2019', addedAt: 1562400000000, viewed: false },
  { url: 'https://wiki.oldreader.test/wiki/Context_menus', title: 'Context menus', addedAt: 1562800000000, viewed: false, index: 0 },
  { url: 'https://news.oldreader.test/2019/07/03/offline-first-apps', title: 'Offline-first apps done right', addedAt: 1563200000000, viewed: true },
  { url: 'https://blog.oldreader.test/posts/why-we-rewrote-our-sidebar', title: 'Why we rewrote our sidebar', addedAt: 1563600000000, viewed: false },
  { url: 'https://docs.oldreader.test/guide/badge-icons', title: 'Badge icons across browsers', addedAt: 1564000000000, viewed: false },
  { url: 'https://forum.oldreader.test/t/dark-mode-requests/501', title: 'Dark mode requests thread', addedAt: 1564400000000, viewed: true },
  { url: 'https://shop.oldreader.test/reviews/usb-c-docks', title: 'USB-C docks, one year later', addedAt: 1564800000000, viewed: false },
  { url: 'https://wiki.oldreader.test/wiki/Service_workers', title: 'Service workers', addedAt: 1565200000000, viewed: false },
  { url: 'https://news.oldreader.test/2019/08/14/link-sharing-etiquette', title: 'Link sharing etiquette', addedAt: 1565600000000, viewed: true },
  { url: 'https://blog.oldreader.test/posts/testing-storage-quotas', title: 'Testing storage quotas the hard way', addedAt: 1566000000000, viewed: false },
  { url: 'https://docs.oldreader.test/guide/import-export', title: 'Import and export formats', addedAt: 1566400000000, viewed: false },
];

export const LEGACY_V2_SETTINGS = {
  addContextMenu: true,
  addPageAction: true,
  animateItems: false,
  askedForReview: true,
  openNewTab: false,
  theme: 'light',
  viewAll: true,
  sortOption: 'date',
  sortOrder: 'desc',
};
