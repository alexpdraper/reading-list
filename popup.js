/**
 * Get the current URL and title.
 *
 * @param {function(string)} callback - called when the URL and title of the current tab
 *   is found.
 */
function getCurrentTabInfo(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function (tabs) {
    // chrome.tabs.query invokes the callback with a list of tabs that match the
    // query. When the popup is opened, there is certainly a window and at least
    // one tab, so we can safely assume that |tabs| is a non-empty array.
    // A window can only have one active tab at a time, so the array consists of
    // exactly one tab.
    var tab = tabs[0];

    // A tab is a plain object that provides information about the tab.
    // See https://developer.chrome.com/extensions/tabs#type-Tab
    var url = tab.url;

    var title = tab.title;

    // tab.url is only available if the "activeTab" permission is declared.
    // If you want to see the URL of other tabs (e.g. after removing active:true
    // from |queryInfo|), then the "tabs" permission is required to see their
    // "url" properties.
    console.assert(typeof url == 'string', 'tab.url should be a string');
    console.assert(typeof title == 'string', 'tab.title should be a string');

    callback(url, title);
  });
}

function addReadingItem(url, title) {
  var item = document.createElement('div');
  item.className = 'reading-item';
  var link = document.createElement('a');
  link.href = url;
  link.setAttribute('alt', title);
  var linkTitle = document.createElement('span');
  linkTitle.className = 'title';
  linkTitle.textContent = title;
  link.appendChild(linkTitle);
  var linkHost = document.createElement('span');
  linkHost.textContent = link.hostname;
  link.appendChild(linkHost);
  var delBtn = document.createElement('button');
  delBtn.textContent = 'X';
  delBtn.id = url;
  item.appendChild(link);
  item.appendChild(delBtn);
  return item;
}

document.addEventListener('DOMContentLoaded', function() {
  var RL = document.getElementById('reading-list');

  // Get the reading list from storage
  chrome.storage.sync.get(null, function (pages) {
    // Array of page objects with url, title, and addedAt
    var pageList = [];
    for (page in pages) {
      if (pages.hasOwnProperty(page)) {
        pageList.push(pages[page]);
      }
    }

    // Sort reading list by most to least recent
    pageList.sort(function (a, b) {
      return b.addedAt - a.addedAt;
    });

    // Add each page to the reading list
    pageList.forEach(function (page) {
      var readingItem = addReadingItem(page.url, page.title);
      RL.appendChild(readingItem);
    });
  });

  // Listen for click events in the reading list
  RL.addEventListener('click', function (e) {
    var target = e.target;

    // If the target's parent is an <a> we pretend the <a> is the target
    if (target.parentNode.tagName === 'A') {
      target = target.parentNode;
    }

    // Default <a> behaviour is to load the page in the popup
    // We prevent the default and load in the current tab instead
    if (target.tagName === 'A') {
      e.preventDefault();
      chrome.tabs.getSelected(null, function(tab) {
        chrome.tabs.update(tab.id, {url: target.href});
        window.close();
      });
    }
    // If the target is a button, it is a delete button
    // Remove the item from the reading list
    else if (target.tagName === 'BUTTON') {
      this.removeChild(e.target.parentNode);
      chrome.storage.sync.remove(target.id);
    }
  });

  // Save the page open in the current tab to the reading list
  document.getElementById('savepage').addEventListener('click', function() {
    getCurrentTabInfo(function (url, title) {
      var setObj = {};
      setObj[url] = {
        url: url,
        title: title,
        addedAt: Date.now()
      };
      chrome.storage.sync.set(setObj, function () {
        RL.insertBefore(addReadingItem(url, title), RL.firstChild);
      });
    });
  });
});
