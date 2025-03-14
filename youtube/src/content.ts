/**
 * Type for time duration representation
 */
interface TimeObject {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

/**
 * Type guard for string values
 */
const isString = (v: unknown): v is string => Boolean(v);

/**
 * Extracts timestamps from a YouTube playlist section element.
 */
function getPlaylistTimestamps(el: Element): string[] {
	const timestampBadges = el.querySelectorAll(".badge-shape-wiz__text");
	return Array.from(timestampBadges)
		.map((e) => e.textContent)
		.filter(isString);
}

/**
 * Calculates the total duration of a list of timestamps.
 */
function calculateTotalTimeFromArray(timestamps: string[]): TimeObject {
	const aggregator: TimeObject = {
		days: 0,
		hours: 0,
		minutes: 0,
		seconds: 0,
	};

	for (const time of timestamps) {
		const splits = time.split(":").map(Number);

		// Normalize timestamps to always have hours, minutes, and seconds
		if (splits.length === 2) {
			splits.unshift(0);
		}

		const [hours, minutes, seconds] = splits;

		if (seconds === undefined || minutes === undefined || hours === undefined) {
			continue;
		}

		aggregator.seconds += seconds;
		if (aggregator.seconds >= 60) {
			aggregator.minutes += 1;
			aggregator.seconds -= 60;
		}

		aggregator.minutes += minutes;
		if (aggregator.minutes >= 60) {
			aggregator.hours += 1;
			aggregator.minutes -= 60;
		}

		aggregator.hours += hours;
		if (aggregator.hours >= 24) {
			aggregator.days += 1;
			aggregator.hours -= 24;
		}
	}

	return aggregator;
}

/**
 * Gets the playlist length from the current YouTube page
 */
function getPlaylistLength(): TimeObject | null {
	// Target the playlist container based on YouTube's DOM structure
	const playlistContainer = document.querySelector<Element>(
		"ytd-playlist-video-list-renderer"
	);
	if (!playlistContainer) return null;

	return calculateTotalTimeFromArray(getPlaylistTimestamps(playlistContainer));
}

/**
 * Calculates the number of chunks needed to complete a given time duration.
 */
function calculateTimeChunksCount(timeObject: TimeObject, chunkInMinutes: number): number {
	const totalSeconds =
		timeObject.days * 86400 +
		timeObject.hours * 3600 +
		timeObject.minutes * 60 +
		timeObject.seconds;
	return Math.ceil(totalSeconds / (chunkInMinutes * 60));
}

/**
 * Format time object as a readable string
 */
function formatTime(timeObject: TimeObject): string {
	let result = "";
	if (timeObject.days > 0) {
		result += `${timeObject.days} day${timeObject.days !== 1 ? "s" : ""}, `;
	}
	if (timeObject.hours > 0 || timeObject.days > 0) {
		result += `${timeObject.hours} hour${timeObject.hours !== 1 ? "s" : ""}, `;
	}
	result += `${timeObject.minutes} minute${
		timeObject.minutes !== 1 ? "s" : ""
	}, `;
	result += `${timeObject.seconds} second${
		timeObject.seconds !== 1 ? "s" : ""
	}`;
	return result;
}

interface ContentPlaylistTimeRequest {
	action: string;
}

interface ContentPlaylistTimeSuccessResponse {
	success: true;
	formatted: string;
	timeObject: TimeObject;
}

interface ContentPlaylistTimeErrorResponse {
	success: false;
	message: string;
}

type ContentPlaylistTimeResponse = ContentPlaylistTimeSuccessResponse | ContentPlaylistTimeErrorResponse;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((
	message: ContentPlaylistTimeRequest, 
	_sender: chrome.runtime.MessageSender, 
	sendResponse: (response: ContentPlaylistTimeResponse | boolean) => void
) => {
	console.log('[YouTube Timer] Received message:', message);
	
	// Simple ping action to check if content script is loaded
	if (message.action === "ping") {
		console.log('[YouTube Timer] Received ping, sending pong');
		sendResponse(true);
		return;
	}
	
	if (message.action === "getPlaylistTime") {
		console.log('[YouTube Timer] Processing getPlaylistTime request');
		calculatePlaylistTime()
			.then(response => {
				console.log('[YouTube Timer] Sending response:', response);
				sendResponse(response);
			})
			.catch((error) => {
				console.error('[YouTube Timer] Error calculating time:', error);
				sendResponse({ 
					success: false, 
					message: error.toString() 
				});
			});
		return true; // Keeps the message channel open for async response
	}
});

// Function to calculate the total time of a YouTube playlist
async function calculatePlaylistTime(): Promise<ContentPlaylistTimeResponse> {
	try {
		console.log('[YouTube Timer] Starting playlist time calculation');
		
		// Check if we're on a playlist page
		const isPlaylistPage = window.location.href.includes("playlist");
		console.log('[YouTube Timer] Is playlist page:', isPlaylistPage);
		
		if (!isPlaylistPage) {
			return { success: false, message: "Not a playlist page" };
		}

		// Wait a bit for YouTube to load all elements
		await new Promise(resolve => setTimeout(resolve, 1000));
		
		// Try different selectors for timestamps as YouTube's DOM structure might vary
		const selectors = [
			"ytd-thumbnail-overlay-time-status-renderer span",
			"span.ytd-thumbnail-overlay-time-status-renderer",
			"span.ytp-time-duration",
			".ytd-thumbnail-overlay-time-status-renderer"
		];
		
		let timestamps: NodeListOf<Element> | null = null;
		
		// Try each selector until we find timestamps
		for (const selector of selectors) {
			const elements = document.querySelectorAll(selector);
			console.log(`[YouTube Timer] Selector "${selector}" found ${elements.length} elements`);
			
			if (elements && elements.length > 0) {
				timestamps = elements;
				break;
			}
		}

		if (!timestamps || timestamps.length === 0) {
			console.log('[YouTube Timer] No timestamps found with any selector');
			return { success: false, message: "No video durations found" };
		}

		let totalSeconds = 0;
		console.log(`[YouTube Timer] Processing ${timestamps.length} timestamps`);

		// Calculate total seconds
		timestamps.forEach((timestamp, index) => {
			const timeText = timestamp.textContent?.trim() || "";
			console.log(`[YouTube Timer] Timestamp ${index}: "${timeText}"`);
			
			// Skip if the content doesn't look like a timestamp
			if (!timeText.includes(':')) {
				return;
			}
			
			const timeParts = timeText.split(":").map((part) => parseInt(part, 10));
			console.log(`[YouTube Timer] Time parts:`, timeParts);

			if (timeParts.length === 2) {
				// MM:SS format
				const seconds = timeParts[0] * 60 + timeParts[1];
				totalSeconds += seconds;
				console.log(`[YouTube Timer] Added ${seconds}s (MM:SS format)`);
			} else if (timeParts.length === 3) {
				// HH:MM:SS format
				const seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
				totalSeconds += seconds;
				console.log(`[YouTube Timer] Added ${seconds}s (HH:MM:SS format)`);
			}
		});

		console.log(`[YouTube Timer] Total seconds: ${totalSeconds}`);

		// Convert to days, hours, minutes, seconds
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		console.log(`[YouTube Timer] Converted: ${days}d ${hours}h ${minutes}m ${seconds}s`);

		// Format the time
		let formatted = "";
		if (days > 0) formatted += `${days}d `;
		if (hours > 0 || days > 0) formatted += `${hours}h `;
		if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m `;
		formatted += `${seconds}s`;

		console.log(`[YouTube Timer] Formatted time: ${formatted}`);

		return {
			success: true,
			formatted,
			timeObject: { days, hours, minutes, seconds },
		};
	} catch (error) {
		console.error('[YouTube Timer] Error in calculation:', error);
		return { success: false, message: "Error calculating playlist time" };
	}
}

// Add a floating display on the page to show the playlist length
function addPlaylistTimeDisplay(): void {
	console.log('[YouTube Timer] Attempting to add display overlay');
	// Only run on playlist pages
	if (!window.location.href.includes('playlist')) {
		console.log('[YouTube Timer] Not a playlist page, skipping overlay');
		return;
	}

	// Create or update the display with automatic retry
	const createOrUpdateDisplay = () => {
		// Try to calculate time
		const timeCalculationPromise = calculatePlaylistTime();
		
		timeCalculationPromise.then(result => {
			if (!result.success) {
				console.log('[YouTube Timer] Could not calculate time:', result.message);
				
				// Still create display with a message if this is definitely a playlist page
				if (document.querySelector('ytd-playlist-header-renderer')) {
					createDisplayElement('Calculating playlist time...');
					// Try again in 2 seconds
					setTimeout(createOrUpdateDisplay, 2000);
				}
				return;
			}
			
			// Successfully calculated time, display it
			const { timeObject, formatted } = result;
			createDisplayElement(`Total Playlist Time: ${formatted}`);
			
			// Add extra info about chunks
			const hours = timeObject.days * 24 + timeObject.hours;
			if (hours > 0) {
				// For longer playlists, add chunk information
				const chunks15 = Math.ceil((timeObject.days * 86400 + timeObject.hours * 3600 + 
					timeObject.minutes * 60 + timeObject.seconds) / (15 * 60));
				const chunks30 = Math.ceil((timeObject.days * 86400 + timeObject.hours * 3600 + 
					timeObject.minutes * 60 + timeObject.seconds) / (30 * 60));
				
				addExtraInfoToDisplay(`${chunks15} × 15min chunks | ${chunks30} × 30min chunks`);
			}
		});
	};
	
	// Helper to create or update the display element
	const createDisplayElement = (message: string) => {
		let display = document.getElementById("yt-playlist-time-display");
		let container = document.getElementById("yt-playlist-time-container");
		
		if (!container) {
			// Create container for the entire widget
			container = document.createElement("div");
			container.id = "yt-playlist-time-container";
			Object.assign(container.style, {
				position: "fixed",
				bottom: "24px",
				right: "24px",
				zIndex: "9999",
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-end",
				gap: "8px",
				fontFamily: "'YouTube Sans', 'Roboto', sans-serif",
				transition: "transform 0.3s ease, opacity 0.3s ease",
			});
			
			// Add hover effect
			container.addEventListener('mouseenter', () => {
				if (container) {
					container.style.transform = 'scale(1.05)';
				}
			});
			
			container.addEventListener('mouseleave', () => {
				if (container) {
					container.style.transform = 'scale(1)';
				}
			});
			
			document.body.appendChild(container);
		}
		
		if (!display) {
			// Create the main display element
			display = document.createElement("div");
			display.id = "yt-playlist-time-display";
			
			// YouTube-like styling
			Object.assign(display.style, {
				padding: "10px 16px",
				backgroundColor: "rgba(33, 33, 33, 0.95)",
				color: "white",
				borderRadius: "8px",
				boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
				fontSize: "14px",
				fontWeight: "500",
				backdropFilter: "blur(5px)",
				border: "1px solid rgba(255, 255, 255, 0.1)",
				cursor: "default",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				maxWidth: "300px",
				textAlign: "center",
			});
			
			// YouTube play button icon
			const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			iconSvg.setAttribute("width", "18");
			iconSvg.setAttribute("height", "18");
			iconSvg.setAttribute("viewBox", "0 0 24 24");
			iconSvg.setAttribute("fill", "none");
			iconSvg.style.marginRight = "8px";
			
			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", "M8 5V19L19 12L8 5Z");
			path.setAttribute("fill", "#FF0000");
			iconSvg.appendChild(path);
			
			display.appendChild(iconSvg);
			
			// Create text span
			const textSpan = document.createElement("span");
			textSpan.id = "yt-playlist-time-text";
			display.appendChild(textSpan);
			
			container.appendChild(display);
		}
		
		// Update the text content
		const textElement = display.querySelector("#yt-playlist-time-text");
		if (textElement) {
			textElement.textContent = message;
		}
		
		// Make sure the container is visible
		container.style.display = 'flex';
	};
	
	// Add extra info element under the main display
	const addExtraInfoToDisplay = (extraInfo: string) => {
		const container = document.getElementById("yt-playlist-time-container");
		if (!container) return;
		
		let extraInfoElement = document.getElementById("yt-playlist-time-extra");
		
		if (!extraInfoElement) {
			extraInfoElement = document.createElement("div");
			extraInfoElement.id = "yt-playlist-time-extra";
			
			// Style for the extra info
			Object.assign(extraInfoElement.style, {
				padding: "6px 12px",
				backgroundColor: "rgba(33, 33, 33, 0.8)",
				color: "rgba(255, 255, 255, 0.8)",
				borderRadius: "6px",
				fontSize: "12px",
				fontWeight: "400",
				border: "1px solid rgba(255, 255, 255, 0.05)",
				boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
				opacity: "0.9",
				transition: "opacity 0.3s ease",
			});
			
			container.appendChild(extraInfoElement);
		}
		
		extraInfoElement.textContent = extraInfo;
	};
	
	// Start the creation/update process
	createOrUpdateDisplay();
}

// This function will attempt to add the display with progressive retries
function ensureDisplayRendered(): void {
	console.log('[YouTube Timer] Ensuring display is rendered');
	
	// First attempt
	addPlaylistTimeDisplay();
	
	// Schedule additional attempts with increasing delays
	const retryTimes = [1000, 2000, 3000, 5000, 8000];
	retryTimes.forEach(delay => {
		setTimeout(() => {
			if (window.location.href.includes('playlist')) {
				console.log(`[YouTube Timer] Retry attempt after ${delay}ms`);
				addPlaylistTimeDisplay();
			}
		}, delay);
	});
	
	// Also add an ongoing check every 10 seconds to ensure the display is present
	setInterval(() => {
		if (window.location.href.includes('playlist')) {
			const container = document.getElementById("yt-playlist-time-container");
			if (!container) {
				console.log('[YouTube Timer] Regular check: Display missing, attempting to add');
				addPlaylistTimeDisplay();
			}
		}
	}, 10000);
}

// Initial run on page load
ensureDisplayRendered();

// Create a more robust URL change detection
let lastUrl = location.href;
let urlCheckInterval: number | null = null;
let observer: MutationObserver | null = null;

// Function to handle URL changes
function handleUrlChange() {
	if (location.href !== lastUrl) {
		console.log('[YouTube Timer] URL changed from', lastUrl, 'to', location.href);
		lastUrl = location.href;
		
		// Remove existing display
		const container = document.getElementById("yt-playlist-time-container");
		if (container) {
			container.remove();
		}
		
		// Create new display with progressive retries
		ensureDisplayRendered();
	}
}

// Set up MutationObserver
function setupObserver() {
	if (observer) {
		observer.disconnect();
	}
	
	observer = new MutationObserver((mutations) => {
		const hasRelevantChanges = mutations.some(mutation => {
			// Check if there's a title change which often indicates page navigation in SPAs
			if (mutation.target.nodeName === 'TITLE') return true;
			
			// Check if ytd-app content has changed which indicates YouTube page change
			if ((mutation.target as Element).id === 'content' && mutation.target.nodeName === 'DIV') return true;
			
			// Check for playlist container changes
			if (mutation.target.nodeName === 'YTD-PLAYLIST-VIDEO-LIST-RENDERER') return true;
			
			return false;
		});
		
		if (hasRelevantChanges) {
			handleUrlChange();
		}
	});
	
	observer.observe(document, { childList: true, subtree: true });
}

// Set up URL check interval (backup for SPA navigation)
function setupUrlCheck() {
	if (urlCheckInterval) {
		clearInterval(urlCheckInterval);
	}
	
	urlCheckInterval = window.setInterval(handleUrlChange, 1000) as unknown as number;
}

// Initialize both detection methods
setupObserver();
setupUrlCheck();

// Clean up when the extension is removed or the page is unloaded
window.addEventListener('unload', () => {
	if (observer) {
		observer.disconnect();
	}
	if (urlCheckInterval) {
		clearInterval(urlCheckInterval);
	}
});