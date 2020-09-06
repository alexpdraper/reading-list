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
  const url = info.url
  const title = info.title
  const favIconUrl = info.favIconUrl ? info.favIconUrl : `https://icons.duckduckgo.com/ip2/${new URL(info.url).hostname}.ico`
  const item = document.createElement('div')
  item.className = 'reading-item'

  if (info.shiny) {
    item.className += ' shiny'
  }

  if (info.viewed) {
    item.classList.add('read')
  } else {
    item.classList.add('unread')
  }

  const link = document.createElement('a')
  link.className = 'item-link'
  link.href = url

  const linkTitle = document.createElement('span')
  linkTitle.className = 'title'
  linkTitle.textContent = title || '?'
  link.appendChild(linkTitle)

  const linkHost = document.createElement('span')
  linkHost.classList.add('host')
  linkHost.textContent = link.hostname || url
  link.appendChild(linkHost)

  if (favIconUrl && /^(https?:\/\/|\/icons\/)/.test(favIconUrl)) {
    const favicon = document.createElement('div')
    favicon.classList.add('favicon')
    const faviconImg = document.createElement('img')
    faviconImg.classList.add('favicon-img')
    faviconImg.onerror = () => faviconImg.classList.add('error')
    faviconImg.setAttribute('src', favIconUrl)
    favicon.appendChild(faviconImg)
    link.appendChild(favicon)
  }

  const delBtn = document.createElement('a')
  delBtn.textContent = '×'
  delBtn.id = url
  delBtn.classList.add('delete-button')
  item.appendChild(link)
  item.appendChild(delBtn)

  const editBtn = document.createElement('a')
  editBtn.value = url
  editBtn.classList.add('edit-button')
  item.appendChild(editBtn)

  const editImg = document.createElement('img')
  editImg.classList.add('edit-img')
  loadSVG('/icons/pencil.svg', editImg)
  editBtn.appendChild(editImg)
  item.appendChild(link)

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
    const settings = pages.settings
    delete pages['settings']
    delete pages['index']
    let pageList = []

    for (let page in pages) {
      if (pages.hasOwnProperty(page)) {
        pageList.push(pages[page])
      }
    }
    pageList.sort((a, b) => {
      if (b.index === a.index) {
        return b.addedAt - a.addedAt
      }
      return a.index - b.index
    })
    // Ask for a review!
    if (pageList.length >= 6 && !settings.askedForReview) {
      settings.askedForReview = true
      const reviewUrl = isFirefox
        ? 'https://addons.mozilla.org/en-US/firefox/addon/reading_list/'
        : 'https://chrome.google.com/webstore/detail/reading-list/lloccabjgblebdmncjndmiibianflabo/reviews'

      const reviewReadingListItem = {
        title: 'Like the Reading List? Give us a review!',
        url: reviewUrl,
        shiny: true,
        addedAt: Date.now(),
        index: 0,
        favIconUrl: '/icons/icon48.png'
      }
      pageList.unshift(reviewReadingListItem)

      const setObj = {
        settings
      }
      setObj[reviewUrl] = reviewReadingListItem
      chrome.storage.sync.set(setObj)
    }
    callback(pageList)
  })
}

/**
 * Updates the reading list index
 *
 * @param {Element} readingListEl - reading list DOM element
 */
function updateIndex (readingListEl) {
  chrome.storage.sync.get(null, pages => {
    readingListEl.querySelectorAll('.item-link').forEach((el, i) => {
      pages[el.getAttribute('href')].index = i + 1
    })
    if (pages['index']) {
      delete pages['index']
      chrome.storage.sync.remove('index')
    }
    chrome.storage.sync.set(pages)
  })
}

/**
 * Sets the counts on the all and unread buttons
 * @param {array} pageList - list of reading items
 */
function setCount (pageList) {
  document.getElementById('all-count').textContent = `${pageList.length}`
  document.getElementById('unread-count').textContent = `${pageList.filter(page => !page.viewed).length}`
}

/**
 * Render the reading list
 *
 * @param {Element} readingListEl - reading list DOM element
 * @param {boolean} animateItems - animate incoming reading items?
 * @param {boolean} viewAll - view all items or not
 * @param {function()} callback - called when the list is rendered
 */
function renderReadingList (readingListEl, animateItems, settings) {
  getReadingList(pageList => {
    readingListEl.innerHTML = ''
    setCount(pageList)
    const sortedReadingList = sortReadingList(pageList, settings)
    const numItems = sortedReadingList.length

    // Animate up to 10 items
    const animateCount = animateItems ? 10 : 0
    const itemsToAnimate = (animateCount > numItems) ? numItems : animateCount
    let counter = 0
    let itemsAnimated = 0

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
        for (let i = counter; i < numItems; i++) {
          readingListEl.appendChild(createReadingItemEl(sortedReadingList[i]))
        }
        return
      }

      // Wait a bit, then make a reading item
      window.setTimeout(() => {
        const readingItemEl = createReadingItemEl(sortedReadingList[counter])

        // Increment the animated counter if item is viewable
        if (!sortedReadingList[counter].viewed || (settings && settings.viewAll)) {
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

function sortReadingList (pageList, settings) {
  if (!settings.sortOption) {
    return pageList
  } else {
    return pageList.sort((a, b) => {
      if (settings.sortOption === 'date') {
        return compareDate(a, b, settings.sortOrder)
      } else {
        return compareTitle(a, b, settings.sortOrder)
      }
    })
  }
}

function compareTitle (a, b, order) {
  if (order === 'up') {
    return b.title.localeCompare(a.title, undefined, {numeric: true, sensitivity: 'base'})
  } else {
    return a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'})
  }
}

function compareDate (a, b, order) {
  if (order === 'up') {
    return a.addedAt - b.addedAt
  } else {
    return b.addedAt - a.addedAt
  }
}

/**
 * Add an item to the reading list
 *
 * @param {object} info - page to add’s url, title, and favIconUrl
 * @param {Element} readingListEl - reading list DOM element
 * @param {function(object)} callback - called when the item is added
 */
function addReadingItem (info, readingListEl, callback) {
  if (!info.url) {
    return
  }

  // Handles all firefox preference pages
  if (info.url.startsWith('about')) {
    if (info.url.includes('http')) {
      const url = info.url.replace(/about:\w+\?url=/g, '')
      info.url = decodeURIComponent(url)
    } else {
      return
    }
  }

  // Restrict info’s values
  info = {
    url: info.url,
    title: info.title,
    addedAt: Date.now(),
    viewed: false
  }

  // Object for setting the storage
  const setObj = {}
  setObj[info.url] = info

  chrome.storage.sync.set(setObj, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError)
    }

    // If the readingListEl was passed, create the DOM element for the
    // reading item
    let readingItemEl
    if (readingListEl) {
      // Look for a delete button with the ID of the url
      const currentItem = document.getElementById(info.url)

      // If it exists, remove it from the list (prevents duplicates)
      if (currentItem) {
        removeReadingItem(null, currentItem.parentNode)
      }

      // Create the reading item element
      readingItemEl = createReadingItemEl(info)

      // Add the animation class
      readingItemEl.className += ' slidein'

      // Add it to the top of the reading list
      readingListEl.insertBefore(readingItemEl, readingListEl.firstChild)

      updateIndex(readingListEl)
    }

    chrome.runtime.sendMessage({
      'type': 'add',
      'url': info.url,
      'info': info
    })

    // Add the “✔” to the badge for matching tabs
    const queryInfo = {url: info.url.replace(/#.*/, '')}

    chrome.tabs.query(queryInfo, tabs => {
      for (let tab of tabs) {
        // If the URL is identical, add the “✔” to the badge
        if (tab.url === info.url && tab.id) {
          chrome.browserAction.setBadgeText({
            text: '✔',
            tabId: tab.id
          })
        }
      }

      if (typeof callback === 'function') {
        callback(info, readingItemEl)
      }
      getReadingList(pageList => {
        setCount(pageList)
      })
    })
  })
}

/**
 * Remove a reading list item from the DOM, storage, or both
 *
 * @param {string} url (optional) - URL of the page to remove
 * @param {Element} element - (optional) reading list item
 */
function removeReadingItem (url, element) {
  // If url is truthy, remove the item from storage
  if (url) {
    chrome.storage.sync.remove(url, () => {
      // Find tabs with the reading item’s url
      const queryInfo = {url: url.replace(/#.*/, '')}

      chrome.tabs.query(queryInfo, tabs => {
        for (let tab of tabs) {
          // If the URL is identical, remove the “✔” from the badge
          if (tab.url === url) {
            chrome.browserAction.setBadgeText({
              text: '',
              tabId: tab.id
            })
          }
        }
      })
      getReadingList(pageList => {
        setCount(pageList)
      })
    })

    chrome.runtime.sendMessage({
      'type': 'remove',
      'url': url
    })
  }

  // If element is truthy, remove the element
  if (element) {
    // Listen for the end of an animation
    element.addEventListener('animationend', () => {
      // Remove the item from the DOM when the animation is finished
      const readingListEl = element.parentNode
      element.remove()
      updateIndex(readingListEl)
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
    chrome.tabs.create({url: url, active: false})
  } else {
    // Query for the active tab
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, tabs => {
      const tab = tabs[0]

      // Update the URL of the current tab
      chrome.tabs.update(tab.id, {url: url})

      // Close the popup
      const isPopup = document.body.classList.contains('popup-page')
      if (isPopup) {
        window.close()
      }
    })
  }
}

/**
 * Open or delete reading items (click event listener)
 *
 * @param {Event} e - click event
 */
function onReadingItemClick (e) {
  const isPopup = document.body.classList.contains('popup-page')
  const isSidebar = document.body.classList.contains('sidebar-page')
  let target = e.target
  if (target.tagName === 'INPUT') {
    e.preventDefault()
    return
  }

  // Set target to the closest a as we are using those to decide what to do
  target = target.closest('a')

  // If the target is a delete button, remove the reading item
  // Or if the target is a edit button, edit the title
  if (target.classList.contains('delete-button')) {
    removeReadingItem(target.id, target.parentNode)
  } else if (target.classList.contains('edit-button')) {
    switchToInput(target.parentNode)
  } else if ((isPopup || isSidebar) && target.classList.contains('item-link')) {
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
    const filterList = fuse.search(this.value)

    // Loop through reading list items to see if they match search text
    for (let item of readingList) {
      let display = false
      for (let filteredItem of filterList) {
        const url = item.querySelector('.item-link').getAttribute('href')
        if (url === filteredItem.url) {
          display = true
        }
      }
      item.style.display = display || displayAll ? '' : 'none'
    }
  })
}

/**
 * Toggles the buttons, and updates the options for which reading list to view.
 */
function changeView () {
  const viewAll = this.id === 'all'
  updateViewAll(viewAll)
  updateFilterButton(viewAll)
}

/**
 * Updates the filter button
 * @param {boolean} viewAll - true is show all and false is show only unread
 */
function updateFilterButton (viewAll) {
  // Clear existing filter
  const filterButtons = document.querySelectorAll('div.filter button')
  for (let button of filterButtons) {
    button.classList.remove('active')
  }
  // Update the button on display
  if (viewAll) {
    document.getElementById('all').classList.add('active')
    document.getElementById('reading-list').classList.remove('unread-only')
  } else {
    document.getElementById('unread').classList.add('active')
    document.getElementById('reading-list').classList.add('unread-only')
  }
}

/**
 * Toggles the buttons, and updates the options for which reading list to view.
 */
function sortItems () {
  const childClassSortOrder = this.lastElementChild.classList
  let sortOrder
  let sortOption = this.id
  if (this.classList.contains('active')) {
    if (childClassSortOrder.contains('down')) {
      sortOrder = 'up'
    } else {
      sortOrder = null
      sortOption = null
    }
  } else {
    sortOrder = 'down'
  }

  // Updates the view setting in setting menu
  updateSort(sortOption, sortOrder)
  updateSortButton(sortOption, sortOrder)
}

/**
 * Updates the sort buttons
 * @param {string} sortOption - the option date or title
 * @param {string} sortOrder - the order up or down
 */
function updateSortButton (sortOption, sortOrder) {
  // Clear existing sort
  const sortButtons = document.querySelectorAll('div.sort button')
  for (let button of sortButtons) {
    button.classList.remove('active')
    button.lastElementChild.classList.remove(...button.lastElementChild.classList)
  }
  // Update sort buttons
  if (sortOption) {
    document.getElementById(sortOption).classList.add('active')
    document.getElementById(sortOption).lastElementChild.classList.add('arrow', sortOrder)
  }
}

/**
 *  Saves sort option to chrome.storage
 * @param {string} sortOption The sort function
 * @param {string} sortOrder The sort function
 */
function updateSort (sortOption, sortOrder) {
  const readingList = document.getElementById('reading-list')
  chrome.storage.sync.get(defaultSettings, store => {
    store.settings.sortOption = sortOption
    store.settings.sortOrder = sortOrder
    chrome.storage.sync.set({
      settings: store.settings
    })
    chrome.runtime.sendMessage({
      'type': 'orderChanged'
    })
    renderReadingList(readingList, false, store.settings)
  })
}

const isFirefox = typeof InstallTrigger !== 'undefined'
const defaultSettings = {
  settings: {
    theme: 'light',
    addContextMenu: true,
    addPageAction: true,
    animateItems: !isFirefox,
    openNewTab: false,
    sortOption: '',
    sortOrder: '',
    viewAll: true
  }
}

/**
 *  Saves viewAll option to chrome.storage
 * @param {boolean} viewAll The boolean value to set if all items have been viewed
 */
function updateViewAll (viewAll) {
  chrome.storage.sync.get(defaultSettings, items => {
    items.settings.viewAll = viewAll
    chrome.storage.sync.set({
      settings: items.settings
    })
    chrome.runtime.sendMessage({
      'type': 'orderChanged'
    })
  })
}

/**
 * Update a reading list item's title
 *
 * @param {string} url - url of a reading list item
 * @param {string} title - title of a reading list item
 */
function setReadingItemTitle (url, title) {
  chrome.storage.sync.get(url, page => {
    page[url].title = title
    chrome.storage.sync.set(page)
    chrome.runtime.sendMessage({
      'type': 'update',
      'url': url,
      'info': page[url]
    })
  })
}

/**
 * Makes the title of the reading list item editable
 * @param {Element} element The reading list item being edited
 */
function switchToInput (element) {
  // Show overlay
  const overlay = document.getElementById('overlay')
  overlay.style.display = 'block'

  // Change pencil to a disk for save
  const button = element.querySelector('.edit-button')
  button.classList.add('store-button')
  button.classList.remove('edit-button')
  const image = element.querySelector('svg.edit-img')
  loadSVG('/icons/save.svg', image)

  // Replace the span with input
  const title = element.querySelector('span.title')
  const input = document.createElement('input')
  input.classList.add('edit-title')
  input.value = title.textContent
  input.original = title.textContent
  title.replaceWith(input)

  // Event listeners for when title is changed
  overlay.addEventListener('click', (e) => {
    switchToSpan(e, input, button)
  })
  input.addEventListener('keydown', (e) => {
    switchToSpan(e, input, button)
  })
  input.select()
}

/**
 * Switching the editable reading list item title to a span
 *
 * @param {Event} e - blur/keydown event
 * @param {Element} input - title box
 * @param {Element} button - button being pushed
 */
function switchToSpan (e, input, button) {
  let doSave = true
  // If not enter or escape on key down return
  if (e.key && e.key !== 'Enter' && e.key !== 'Escape') {
    return
  }
  // If escape do not save the title
  if (e.key === 'Escape') {
    e.preventDefault()
    doSave = false
  }

  // Remove Overlay
  document.getElementById('overlay').style.display = 'none'

  // Change the button from a disk to a pencil
  // let button = this.parentNode.parentNode.querySelector('.store-button')
  button.classList.add('edit-button')
  button.classList.remove('store-button')
  const url = button.value
  const title = doSave ? input.value : input.original
  const image = input.parentNode.parentNode.querySelector('svg.edit-img')
  loadSVG('/icons/pencil.svg', image)
  image.src = '/icons/pencil.svg'

  // Change the title back to a span
  const span = document.createElement('span')
  span.textContent = title
  span.classList.add('title')
  input.replaceWith(span)

  // Update the reading item
  if (doSave) {
    setReadingItemTitle(url, title)
  }
}

/**
 * Loads svg to a dom element
 * @param {string} url the url of the svg
 * @param {Element} element the element to be replaced with the svg
 */
function loadSVG (url, element) {
  const imgClass = element.getAttribute('class')

  const xhr = new XMLHttpRequest()
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      const svg = xhr.responseXML.getElementsByTagName('svg')[0]

      if (imgClass) {
        svg.setAttribute('class', imgClass + ' replaced-svg')
      }

      svg.removeAttribute('xmlns:a')

      if (!svg.hasAttribute('viewBox') && svg.hasAttribute('height') && svg.hasAttribute('width')) {
        svg.setAttribute('viewBox', '0 0 ' + svg.getAttribute('height') + ' ' + svg.getAttribute('width'))
      }
      element.parentElement.replaceChild(svg, element)
    }
  }

  xhr.open('GET', url, true)
  xhr.send(null)
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
  changeView,
  updateIndex,
  updateFilterButton,
  updateSortButton,
  sortItems
}
