// src/popup.ts

// Define interfaces for better type safety
interface TimeObject {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

// Response types from content script
interface PlaylistTimeSuccessResponse {
	success: true;
	formatted: string;
	timeObject: TimeObject;
}

interface PlaylistTimeErrorResponse {
	success: false;
	message: string;
}

type PlaylistTimeResponse = PlaylistTimeSuccessResponse | PlaylistTimeErrorResponse;

document.addEventListener("DOMContentLoaded", () => {
	const calculateButton = document.getElementById(
		"calculate",
	) as HTMLButtonElement;
	const calculateChunksButton = document.getElementById(
		"calculate-chunks",
	) as HTMLButtonElement;
	const resultDiv = document.getElementById("result") as HTMLDivElement;
	const timeResult = document.getElementById("time-result") as HTMLDivElement;
	const chunkCalculator = document.getElementById(
		"chunk-calculator",
	) as HTMLDivElement;
	const chunksResult = document.getElementById(
		"chunks-result",
	) as HTMLDivElement;
	const errorDiv = document.getElementById("error") as HTMLDivElement;
	const loadingDiv = document.getElementById("loading") as HTMLDivElement;

	let currentTimeObject: TimeObject | null = null;

	calculateButton.addEventListener("click", () => {
		// Hide previous results and errors
		resultDiv.style.display = "none";
		chunkCalculator.style.display = "none";
		errorDiv.style.display = "none";
		loadingDiv.style.display = "block";

		// Get active tab
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const activeTab = tabs[0];

			// Check if we're on a YouTube page
			if (!activeTab.url?.includes("youtube.com")) {
				errorDiv.textContent = "This extension only works on YouTube pages.";
				errorDiv.style.display = "block";
				loadingDiv.style.display = "none";
				return;
			}

			// Send message to content script
			chrome.tabs.sendMessage(
				activeTab.id as number,
				{ action: "getPlaylistTime" },
				(response: PlaylistTimeResponse) => {
					loadingDiv.style.display = "none";

					if (!response) {
						errorDiv.textContent =
							"Error: Content script not ready. Please refresh the page.";
						errorDiv.style.display = "block";
						return;
					}

					if (!response.success) {
						errorDiv.textContent =
							response.message || "Failed to calculate playlist time.";
						errorDiv.style.display = "block";
						return;
					}

					// Display the result
					timeResult.textContent = response.formatted;
					resultDiv.style.display = "block";

					// Store the time object for chunk calculation
					currentTimeObject = response.timeObject;

					// Show chunk calculator
					chunkCalculator.style.display = "block";
				},
			);
		});
	});

	calculateChunksButton.addEventListener("click", () => {
		if (!currentTimeObject) return;

		const chunkInput = document.getElementById(
			"chunk-minutes",
		) as HTMLInputElement;
		const chunkMinutes = parseInt(chunkInput.value, 10);
		if (isNaN(chunkMinutes) || chunkMinutes <= 0) {
			chunksResult.textContent = "Please enter a valid chunk size.";
			return;
		}

		// Calculate chunks
		const totalSeconds =
			currentTimeObject.days * 86400 +
			currentTimeObject.hours * 3600 +
			currentTimeObject.minutes * 60 +
			currentTimeObject.seconds;

		const chunks = Math.ceil(totalSeconds / (chunkMinutes * 60));

		chunksResult.textContent = `You need ${chunks} chunk${
			chunks !== 1 ? "s" : ""
		} of ${chunkMinutes} minutes each.`;
	});
});
