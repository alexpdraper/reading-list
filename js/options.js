document.addEventListener('DOMContentLoaded', function () {
  // Localize!
  document.querySelectorAll('[data-localize]').forEach(function (el) {
    el.textContent = chrome.i18n.getMessage(el.dataset.localize);
  });

  // Saves options to chrome.storage
  function saveOptions() {
    var theme = document.getElementById('theme').value;
    var animateItems = document.getElementById('animateItems').checked;
    var addContextMenu = document.getElementById('addContextMenu').checked;

    // Remove all the context menus
    chrome.contextMenus.removeAll(function() {
      // If context menu is clicked, add the context menu
      if (addContextMenu) {
        // Create the context menu from the background page
        // see “background.js”
        chrome.runtime.getBackgroundPage(function(bgPage) {
          bgPage.createContextMenu();
        })
      }
    })


    chrome.storage.sync.set({
      settings: {
        theme,
        animateItems,
        addContextMenu
      }
    });
  }

  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  function restoreOptions() {
    // Use default value theme = 'light' and animateItems = true.
    chrome.storage.sync.get({
      settings: {
        theme: 'light',
        animateItems: true,
        addContextMenu: true
      }
    }, function(items) {
      document.getElementById('theme').value = items.settings.theme;
      document.getElementById('animateItems').checked = items.settings.animateItems;
      document.getElementById('addContextMenu').checked = items.settings.addContextMenu;
    });
  }

  restoreOptions();
  document.getElementById('theme').addEventListener('change', saveOptions);
  document.getElementById('animateItems').addEventListener('click', saveOptions);
  document.getElementById('addContextMenu').addEventListener('click', saveOptions);
})
