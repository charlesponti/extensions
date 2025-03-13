// Store the latest results
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let latestResults: any | null = null;
let scrapingStatus: string | null = null;

// Helper function to safely send messages
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function sendMessageSafely(message: any) {
	try {
		chrome.runtime.sendMessage(message, (_response) => {
			console.log("Message sent:", _response, message);
			if (chrome.runtime.lastError) {
				console.log(
					`Message sending failed: ${chrome.runtime.lastError.message}`,
				);
			}
		});
	} catch (error) {
		console.error("Error sending message:", error);
	}
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	console.log("Message received:", request);
	// Store scraped results from content script
	if (request.action === "saveResults") {
		latestResults = request.data;
		// Store in Chrome storage
		chrome.storage.local.set({ uberEatsData: request.data });
		// Notify popup that scraping is complete
		sendMessageSafely({
			action: "scrapingComplete",
			data: request.data,
		});
		return;
	}

	// Update scraping status
	if (request.action === "scrapingStatus") {
		scrapingStatus = request.status;
		// Pass the status and error message to popup
		sendMessageSafely({
			action: "scrapingStatusUpdate",
			status: request.status,
			...(request.error && { error: request.error }),
		});
		return;
	}

	// Send latest results to popup when requested
	if (request.action === "getResults") {
		// First try to get from memory
		if (latestResults) {
			sendResponse(latestResults);
		} else {
			// If not in memory, try to get from storage
			chrome.storage.local.get("uberEatsData", (data) => {
				sendResponse(data.uberEatsData || null);
			});
			return true; // Required for async sendResponse
		}
	}

	// Send current scraping status
	if (request.action === "getScrapingStatus") {
		sendResponse({ status: scrapingStatus });
		return true;
	}

	// Check if we need to navigate to orders page
	if (request.action === "navigateToOrdersPage") {
		chrome.tabs.create({ url: "https://www.ubereats.com/orders" });
	}

	// Notify popup that we're on the orders page
	if (request.action === "onOrdersPage") {
		sendMessageSafely({ action: "enableScrapeButton" });
	}

	// Start scraping on active tab
	if (request.action === "initiateScrapingOnActiveTab") {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs[0]?.id) {
				try {
					chrome.tabs.sendMessage(
						tabs[0].id,
						{ action: "startScraping" },
						(_response) => {
							if (chrome.runtime.lastError) {
								console.log(
									`Tab message failed: ${chrome.runtime.lastError.message}`,
								);
								sendMessageSafely({
									action: "scrapingStatusUpdate",
									status: "error",
									message:
										"Could not connect to page. Please reload and try again.",
								});
							}
						},
					);
				} catch (error) {
					console.error("Error sending message to tab:", error);
					sendMessageSafely({
						action: "scrapingStatusUpdate",
						status: "error",
						message: "Failed to communicate with page",
					});
				}
			} else {
				sendMessageSafely({
					action: "scrapingStatusUpdate",
					status: "error",
					message: "No active tab found",
				});
			}
		});
	}
});
