const isString = (v) => Boolean(v)

/**
 * Extracts timestamps from a YouTube playlist section element.
 *
 * @param {Element} el - The YouTube playlist section element.
 * @returns {string[]} An array of timestamps in the format "HH:MM:SS" or "MM:SS".
 */
function getPlaylistTimestamps(el) {
  const timestampBadges = el.querySelectorAll('.badge-shape-wiz__text')
  return Array.from(timestampBadges)
    .map((e) => e.textContent)
    .filter(isString)
}

/**
 * Calculates the total duration of a list of timestamps.
 *
 * @param {string[]} timestamps - An array of timestamps.
 * @returns {{ days: number, hours: number, minutes: number, seconds: number }}
 */
function calculateTotalTimeFromArray(timestamps) {
  const aggregator = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  }

  for (const time of timestamps) {
    const splits = time.split(':').map(Number)

    // Normalize timestamps to always have hours, minutes, and seconds
    if (splits.length === 2) {
      splits.unshift(0)
    }

    const [hours, minutes, seconds] = splits

    if (seconds === undefined || minutes === undefined || hours === undefined) {
      continue
    }

    aggregator.seconds += seconds
    if (aggregator.seconds >= 60) {
      aggregator.minutes += 1
      aggregator.seconds -= 60
    }

    aggregator.minutes += minutes
    if (aggregator.minutes >= 60) {
      aggregator.hours += 1
      aggregator.minutes -= 60
    }

    aggregator.hours += hours
    if (aggregator.hours >= 24) {
      aggregator.days += 1
      aggregator.hours -= 24
    }
  }

  return aggregator
}

/**
 * Gets the playlist length from the current YouTube page
 */
function getPlaylistLength() {
  // Target the playlist container based on YouTube's DOM structure
  const playlistContainer = document.querySelector('ytd-playlist-video-list-renderer')
  if (!playlistContainer) return null

  return calculateTotalTimeFromArray(getPlaylistTimestamps(playlistContainer))
}

/**
 * Calculates the number of chunks needed to complete a given time duration.
 *
 * @param {Object} timeObject - The time object representing the duration.
 * @param {number} chunkInMinutes - The length of each chunk in minutes.
 * @returns {number} The number of chunks needed to complete the duration.
 */
function calculateTimeChunksCount(timeObject, chunkInMinutes) {
  const totalSeconds =
    timeObject.days * 86400 + timeObject.hours * 3600 + timeObject.minutes * 60 + timeObject.seconds
  return Math.ceil(totalSeconds / (chunkInMinutes * 60))
}

/**
 * Format time object as a readable string
 */
function formatTime(timeObject) {
  let result = ''
  if (timeObject.days > 0) {
    result += `${timeObject.days} day${timeObject.days !== 1 ? 's' : ''}, `
  }
  if (timeObject.hours > 0 || timeObject.days > 0) {
    result += `${timeObject.hours} hour${timeObject.hours !== 1 ? 's' : ''}, `
  }
  result += `${timeObject.minutes} minute${timeObject.minutes !== 1 ? 's' : ''}, `
  result += `${timeObject.seconds} second${timeObject.seconds !== 1 ? 's' : ''}`
  return result
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPlaylistTime') {
    const timeObject = getPlaylistLength()
    if (timeObject) {
      sendResponse({
        success: true,
        timeObject,
        formatted: formatTime(timeObject),
      })
    } else {
      sendResponse({
        success: false,
        message: 'No playlist found on this page',
      })
    }
  }
  return true // Required for async sendResponse
})

// Add a floating display on the page to show the playlist length
function addPlaylistTimeDisplay() {
  const timeObject = getPlaylistLength()
  if (!timeObject) return

  let display = document.getElementById('yt-playlist-time-display')
  if (!display) {
    display = document.createElement('div')
    display.id = 'yt-playlist-time-display'
    display.style.position = 'fixed'
    display.style.bottom = '20px'
    display.style.right = '20px'
    display.style.padding = '8px 12px'
    display.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
    display.style.color = 'white'
    display.style.borderRadius = '4px'
    display.style.zIndex = '9999'
    display.style.fontSize = '14px'
    document.body.appendChild(display)
  }

  display.textContent = `Total Playlist Time: ${formatTime(timeObject)}`
}

// Run on page load and whenever the URL changes (YouTube is a SPA)
addPlaylistTimeDisplay()
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    // Wait a bit for YouTube to load the content
    setTimeout(addPlaylistTimeDisplay, 1500)
  }
}).observe(document, { subtree: true, childList: true })
