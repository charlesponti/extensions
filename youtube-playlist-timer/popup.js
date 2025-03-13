document.addEventListener('DOMContentLoaded', () => {
  const calculateButton = document.getElementById('calculate')
  const calculateChunksButton = document.getElementById('calculate-chunks')
  const resultDiv = document.getElementById('result')
  const timeResult = document.getElementById('time-result')
  const chunkCalculator = document.getElementById('chunk-calculator')
  const chunksResult = document.getElementById('chunks-result')
  const errorDiv = document.getElementById('error')
  const loadingDiv = document.getElementById('loading')

  let currentTimeObject = null

  calculateButton.addEventListener('click', function () {
    // Hide previous results and errors
    resultDiv.style.display = 'none'
    chunkCalculator.style.display = 'none'
    errorDiv.style.display = 'none'
    loadingDiv.style.display = 'block'

    // Get active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const activeTab = tabs[0]

      // Check if we're on a YouTube page
      if (!activeTab.url.includes('youtube.com')) {
        errorDiv.textContent = 'This extension only works on YouTube pages.'
        errorDiv.style.display = 'block'
        loadingDiv.style.display = 'none'
        return
      }

      // Send message to content script
      chrome.tabs.sendMessage(activeTab.id, { action: 'getPlaylistTime' }, function (response) {
        loadingDiv.style.display = 'none'

        if (!response) {
          errorDiv.textContent = 'Error: Content script not ready. Please refresh the page.'
          errorDiv.style.display = 'block'
          return
        }

        if (!response.success) {
          errorDiv.textContent = response.message || 'Failed to calculate playlist time.'
          errorDiv.style.display = 'block'
          return
        }

        // Display the result
        timeResult.textContent = response.formatted
        resultDiv.style.display = 'block'

        // Store the time object for chunk calculation
        currentTimeObject = response.timeObject

        // Show chunk calculator
        chunkCalculator.style.display = 'block'
      })
    })
  })

  calculateChunksButton.addEventListener('click', function () {
    if (!currentTimeObject) return

    const chunkMinutes = parseInt(document.getElementById('chunk-minutes').value, 10)
    if (isNaN(chunkMinutes) || chunkMinutes <= 0) {
      chunksResult.textContent = 'Please enter a valid chunk size.'
      return
    }

    // Calculate chunks
    const totalSeconds =
      currentTimeObject.days * 86400 +
      currentTimeObject.hours * 3600 +
      currentTimeObject.minutes * 60 +
      currentTimeObject.seconds

    const chunks = Math.ceil(totalSeconds / (chunkMinutes * 60))

    chunksResult.textContent = `You need ${chunks} chunk${chunks !== 1 ? 's' : ''} of ${chunkMinutes} minutes each.`
  })
})
