/* globals chrome */

/**
 * Create and return the DOM element for a reading list item.
 *
 * @param {object} info - object with url, title, and favIconUrl
 */
function createReadingItemEl (info) {
  var url = info.url
  var title = info.title
  var favIconUrl = info.favIconUrl

  var item = document.createElement('div')
  item.className = 'reading-item'

  var link = document.createElement('a')
  link.className = 'item-link'
  link.href = url
  link.setAttribute('alt', title)

  var linkTitle = document.createElement('span')
  linkTitle.className = 'title'
  linkTitle.textContent = title || '?'
  link.appendChild(linkTitle)

  var linkHost = document.createElement('span')
  linkHost.className = 'host'
  linkHost.textContent = link.hostname || url
  link.appendChild(linkHost)

  if (favIconUrl && /^https?:\/\//.test(favIconUrl)) {
    var favicon = document.createElement('div')
    favicon.className = 'favicon'
    var faviconImg = document.createElement('img')
    faviconImg.onerror = () => faviconImg.classList.add('error')
    faviconImg.setAttribute('src', favIconUrl)
    favicon.appendChild(faviconImg)
    link.appendChild(favicon)
  }

  var delBtn = document.createElement('a')
  delBtn.textContent = '×'
  delBtn.id = url
  delBtn.className = 'button delete-button'
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
function renderReadingList (readingListEl, animateItems, callback) {
  getReadingList(pageList => {
    // Sort reading list by most recent to least recent
    pageList.sort((a, b) => {
      return b.addedAt - a.addedAt
    })

    var counter = 0
    var numItems = pageList.length

    // Animate up to 10 items
    var itemsToAnimate = animateItems ? 10 : 0
    itemsToAnimate = (itemsToAnimate > numItems) ? numItems : itemsToAnimate

    // Wait a bit, then create a DOM element for the next reading list item,
    // then recurse
    function waitAndCreate (waitTime) {
      // If we’ve rendered all the animated items
      if (counter >= itemsToAnimate) {
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

        // Add the “slidein” class for animation
        readingItemEl.className += ' slidein'
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
    addedAt: Date.now()
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

  // If the control or meta key (⌘ on Mac, ⊞ on Windows) is pressed…
  var modifierDown = (e.ctrlKey || e.metaKey)

  // If the target’s parent is an <a> we pretend the <a> is the target
  if (target.parentNode.tagName === 'A') {
    target = target.parentNode
  }

  // If the target is a delete button, remove the reading item
  if (/(\s|^)delete-button(\s|$)/.test(target.className)) {
    removeReadingItem(target.id, target.parentNode)
  } else if (isPopup && /(\s|^)item-link(\s|$)/.test(target.className)) {
    e.preventDefault()
    openLink(target.href, modifierDown)
  }
}

/**
 * Filter the reading list DOM elements by search param
 *
 * @param {Event} e - keyup event
 */
function filterReadingList (e) {
  let val = this.value.replace(/\W/g, '')
  let reg = new RegExp(val.split('').join('\\w*'), 'i')
  let title
  let host
  let readingList = document.getElementsByClassName('reading-item')

  // Loop through reading list items to see if they match search text
  for (let i = 0; i < readingList.length; i++) {
    title = readingList[i].getElementsByClassName('title')[0].textContent
    host = readingList[i].getElementsByClassName('host')[0].textContent

    // If match show, if no match remove from list
    readingList[i].style.display = (reg.test(title) || reg.test(host)) ? '' : 'none'
  }
}

export default {
  createReadingItemEl,
  getReadingList,
  renderReadingList,
  addReadingItem,
  removeReadingItem,
  openLink,
  onReadingItemClick,
  filterReadingList
}
