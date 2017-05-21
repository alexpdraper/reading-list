chrome.browserAction.setBadgeBackgroundColor({
  color: '#2ea99c'
});

var menuItem = chrome.contextMenus.create({
  title: 'Add page to Reading List',
  onclick: addPageToList
});

/**
 * Add the page to the reading list (context menu item onclick function)
 *
 * @param {object} info
 * @param {object} tab
 */
function addPageToList(info, tab) {
  var setObj = {};

  setObj[tab.url] = {
    url: tab.url,
    title: tab.title,
    addedAt: Date.now()
  };

  chrome.storage.sync.set(setObj, function() {
    // chrome.contextMenus.update(menuItem, {
    //   title: 'Remove page from Reading List',
    //   onclick: removePageFromList
    // });

    updateBadge(tab.url, tab.id);
  });
}

/**
 * Removes the page from the reading list (context menu item onclick function)
 *   Might be used in a future update
 * @param {object} info
 * @param {object} tab
 */
function removePageFromList(info, tab) {
  chrome.storage.sync.remove(tab.url, function() {
    chrome.contextMenus.update(menuItem, {
      title: 'Add page to Reading List',
      onclick: addPageToList
    });
  });
}

/**
 * Set the tab’s badge text to “✔” if it is on the reading list, otherwise remove it.
 *
 * @param {string} url - the tab’s URL
 * @param {number} tabId - the ID of the tab to update
 * @param {function(boolean)} callback - called when the badge text is updated
 */
function updateBadge(url, tabId, callback) {
  // Check the reading list for the url
  chrome.storage.sync.get(url, function(item) {
    var onList = (item && item.hasOwnProperty(url));

    // If the page is on the reading list, add a “✔” to the badge,
    // otherwise, no badge
    chrome.browserAction.setBadgeText({
      text: onList ? '✔' : '',
      tabId: tabId
    });

    if (typeof callback === 'function') {
      callback(onList);
    }
  });
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // If the tab’s url has changed, update the badge text
  if (changeInfo.url) {
    updateBadge(changeInfo.url, tabId);
  }
});
