/**
 * Get the current URL and title.
 *
 * @param {function(string, string)} callback - called when the URL and title of the current tab
 *   is found.
 */
function getCurrentTabInfo(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
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
    console.assert(typeof url == 'string', 'tab.url should be a string');
    console.assert(typeof title == 'string', 'tab.title should be a string');

    callback(url, title);
  });
}

/**
 * Create and return the DOM element for a reading list item.
 *
 * @param {string} url - the URL of the page
 * @param {string} title - the URL of the page
 * @param {string} itemClass (optional) - a class to add to the element, used to animate
 *   incoming reading items
 */
function addReadingItem(url, title, itemClass) {
  var item = document.createElement('div');
  item.className = 'reading-item';

  if (itemClass) {
    item.className += ' ' + itemClass;
  }

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
  delBtn.innerHTML = '&times;';
  delBtn.id = url;
  item.appendChild(link);
  item.appendChild(delBtn);

  return item;
}

/**
 * Remove a reading list item from the DOM and optionally from storage.
 *
 * @param {elementNodeReference} element - the reading list item DOM element
 * @param {string} id (optional) - the ID of the page in storage
 */
function removeReadingItem(element, id) {
  // Listen for the end of an animation
  element.addEventListener('animationend', function() {
    // Remove the item from the DOM when the animation is finished
    element.remove();
  });

  // Add the class to start the animation
  element.className += ' slideout';
}

/**
 * Update the storage to the new storage style
 *
 * @param {object} items - all the items from storage
 * @param {function(array)} callback - callback that passes in the reading list array
 */
function updateStorage(items, callback) {
  var pageList = [];
  var keysToRemove = [];

  for (item in items) {
    if (items.hasOwnProperty(item) && typeof items[item].url !== 'undefined') {
      pageList.push(items[item]);
      keysToRemove.push(item);
    }
  }

  // Sort reading list by most to least recent
  pageList.sort(function(a, b) {
    return b.addedAt - a.addedAt;
  });

  chrome.storage.sync.set({ readingList: pageList }, function() {
    chrome.storage.sync.remove(keysToRemove, function() {
      callback(pageList);
    });
  });
}

/**
 * Get the reading list from storage
 *
 * @param {function(array)} callback - callback that passes in the reading list array
 */
function getReadingList(callback) {
  // Get everything from storage
  chrome.storage.sync.get(null, function(items) {
    console.log('Items in storage:', items);

    if (items.hasOwnProperty('readingList')) {
      callback(items.readingList);
    } else {
      updateStorage(items, callback);
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var RL = document.getElementById('reading-list');
  var pageList = [];

  getReadingList(function(readingListItems) {
    pageList = readingListItems;

    for (var i = 0; i < pageList.length; i++) {
      RL.appendChild(addReadingItem(pageList[i].url, pageList[i].title));
    }
  });

  // Listen for click events in the reading list
  RL.addEventListener('click', function(e) {
    var target = e.target;

    // If the target's parent is an <a> we pretend the <a> is the target
    if (target.parentNode.tagName === 'A') {
      target = target.parentNode;
    }

    // Default <a> behaviour is to load the page in the popup
    if (target.tagName === 'A') {
      e.preventDefault();

      // If the control key or meta key (⌘ on Mac, ⊞ on Windows) is pressed
      if (e.ctrlKey || e.metaKey) {
        // Open in new tab
        chrome.tabs.create({url: target.href});
      } else {
        // Otherwise open in the current tab
        chrome.tabs.getSelected(null, function(tab) {
          chrome.tabs.update(tab.id, {url: target.href});
          window.close();
        });
      }
    }
    // If the target is a button, it is a delete button
    // Remove the item from the reading list
    else if (target.tagName === 'BUTTON') {
      for (var i = 0; i < pageList.length; i++) {
        if (pageList[i].url === target.id) {
          pageList.splice(i, 1);
        }
      }

      chrome.storage.sync.set({ readingList: pageList }, function() {});

      // Remove the reading list item from storage
      removeReadingItem(e.target.parentNode);
    }
  });

  // Save the page open in the current tab to the reading list
  document.getElementById('savepage').addEventListener('click', function() {
    // TODO: Grab the favicon url as well
    getCurrentTabInfo(function (url, title) {
      // Look for a delete button with the ID of the url
      var currentItem = document.getElementById(url);

      // If it exists, remove it from the list
      // Prevents duplicates
      if (currentItem) {
        for (var i = 0; i < pageList.length; i++) {
          if (pageList[i].url === url) {
            pageList.splice(i, 1);
          }
        }
      }

      // Prepend the item to the list
      pageList.unshift({
        url: url,
        title: title,
        addedAt: Date.now()
      });

      // Update storage
      chrome.storage.sync.set({ readingList: pageList }, function() {
        // Remove the current item from the DOM if it exists
        if (currentItem) {
          removeReadingItem(currentItem.parentNode);
        }

        RL.insertBefore(addReadingItem(url, title, 'slidein'), RL.firstChild);
      });
    });
  });
});
