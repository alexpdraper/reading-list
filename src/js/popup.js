/* globals chrome */

import list from './readinglist'

import '../style/popup.styl'

document.addEventListener('DOMContentLoaded', () => {
  // Localize!
  document.querySelectorAll('[data-localize]').forEach(el => {
    el.textContent = chrome.i18n.getMessage(el.dataset.localize)
  })

  const RL = document.getElementById('reading-list')

  RL.addEventListener('animationend', e => {
    let slideinRe = /(^|\s+)slidein(\s+|$)/g
    e.target.parentNode.className = e.target.parentNode.className.replace(slideinRe, '')
  })

  const defaultSettings = {
    settings: {
      theme: 'light',
      addContextMenu: true,
      animateItems: true
    }
  }

  chrome.storage.sync.get(defaultSettings, store => {
    let settings = store.settings
    document.body.classList.add(settings.theme || 'light')

    if (settings.animateItems) {
      // Wait a bit before rendering the reading list
      // Gives the popup window time to render, preventing weird resizing bugs
      // See: https://bugs.chromium.org/p/chromium/issues/detail?id=457887
      window.setTimeout(list.renderReadingList, 150, RL, true)
    } else {
      list.renderReadingList(RL, false)
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
      const queryInfo = { active: true, currentWindow: true }

      chrome.tabs.query(queryInfo, tabs => {
        list.addReadingItem(tabs[0], RL)
      })
    })
  }

  // Listen for click events in the settings
  document.getElementById('settings').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      // New way to open options pages, if supported (Chrome 42+).
      chrome.runtime.openOptionsPage()
    } else {
      // Reasonable fallback.
      window.open(chrome.runtime.getURL('/options.html'))
    }
  })
})
