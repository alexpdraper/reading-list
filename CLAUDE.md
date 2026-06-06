# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Chrome and Firefox browser extension for saving pages to read later. It uses Manifest V3, TypeScript, and Lit for web components. The extension is published on the Chrome Web Store and Firefox Add-ons.

## Architecture

The extension consists of three main parts:

1. **Background Service Worker** (`src/background.ts`): Handles context menu operations, storage management, and sync with user accounts (Google/Mozilla)
2. **Popup UI** (`src/components/reading-list-app.ts`): The main popup window shown when clicking the extension icon
3. **Options Page** (`src/components/reading-list-options.ts`): Settings page for user preferences
4. **Item Component** (`src/components/reading-list-item.ts`): Reusable component for displaying individual reading list items

The utility library (`src/lib/rl.ts`) handles core reading list operations like adding, removing, searching, and syncing items.

All UI components use the Lit library with TypeScript decorators.

## Build and Development

### Commands

```bash
npm install      # Install dependencies
npm run build    # Compile TypeScript and bundle with Rollup (output: build/)
npm run format   # Format code with Prettier
```

### Build Process

1. TypeScript compiler processes `src/**/*.ts` and outputs to `extension/scripts/`
2. Rollup bundles the compiled JavaScript using:
   - `rollup-plugin-html` for HTML entry points (popup.html, options.html)
   - `@rollup/plugin-node-resolve` for module resolution
   - `@rollup/plugin-terser` for minification
   - `rollup-plugin-minify-html-literals` for HTML template optimization
3. Final output goes to `build/` folder with icons, locales, and manifest

### Loading into Browser

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable "Developer Mode"
3. Click "Load unpacked"
4. Select the `build` folder

**Firefox:** Load the `build` folder as a temporary extension or package with `web-ext`

## Key Implementation Details

- **Manifest V3**: Uses service workers instead of background pages; no persistent background context
- **Storage**: Uses Chrome/Firefox storage API for persistence with sync capability
- **Context Menu**: Added via `chrome.contextMenus` API for "Add page to Reading List"
- **Web Components**: Lit components use TypeScript decorators and reactive properties
- **i18n**: Localization handled via `_locales/` folder and `src/lib/i18n.ts`

## Current Feature Status

See README.md for feature checklist. "Open in new tab option" is marked as a pending feature.

## TypeScript Configuration

- Target: ES2021
- Strict mode enabled
- Output: `extension/scripts/`
- Uses `ts-lit-plugin` for Lit template type checking
