document.addEventListener('DOMContentLoaded', function() {
  var RL = document.getElementById('reading-list');

  renderReadingList(RL);

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
