/* globals chrome */

chrome.browserAction.setBadgeText({ text: '' })
chrome.browserAction.setBadgeBackgroundColor({
  color: '#2ea99c'
})

var defaultSettings = {
  settings: {
    theme: 'light',
    addContextMenu: true,
    animateItems: true
  }
}

chrome.storage.sync.get(defaultSettings, store => {
  if (store.settings.addContextMenu) {
    createContextMenu()
  }
})

function createContextMenu () {
  chrome.management.getSelf(result => {
    var menuTitle = chrome.i18n.getMessage('addPage')
    menuTitle += (result.installType === 'development') ? ' (dev)' : ''

    chrome.contextMenus.create({
      title: menuTitle,
      onclick: addPageToList
    })
  })
}

window.createContextMenu = createContextMenu

/**
 * Add the page to the reading list (context menu item onclick function)
 *
 * @param {object} info
 * @param {object} tab
 */
function addPageToList (info, tab) {
  const setObj = {}

  setObj[tab.url] = {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    addedAt: Date.now()
  }

  chrome.storage.sync.set(setObj, () => updateBadge(tab.url, tab.id))
}

/**
 * Set the tab’s badge text to “✔” if it is on the reading list, otherwise remove it.
 *
 * @param {string} url - the tab’s URL
 * @param {number} tabId - the ID of the tab to update
 * @param {function(boolean)} callback - called when the badge text is updated
 */
function updateBadge (url, tabId, callback) {
  if (!tabId) {
    chrome.browserAction.setBadgeText({ text: '' })
    return
  } else if (!url) {
    return
  }

  // Check the reading list for the url
  chrome.storage.sync.get(url, item => {
    var onList = (item && item.hasOwnProperty(url))

    // If the page is on the reading list, add a “✔” to the badge,
    // otherwise, no badge
    chrome.browserAction.setBadgeText({
      text: onList ? '✔' : '',
      tabId: tabId
    })

    if (typeof callback === 'function') {
      callback(onList, item)
    }
  })
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If the tab is loaded, update the badge text
  if (tabId && changeInfo.status === 'complete' && tab.url) {
    updateBadge(tab.url, tabId, (onList, item) => {
      var readingItem = onList ? item[tab.url] : null
      var setObj = {}

      // If the page is on the reading list, and doesn’t have a favIconUrl…
      // …add the favIconUrl
      if (readingItem && !readingItem.hasOwnProperty('favIconUrl') && tab.favIconUrl) {
        setObj[tab.url] = readingItem
        setObj[tab.url].favIconUrl = tab.favIconUrl

        chrome.storage.sync.set(setObj)
      }
    })
  }
})
