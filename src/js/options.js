/* globals chrome */

import '../style/options.styl'

document.addEventListener('DOMContentLoaded', () => {
  // Localize!
  document.querySelectorAll('[data-localize]').forEach(el => {
    el.textContent = chrome.i18n.getMessage(el.dataset.localize)
  })
  // Use default value theme = 'light' and animateItems = false if on firefox true on everything else.
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

  // Icon in address bar only for firefox does not work in chrome
  if (!isFirefox) {
    document.getElementById('addPageAction').parentElement.style.display = 'none'
  }

  // Saves options to chrome.storage
  function saveOptions () {
    const theme = document.getElementById('theme').value
    const animateItems = document.getElementById('animateItems').checked
    const addContextMenu = document.getElementById('addContextMenu').checked
    const addPageAction = document.getElementById('addPageAction').checked
    const openNewTab = document.getElementById('openNewTab').checked

    // Remove all the context menus
    chrome.contextMenus.removeAll(() => {
      // If context menu is clicked, add the context menu
      if (addContextMenu) {
        // Create the context menu from the background page
        // see “background.js”
        chrome.runtime.getBackgroundPage(bgPage => {
          bgPage.createContextMenus()
        })
      }
    })

    // Shows/hides pageAction in all tabs
    chrome.tabs.query({}, tabs => {
      for (let tab of tabs) {
        if (addPageAction) {
          chrome.pageAction.show(tab.id)
        } else {
          chrome.pageAction.hide(tab.id)
        }
      }
    })

    // Get updating the settings on the options page
    chrome.storage.sync.get(defaultSettings, items => {
      const needsReload = isFirefox && items.settings.theme !== theme
      items.settings.theme = theme
      items.settings.animateItems = animateItems
      items.settings.addContextMenu = addContextMenu
      items.settings.addPageAction = addPageAction
      items.settings.openNewTab = openNewTab
      chrome.storage.sync.set({
        settings: items.settings
      }, () => {
        if (needsReload) {
          chrome.runtime.reload()
        }
      })
    })
  }

  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  function restoreOptions () {
    chrome.storage.sync.get(defaultSettings, items => {
      document.getElementById('theme').value = items.settings.theme
      document.getElementById('animateItems').checked = items.settings.animateItems
      document.getElementById('addContextMenu').checked = items.settings.addContextMenu
      document.getElementById('addPageAction').checked = items.settings.addPageAction
      document.getElementById('openNewTab').checked = items.settings.openNewTab
    })
  }

  // Helper for export function
  let textFile = null

  function makeTextFile (text) {
    const data = new Blob([text], {type: 'text/plain'})
    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
      window.URL.revokeObjectURL(textFile)
    }
    textFile = window.URL.createObjectURL(data)
    return textFile
  }

  // Exports app data to a file
  function exportFunc () {
    // Get the storage element
    chrome.storage.sync.get(null, pages => {
      const exportText = JSON.stringify(pages)

      // Add storage element to file
      const link = document.createElement('a')
      link.setAttribute('download', 'readinglist.json')
      link.href = makeTextFile(exportText)
      document.body.appendChild(link)

      // wait for the link to be added to the document
      window.requestAnimationFrame(() => {
        const event = new MouseEvent('click')
        link.dispatchEvent(event)
        document.body.removeChild(link)
      })
    })
  }

  const importOrig = document.getElementById('importOrig')

  // Helper for import function
  function impLoad () {
    const myImportedData = JSON.parse(this.result)
    // Un-comment this line if we want to replace the storage
    // chrome.storage.sync.clear()
    // Here the chrome storage is imported, it aggregates the reading list and replaces setting
    chrome.storage.sync.set(myImportedData, () => {
      restoreOptions()
      if (isFirefox) {
        chrome.runtime.reload()
      }
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError)
      }
    })
    importOrig.value = '' // make sure to clear input value after every import
  }

  // Gets json file and imports to the app
  function importFunc (e) {
    const files = e.target.files
    const reader = new FileReader()
    reader.onload = impLoad
    reader.readAsText(files[0])
  }

  // Deletes all settings, and items in the app
  function confirmDelete () {
    const popup = document.getElementById('popup')
    popup.style.display = 'block'
    popup.style.opacity = 1
    document.body.insertBefore(popup, document.body.firstChild)
    document.getElementById('ok').onclick = function () {
      fade(popup, 10)
      chrome.storage.sync.clear(() => {
        restoreOptions()
        chrome.runtime.sendMessage({
          'type': 'listUpdated'
        })
      })
    }
    document.getElementById('cancel').onclick = function () {
      fade(popup, 10)
    }
  }

  // Fades html element
  function fade (element, time) {
    let op = 1 // initial opacity
    const timer = setInterval(() => {
      if (op <= 0.1) {
        clearInterval(timer)
        element.style.display = 'none'
      }
      element.style.opacity = op
      element.style.filter = 'alpha(opacity=' + op * 100 + ')'
      op -= op * 0.1
    }, time)
  }

  function accordion () {
    this.classList.toggle('active')
    const panel = this.nextElementSibling
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null
    } else {
      panel.style.maxHeight = panel.scrollHeight + 'px'
    }
  }

  restoreOptions()

  const importBtn = document.getElementById('importBtn')
  const exportBtn = document.getElementById('exportBtn')
  const resetBtn = document.getElementById('resetBtn')

  // Import listeners
  importOrig.addEventListener('change', importFunc, false)
  importBtn.onclick = () => {
    importOrig.click()
  }
  // Export listener
  exportBtn.addEventListener('click', exportFunc, false)
  // Reset button listener
  resetBtn.addEventListener('click', confirmDelete, false)
  // Advanced settings listener, opens accordion
  document.getElementById('advanced').addEventListener('click', accordion)
  // Listeners to save options when changed
  document.getElementById('theme').addEventListener('change', saveOptions)
  document.getElementById('animateItems').addEventListener('click', saveOptions)
  document.getElementById('addContextMenu').addEventListener('click', saveOptions)
  document.getElementById('addPageAction').addEventListener('click', saveOptions)
  document.getElementById('openNewTab').addEventListener('click', saveOptions)
})
