// Read live from the running extension's own manifest, so it can never
// drift out of sync with the real version and updates automatically on
// every version bump.
export const BUILD_TAG = chrome?.runtime?.getManifest?.().version ?? 'unknown';
