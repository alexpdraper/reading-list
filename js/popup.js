document.addEventListener('DOMContentLoaded', function() {
  // Localize!
  document.querySelectorAll('[data-localize]').forEach(function(el) {
    el.textContent = chrome.i18n.getMessage(el.dataset.localize);
  });

  var RL = document.getElementById('reading-list');

  RL.addEventListener('animationend', function(e) {
    var slideinRe = /(^|\s+)slidein(\s+|$)/g;
    e.target.parentNode.className = e.target.parentNode.className.replace(slideinRe, '');
  });

  // Wait a bit before rendering the reading list
  // Gives the popup window time to render, preventing weird resizing bugs
  // See: https://bugs.chromium.org/p/chromium/issues/detail?id=457887
  window.setTimeout(renderReadingList, 150, RL, true);

  // Listen for click events in the reading list
  RL.addEventListener('click', onReadingItemClick);

  var searchbox = document.getElementById('my-search')

  if (searchbox) {
    // Filter reading list based on search box
    searchbox.addEventListener('keyup', filterReadingList);
  }

  // The button for adding pages to the reading list
  var savepageButton = document.getElementById('savepage');

  if (savepageButton) {
    // Save the page open in the current tab to the reading list
    savepageButton.addEventListener('click', function() {
      var queryInfo = { active: true, currentWindow: true };

      chrome.tabs.query(queryInfo, function(tabs) {
        addReadingItem(tabs[0], RL);
      });
    });
  }
});
