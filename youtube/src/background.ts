/**
 * Service worker for the YouTube Playlist Timer extension.
 */

// Log when the service worker is installed
chrome.runtime.onInstalled.addListener(() => {
	console.log('YouTube Playlist Timer extension installed');
});

// Listen for messages from the popup to forward to content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Background] Received message:', message);
  
  if (message.action === 'getPlaylistTime') {
    // Check if we have an active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      if (!activeTab || !activeTab.id) {
        sendResponse({ success: false, message: 'No active tab found' });
        return;
      }
      
      // Forward the message to the content script
      chrome.tabs.sendMessage(activeTab.id, message, (response) => {
        console.log('[Background] Got response from content script:', response);
        
        // If no response, the content script might not be loaded
        if (chrome.runtime.lastError) {
          console.error('[Background] Error:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            message: 'Content script not ready. Please refresh the page.'
          });
          return;
        }
        
        // Forward the response back to the popup
        sendResponse(response);
      });
    });
    
    // Keep the message channel open for asynchronous response
    return true;
  }
});