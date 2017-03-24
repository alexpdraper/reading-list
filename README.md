# Reading List
A Chrome extension for saving pages to read later. Free on the [Chrome Web Store](https://chrome.google.com/webstore/detail/lloccabjgblebdmncjndmiibianflabo).

![Chrome Reading List extension](screenshot.png)

## Putting it to Use

### Installation

Get it from the [Chrome Web Store](https://chrome.google.com/webstore/detail/lloccabjgblebdmncjndmiibianflabo) for free.

Or, if you would rather do it the hard way:

  1. Download this repo
  2. Go to [chrome://extensions/](chrome://extensions/)
  3. Check “Developer Mode”
  4. Click “Load unpacked extension…”
  5. Load it up

### Actually Using the Extension

  1. Go to a page you want to save for later
  2. Click the reading list icon on the top right of your browser ![Chrome Reading List icon](icon32.png)
  3. Click the `+` button
  4. When you want to read a page you saved, open up the extension and click the reading item you want to read
    - `Control + click` or `command ⌘/windows key ⊞ + click` to open the page in a new tab
  5. Done with a page? Click the `×` next to said page in your reading list, and it will magically vanish.

## Todo

  - Refactor way pages are stored—store the reading list array, instead of each page as its own storage object
  - Save favicons and display them in the reading list
  - Add a check to see if the user’s browser allows CSS animations, and provide backups if it does not
  - Add a directory structure to organize reading list items (maybe)
