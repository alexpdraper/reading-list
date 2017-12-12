/* globals chrome */

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
      animateItems: !isFirefox,
      viewAll: true
    }
  }

  // Saves options to chrome.storage
  function saveOptions () {
    var theme = document.getElementById('theme').value
    var animateItems = document.getElementById('animateItems').checked
    var addContextMenu = document.getElementById('addContextMenu').checked

    // Remove all the context menus
    chrome.contextMenus.removeAll(() => {
      // If context menu is clicked, add the context menu
      if (addContextMenu) {
        // Create the context menu from the background page
        // see “background.js”
        chrome.runtime.getBackgroundPage(bgPage => {
          bgPage.createContextMenu()
        })
      }
    })
    // Get updating the settings on the options page
    chrome.storage.sync.get(defaultSettings, items => {
      items.settings.theme = theme
      items.settings.animateItems = animateItems
      items.settings.addContextMenu = addContextMenu
      chrome.storage.sync.set({
        settings: items.settings
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
    })
  }

  // Helper for export function
  var textFile = null
  function makeTextFile (text) {
    var data = new Blob([text], { type: 'text/plain' })
    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
      window.URL.revokeObjectURL(textFile)
    }
    textFile = window.URL.createObjectURL(data)
    return textFile
  };

  // Exports app data to a file
  function exportFunc () {
    // Get the storage element
    chrome.storage.sync.get(null, pages => {
      let exportText = JSON.stringify(pages)

      // Add storage element to file
      let link = document.createElement('a')
      link.setAttribute('download', 'readinglist.json')
      link.href = makeTextFile(exportText)
      document.body.appendChild(link)

      // wait for the link to be added to the document
      window.requestAnimationFrame(() => {
        var event = new MouseEvent('click')
        link.dispatchEvent(event)
        document.body.removeChild(link)
      })
    })
  }

  const importOrig = document.getElementById('importOrig')

  // Helper for import function
  function impLoad () {
    let myImportedData = JSON.parse(this.result)
    // Un-comment this line if we want to replace the storage
    // chrome.storage.sync.clear();
    // Here the chrome storage is imported, it aggregates the reading list and replaces setting
    chrome.storage.sync.set(myImportedData, () => {
      restoreOptions()
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError)
      }
    })
    importOrig.value = '' // make sure to clear input value after every import
  }

  // Gets json file and imports to the app
  function importFunc (e) {
    let files = e.target.files
    let reader = new FileReader()
    reader.onload = impLoad
    reader.readAsText(files[0])
  }

  restoreOptions()

  const importBtn = document.getElementById('importBtn')
  const exportBtn = document.getElementById('exportBtn')

  // Import listeners
  importOrig.addEventListener('change', importFunc, false)
  importBtn.onclick = () => { importOrig.click() }
  // Export listener
  exportBtn.addEventListener('click', exportFunc, false)
  document.getElementById('theme').addEventListener('change', saveOptions)
  document.getElementById('animateItems').addEventListener('click', saveOptions)
  document.getElementById('addContextMenu').addEventListener('click', saveOptions)
})
