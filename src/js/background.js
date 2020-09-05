/* globals chrome */

chrome.browserAction.setBadgeText({text: ''})
chrome.browserAction.setBadgeBackgroundColor({
  color: '#2ea99c'
})

const isFirefox = typeof InstallTrigger !== 'undefined'
const defaultSettings = {
  settings: {
    theme: 'light',
    addContextMenu: true,
    addPageAction: true,
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
    let menuTitle = chrome.i18n.getMessage('addPage')
    menuTitle += (result.installType === 'development') ? ' (dev)' : ''
    chrome.contextMenus.create({
      title: menuTitle,
      contexts: ['page'],
      onclick: addPageToList
    })
  })
}

/**
 * Add option to add link to reading list
 */
function createLinkContextMenu () {
  chrome.management.getSelf(result => {
    let menuTitle = chrome.i18n.getMessage('addLink')
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

  const parser = document.createElement('a')
  parser.href = info.linkUrl
  // Removes google's strange url when it is clicked on
  if (parser.hostname.toLowerCase().indexOf('google') !== -1 && parser.pathname === '/url') {
    info.linkUrl = (getQueryVariable(parser, 'url'))
  }
  // Firefox uses linkText, Chrome uses selectionText
  let title
  if (isFirefox) {
    title = info.linkText
  } else {
    title = info.selectionText
  }

  setObj[info.linkUrl] = {
    url: info.linkUrl,
    title,
    index: 0,
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
  const query = url.search.substring(1)
  const vars = query.split('&')
  for (let var1 of vars) {
    const pair = var1.split('=')
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
    index: 0,
    addedAt: Date.now()
  }

  chrome.storage.sync.set(setObj, () => updateBadge(tab.url, tab.id))
  chrome.runtime.sendMessage({
    'type': 'add',
    'url': tab.url,
    'info': setObj[tab.url]
  })
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
    chrome.browserAction.setBadgeText({text: ''})
    return
  } else if (!url) {
    return
  }

  // Check the reading list for the url
  chrome.storage.sync.get(url, item => {
    const onList = (item && item.hasOwnProperty(url))

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

/**
 * Sets the item in the reading list to viewed.
 *
 * @param {string} url the url of the reading item to set to true.
 */
function setReadingItemViewed (url) {
  chrome.storage.sync.get(url, page => {
    if (page[url]) {
      page[url].viewed = true
      chrome.storage.sync.set(page)
    }
  })
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isFirefox) {
    chrome.storage.sync.get(defaultSettings, store => {
      if (store.settings.addPageAction) {
        chrome.pageAction.show(tabId)
      } else {
        chrome.pageAction.hide(tabId)
      }
    })
  }

  // If the tab is loaded, update the badge text
  if (tabId && changeInfo.status === 'complete' && tab.url) {
    updateBadge(tab.url, tabId, () => {
      if (tab.active) {
        setReadingItemViewed(tab.url)
      }
    })
  }
})

chrome.tabs.onActivated.addListener(() => {
  chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
    if (tabs[0].url) {
      setReadingItemViewed(tabs[0].url)
    }
  })
})

if (isFirefox) {
  chrome.pageAction.onClicked.addListener(() => {
    chrome.tabs.query({currentWindow: true, active: true}, (tabs) => {
      const tab = tabs[0]
      if (tab.url) {
        chrome.storage.sync.get(tab.url, item => {
          const onList = (item && item.hasOwnProperty(tab.url))
          if (onList) {
            chrome.storage.sync.remove(tab.url, () => updateBadge(tab.url, tab.id))
            chrome.runtime.sendMessage({
              'type': 'remove',
              'url': tab.url
            })
          } else {
            addPageToList(null, tab)
          }
        })
      }
    })
  })
}
