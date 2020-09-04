/* globals chrome */

import list from './readinglist'

import '../style/popup.styl'

document.addEventListener('DOMContentLoaded', () => {
  // Localize!
  document.querySelectorAll('[data-localize]').forEach(el => {
    el.textContent = chrome.i18n.getMessage(el.dataset.localize)
  })

  const searchBar = document.getElementById('my-search')
  searchBar.setAttribute('placeholder', chrome.i18n.getMessage('Search'))

  const RL = document.getElementById('reading-list')

  RL.addEventListener('animationend', e => {
    if (e.target.parentNode) {
      e.target.parentNode.classList.remove('slidein')
    }
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
    const settings = store.settings
    document.body.classList.add(settings.theme || 'light')

    // Sets the all/unread button
    document.getElementById(settings.viewAll ? 'all' : 'unread').classList.add('active')
    // Sets the list of items which are shown
    if (settings.viewAll) {
      document.getElementById('reading-list').classList.remove('unread-only')
    } else {
      document.getElementById('reading-list').classList.add('unread-only')
    }

    if (settings.animateItems) {
      // Wait a bit before rendering the reading list
      // Gives the popup window time to render, preventing weird resizing bugs
      // See: https://bugs.chromium.org/p/chromium/issues/detail?id=457887
      window.setTimeout(list.renderReadingList, 150, RL, true, settings.viewAll)
    } else {
      list.renderReadingList(RL, false, settings.viewAll)
    }
  })

  // Listen for click events in the reading list
  RL.addEventListener('click', list.onReadingItemClick)

  const searchbox = document.getElementById('my-search')

  if (searchbox) {
    // Filter reading list based on search box
    searchbox.addEventListener('keyup', list.filterReadingList)
  }

  // The button for adding pages to the reading list
  const savepageButton = document.getElementById('savepage')

  if (savepageButton) {
    // Save the page open in the current tab to the reading list
    savepageButton.addEventListener('click', () => {
      const queryInfo = {active: true, currentWindow: true}

      chrome.tabs.query(queryInfo, tabs => {
        list.addReadingItem(tabs[0], RL)
      })
    })
  }

  // Listen for click events in the sidebar button
  // Hide if not Firefox
  const sidebarButton = document.getElementById('open-sidebar')
  if (sidebarButton) {
    if (isFirefox) {
      let sidebarIsOpen = false
      if (window.browser.sidebarAction.hasOwnProperty('isOpen')) {
        window.browser.sidebarAction.isOpen({}).then(result => {
          sidebarIsOpen = result
        })
      }
      document.getElementById('open-sidebar').addEventListener('click', () => {
        if (sidebarIsOpen) {
          chrome.sidebarAction.close()
          sidebarIsOpen = false
        } else {
          chrome.sidebarAction.open()
          sidebarIsOpen = true
        }
      })
    } else {
      sidebarButton.style.display = 'none'
    }
  }

  // Listen for click events in the settings
  document.getElementById('settings').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      // New way to open options pages, if supported (Chrome 42+).
      chrome.runtime.openOptionsPage()
      const isPopup = document.body.classList.contains('popup-page')
      if (isPopup) {
        window.close()
      }
    } else {
      // Reasonable fallback.
      window.open(chrome.runtime.getURL('/options.html'))
    }
  })

  document.getElementById('all').addEventListener('click', list.changeView)
  document.getElementById('unread').addEventListener('click', list.changeView)

  chrome.runtime.onMessage.addListener((request) => {
    var currentItem = document.getElementById(request.url)
    if (request.type === 'add') {
      if (currentItem) {
        list.removeReadingItem(null, currentItem.parentNode)
      }

      // Create the reading item element
      const readingItemEl = list.createReadingItemEl(request.info)

      // Add the animation class
      readingItemEl.className += ' slidein'

      // Add it to the top of the reading list
      RL.insertBefore(readingItemEl, RL.firstChild)
    } else if (request.type === 'remove') {
      if (currentItem) {
        list.removeReadingItem(null, currentItem.parentNode)
      }
    } else if (request.type === 'update') {
      // If updated replace current item with a new one
      RL.insertBefore(list.createReadingItemEl(request.info), currentItem.parentNode)
      currentItem.parentNode.remove()
    }
  })
})
