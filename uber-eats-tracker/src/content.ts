// Content script to interact with UberEats page

import type { UberEatsData } from "./types";

// Helper functions for scraping
function findMatchingChild(
	parent: HTMLElement,
	queryFn: (element: HTMLElement) => boolean,
): HTMLElement[] {
	const results = new Set<HTMLElement>();

	function traverse(element: HTMLElement) {
		// Skip if this is not an element node
		if (element.nodeType !== Node.ELEMENT_NODE) return;

		// Check if the current element matches the query
		if (queryFn(element)) {
			// If the element has matching children
			let hasMatchingChildren = false;
			for (const child of element.children) {
				if (queryFn(child as HTMLElement)) {
					hasMatchingChildren = true;
					break;
				}
			}

			if (!hasMatchingChildren) {
				results.add(element);
			}
		}

		// We have to traverse all the element's children
		// because matching elements could be in any branch of DOM
		for (const child of element.children) {
			traverse(child as HTMLElement);
		}
	}

	traverse(parent);
	return Array.from(results);
}

async function scrapeUberEatsOrders() {
	const main = document.querySelector("main");
	if (!main) {
		throw new Error("Main element not found");
	}

	while (true) {
		const showBtn = Array.from(document.querySelectorAll("button")).find(
			(e) => e.textContent === "Show more",
		);
		if (!showBtn) break;
		showBtn.click();
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	// Find all the order elements
	const orders = findMatchingChild(main, (e) => {
		return (
			/\d+\s(item|items)\s+for\s\$\d+\.\d+/.test(e.textContent || "") &&
			e.querySelector("a[href*='/store']") !== null
		);
	}) as HTMLElement[];

	const result: UberEatsData = {
		total: 0,
		restaurants: {},
		orders: [],
	};

	for (const order of orders) {
		const restaurant = order.querySelector("a[href*='/store']")?.textContent;
		const info = Array.from(order.querySelectorAll("*"))
			.find((el) => (el.textContent?.indexOf("items for") ?? -1) >= 0)
			?.textContent?.split("•")
			.map((s) => s.trim())
			.slice(0, 2);

		if (!info || !restaurant) {
			console.error("Error parsing order:", order);
			continue;
		}

		console.log({ info });
		const [itemsAndPrice, date] = info;
		const [numOfItems, priceText] = itemsAndPrice.split(" items for ");
		const price = Number.parseFloat(priceText.slice(1));

		result.total += price;

		if (result.restaurants[restaurant]) {
			result.restaurants[restaurant].visits += 1;
			result.restaurants[restaurant].total += price;
		} else {
			result.restaurants[restaurant] = { visits: 1, total: price };
		}

		result.orders.push({
			restaurant,
			numOfItems: Number(numOfItems),
			price: priceText,
			date,
		});
	}

	return result;
}

// Load all orders by repeatedly clicking "Show more"
async function loadAllOrders() {
	let keepClicking = true;
	while (keepClicking) {
		try {
			const showMoreBtn = Array.from(document.querySelectorAll("button")).find(
				(button) => button.textContent?.trim() === "Show more",
			);

			if (showMoreBtn) {
				showMoreBtn.click();
				// Wait for more content to load
				await new Promise((resolve) => setTimeout(resolve, 1500));
			} else {
				keepClicking = false;
			}
		} catch (error) {
			console.error("Error clicking Show more:", error);
			keepClicking = false;
		}
	}
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	if (request.action === "ping") {
		sendResponse({ ready: true });
		return true; // Required for async sendResponse
	}

	if (request.action === "startScraping") {
		(async () => {
			try {
				chrome.runtime.sendMessage({
					action: "scrapingStatus",
					status: "loading-orders",
				});
				await loadAllOrders();
				chrome.runtime.sendMessage({
					action: "scrapingStatus",
					status: "analyzing-orders",
				});
				const data = await scrapeUberEatsOrders();
				chrome.runtime.sendMessage({ action: "saveResults", data });
				sendResponse({ success: true, data });
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				chrome.runtime.sendMessage({
					action: "scrapingStatus",
					status: "error",
					error: errorMessage,
				});
				sendResponse({ success: false, error: errorMessage });
			}
		})();
		return true; // Required for async sendResponse
	}
});

// Check if we're on the orders page and notify the extension
if (window.location.href.includes("ubereats.com/orders")) {
	chrome.runtime.sendMessage({ action: "onOrdersPage" });
}

console.log("Uber Eats Tracker content script loaded");
