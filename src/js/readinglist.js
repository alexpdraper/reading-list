/* globals chrome */
import Fuse from 'fuse.js'

/**
 * Create and return the DOM element for a reading list item.
 *
 * <div class="reading-item">
 *   <a class="item-link" href="…">
 *     <span class="title">…</span>
 *     <span class="host">…</span>
 *     <div class="favicon">
 *       <img class="favicon-img" src="…">
 *     </div>
 *   </a>
 *   <a class="delete-button" id="…">×</a>
 * </div>
 *
 * @param {object} info - object with url, title, and favIconUrl
 */
function createReadingItemEl (info) {
  var url = info.url
  var title = info.title
  var favIconUrl = info.favIconUrl

  var item = document.createElement('div')
  item.className = 'reading-item'

  if (info.viewed) {
    item.classList.add('read')
  } else {
    item.classList.add('unread')
  }

  var link = document.createElement('a')
  link.className = 'item-link'
  link.href = url

  var linkTitle = document.createElement('span')
  linkTitle.className = 'title'
  linkTitle.textContent = title || '?'
  link.appendChild(linkTitle)

  var linkHost = document.createElement('span')
  linkHost.classList.add('host')
  linkHost.textContent = link.hostname || url
  link.appendChild(linkHost)

  if (favIconUrl && /^https?:\/\//.test(favIconUrl)) {
    var favicon = document.createElement('div')
    favicon.classList.add('favicon')
    var faviconImg = document.createElement('img')
    faviconImg.classList.add('favicon-img')
    faviconImg.onerror = () => faviconImg.classList.add('error')
    faviconImg.setAttribute('src', favIconUrl)
    favicon.appendChild(faviconImg)
    link.appendChild(favicon)
  }

  var delBtn = document.createElement('a')
  delBtn.textContent = '×'
  delBtn.id = url
  delBtn.classList.add('delete-button')
  item.appendChild(link)
  item.appendChild(delBtn)

  return item
}

/**
 * Get the reading list from storage
 *
 * @param {function(array)} callback - called with an array of reading
 *   list items
 */
function getReadingList (callback) {
  if (typeof callback !== 'function') {
    return
  }

  chrome.storage.sync.get(null, pages => {
    var pageList = []

    for (let page in pages) {
      if (pages.hasOwnProperty(page) && !/^setting/.test(page)) {
        pageList.push(pages[page])
      }
    }

    callback(pageList)
  })
}

/**
 * Render the reading list
 *
 * @param {elementNodeReference} readingListEl - reading list DOM element
 * @param {boolean} animateItems - animate incoming reading items?
 * @param {function()} callback - called when the list is rendered
 */
function renderReadingList (readingListEl, animateItems, viewAll, callback) {
  getReadingList(pageList => {
    // Sort reading list by most recent to least recent
    pageList.sort((a, b) => {
      return b.addedAt - a.addedAt
    })

    var counter = 0
    var numItems = pageList.length
    let itemsAnimated = 0

    // Animate up to 10 items
    var itemsToAnimate = animateItems ? 10 : 0
    itemsToAnimate = (itemsToAnimate > numItems) ? numItems : itemsToAnimate

    // Wait a bit, then create a DOM element for the next reading list item,
    // then recurse
    function waitAndCreate (waitTime) {
      // Stop if all items have been rendered.
      if (counter >= numItems) {
        return
      }

      // If we’ve rendered all the animated items
      if (itemsAnimated >= itemsToAnimate) {
        // Render any remaining items
        for (var i = counter; i < numItems; i++) {
          readingListEl.appendChild(createReadingItemEl(pageList[i]))
        }

        if (typeof callback === 'function') {
          callback()
        }

        return
      }

      // Wait a bit, then make a reading item
      window.setTimeout(() => {
        var readingItemEl = createReadingItemEl(pageList[counter])

        // Increment the animated counter if item is viewable
        if (!pageList[counter].viewed || viewAll) {
          // Add the “slidein” class for animation
          readingItemEl.classList.add('slidein')
          itemsAnimated++
        }
        readingListEl.appendChild(readingItemEl)

        // Increment the counter
        counter++
        waitTime = parseInt(waitTime * ((itemsToAnimate - counter) / itemsToAnimate), 10)

        // Recurse!
        waitAndCreate(waitTime)
      }, waitTime)
    }

    waitAndCreate(150)
  })
}

/**
 * Add an item to the reading list
 *
 * @param {object} info - page to add’s url, title, and favIconUrl
 * @param {elementNodeReference} readingListEl - reading list DOM element
 * @param {function(object)} callback - called when the item is added
 */
function addReadingItem (info, readingListEl, callback) {
  if (!info.url) {
    return
  }

  // Restrict info’s values
  info = {
    url: info.url,
    title: info.title,
    favIconUrl: info.favIconUrl,
    addedAt: Date.now(),
    viewed: false
  }

  // Object for setting the storage
  var setObj = {}
  setObj[info.url] = info

  chrome.storage.sync.set(setObj, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError)
    }

    // If the readingListEl was passed, create the DOM element for the
    // reading item
    if (readingListEl) {
      // Look for a delete button with the ID of the url
      var currentItem = document.getElementById(info.url)

      // If it exists, remove it from the list (prevents duplicates)
      if (currentItem) {
        removeReadingItem(null, currentItem.parentNode)
      }

      // Create the reading item element
      var readingItemEl = createReadingItemEl(info)

      // Add the animation class
      readingItemEl.className += ' slidein'

      // Add it to the top of the reading list
      readingListEl.insertBefore(readingItemEl, readingListEl.firstChild)
    }

    // Add the “✔” to the badge for matching tabs
    var queryInfo = { url: info.url.replace(/#.*/, '') }

    chrome.tabs.query(queryInfo, tabs => {
      for (var i = 0; i < tabs.length; i++) {
        // If the URL is identical, add the “✔” to the badge
        if (tabs[i].url === info.url && tabs[i].id) {
          chrome.browserAction.setBadgeText({
            text: '✔',
            tabId: tabs[i].id
          })
        }
      }

      if (typeof callback === 'function') {
        callback(info, readingItemEl)
      }
    })
  })
}

/**
 * Remove a reading list item from the DOM, storage, or both
 *
 * @param {string} url (optional) - URL of the page to remove
 * @param {elementNodeReference} element - (optional) reading list item
 */
function removeReadingItem (url, element) {
  // If url is truthy, remove the item from storage
  if (url) {
    chrome.storage.sync.remove(url, () => {
      // Find tabs with the reading item’s url
      var queryInfo = { url: url.replace(/#.*/, '') }

      chrome.tabs.query(queryInfo, tabs => {
        for (var i = 0; i < tabs.length; i++) {
          // If the URL is identical, remove the “✔” from the badge
          if (tabs[i].url === url) {
            chrome.browserAction.setBadgeText({
              text: '',
              tabId: tabs[i].id
            })
          }
        }
      })
    })
  }

  // If element is truthy, remove the element
  if (element) {
    // Listen for the end of an animation
    element.addEventListener('animationend', () => {
      // Remove the item from the DOM when the animation is finished
      element.remove()
    })

    // Add the class to start the animation
    element.className += ' slideout'
  }
}

/**
 * Open the reading item
 *
 * @param {string} url - URL to open
 * @param {boolean} newTab - open in a new tab?
 */
function openLink (url, newTab) {
  if (newTab) {
    // Create a new tab with the URL
    chrome.tabs.create({ url: url, active: false })
  } else {
    // Query for the active tab
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, tabs => {
      var tab = tabs[0]

      // Update the URL of the current tab
      chrome.tabs.update(tab.id, { url: url })

      // Close the popup
      window.close()
    })
  }
}

/**
 * Open or delete reading items (click event listener)
 *
 * @param {Event} e - click event
 */
function onReadingItemClick (e) {
  var isPopup = /(\s|^)popup-page(\s|$)/.test(document.body.className)
  var target = e.target

  // If the target’s parent is an <a> we pretend the <a> is the target
  if (target.parentNode.tagName === 'A') {
    target = target.parentNode
  }

  // If the target is a delete button, remove the reading item
  if (/(\s|^)delete-button(\s|$)/.test(target.className)) {
    removeReadingItem(target.id, target.parentNode)
  } else if (isPopup && /(\s|^)item-link(\s|$)/.test(target.className)) {
    e.preventDefault()
    chrome.storage.sync.get(defaultSettings, items => {
      // If the control or meta key (⌘ on Mac, ⊞ on Windows) is pressed or if options is selected…
      const modifierDown = (e.ctrlKey || e.metaKey || items.settings.openNewTab)
      openLink(target.href, modifierDown)
    })
  }
}

/**
 * Filter the reading list DOM elements by search param
 *
 * @param {Event} e - keyup event
 */
function filterReadingList (e) {
  const options = {
    keys: ['title', 'url'],
    tokenize: true,
    threshold: 0.4
  }
  let displayAll = false
  // If nothing is being searched in list return.
  if (this.value.trim().length === 0) {
    displayAll = true
  }

  getReadingList(pageList => {
    const readingList = document.getElementsByClassName('reading-item')
    // Sort reading list by most recent to least recent
    const fuse = new Fuse(pageList, options)
    const filtered = fuse.search(this.value)

    // Loop through reading list items to see if they match search text
    for (let i = 0; i < readingList.length; i++) {
      let display = false
      for (let j = 0; j < filtered.length; j++) {
        let url = readingList[i].querySelector('.item-link').getAttribute('href')
        if (url === filtered[j].url) {
          display = true
        }
      }
      readingList[i].style.display = display || displayAll ? '' : 'none'
    }
  })
}

/**
 * Toggles the buttons, and updates the options for which reading list to view.
 */
function changeView () {
  this.classList.add('active')
  const viewAll = this.id === 'all'
  // Updates the view setting in setting menu
  updateOptions(viewAll)
  // Update the button on display
  if (viewAll) {
    document.getElementById('unread').classList.remove('active')
    document.getElementById('reading-list').classList.remove('unread-only')
  } else {
    document.getElementById('all').classList.remove('active')
    document.getElementById('reading-list').classList.add('unread-only')
  }
}

const isFirefox = typeof InstallTrigger !== 'undefined'
const defaultSettings = {
  settings: {
    theme: 'light',
    addContextMenu: true,
    animateItems: !isFirefox,
    openNewTab: false,
    viewAll: true
  }
}

/**
 *  Saves viewAll option to chrome.storage
 * @param {boolean} viewAll The boolean value to set if all items have been viewed
 */
function updateOptions (viewAll) {
  chrome.storage.sync.get(defaultSettings, items => {
    items.settings.viewAll = viewAll
    chrome.storage.sync.set({
      settings: items.settings
    })
  })
}

export default {
  createReadingItemEl,
  getReadingList,
  renderReadingList,
  addReadingItem,
  removeReadingItem,
  openLink,
  onReadingItemClick,
  filterReadingList,
  changeView
}
