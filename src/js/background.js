/* globals chrome */

const googleFaviconURL = 'https://plus.google.com/_/favicon?domain='

chrome.browserAction.setBadgeText({ text: '' })
chrome.browserAction.setBadgeBackgroundColor({
  color: '#2ea99c'
})

const isFirefox = typeof InstallTrigger !== 'undefined'
const defaultSettings = {
  settings: {
    theme: 'light',
    addContextMenu: true,
    animateItems: !isFirefox,
    openNewTab: false,
    viewAll: true
  }
}

chrome.storage.sync.get(defaultSettings, store => {
  if (store.settings.addContextMenu) {
    createContextMenus()
  }
})

window.createContextMenus = createContextMenus

/**
 * Creates context menus for both link and when clicking on page.
 */
function createContextMenus () {
  createPageContextMenu()
  createLinkContextMenu()
}

/**
 * Add option to add current tab to reading list
 */
function createPageContextMenu () {
  chrome.management.getSelf(result => {
    var menuTitle = chrome.i18n.getMessage('addPage')
    menuTitle += (result.installType === 'development') ? ' (dev)' : ''
    chrome.contextMenus.create({
      title: menuTitle,
      onclick: addPageToList
    })
  })
}

/**
 * Add option to add link to reading list
 */
function createLinkContextMenu () {
  chrome.management.getSelf(result => {
    var menuTitle = chrome.i18n.getMessage('addPage')
    menuTitle += (result.installType === 'development') ? ' (dev)' : ''

    chrome.contextMenus.create({
      title: menuTitle,
      contexts: ['link'],
      onclick: addLinkToList
    })
  })
}

/**
 * Add a tab to the reading list (context menu item onclick function)
 *
 * @param {object} info
 * @param {object} tab
 */
function addLinkToList (info, tab) {
  const setObj = {}

  var parser = document.createElement('a')
  parser.href = info.linkUrl
  // Removes google's strange url when it is clicked on
  if (parser.hostname.toLowerCase().indexOf('google') !== -1 && parser.pathname === '/url') {
    info.linkUrl = (getQueryVariable(parser, 'url'))
  }

  setObj[info.linkUrl] = {
    url: info.linkUrl,
    title: info.selectionText,
    favIconUrl: `${googleFaviconURL}${info.linkUrl}`,
    addedAt: Date.now()
  }

  chrome.storage.sync.set(setObj)
}

/**
 * Gets a variable value from the query string of a url
 * @param {string} url The url to parse
 * @param {string} variable The variable desired from the query string
 */
function getQueryVariable (url, variable) {
  var query = url.search.substring(1)
  var vars = query.split('&')
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=')
    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1])
    }
  }
  return url
}

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

      // If the page is on the reading list, and doesn’t have a favIconUrl
      // or favIconUrl is using google's favicon look up service…
      // …add the favIconUrl
      if (readingItem &&
        (!readingItem.hasOwnProperty('favIconUrl') ||
          (readingItem.favIconUrl.indexOf(googleFaviconURL) !== -1)) &&
        tab.favIconUrl) {
        setObj[tab.url] = readingItem
        setObj[tab.url].favIconUrl = tab.favIconUrl
        chrome.storage.sync.set(setObj)
      }
    })
  }
})
