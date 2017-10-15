// Saves options to chrome.storage
function saveOptions() {
  var theme = document.getElementById('theme').value;
  var animateItems = document.getElementById('animateItems').checked;
  var addContextMenu = document.getElementById('addContextMenu').checked;
  
  chrome.storage.sync.set({
    settings: {
      theme,
      animateItems,
      addContextMenu
    }
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
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

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);