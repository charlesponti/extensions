// Content script to interact with UberEats page

import type { UberEatsData } from "./types";

// Helper functions for scraping
async function findChildMatchingQuery(
	element: Element,
	queryFn: (element: Element) => Promise<boolean>,
) {
	const results: Element[] = [];
	const children = element.querySelectorAll("*");

	for (const child of children) {
		try {
			if (await queryFn(child)) {
				results.push(child);
			}
		} catch (error) {
			console.error("Error in query function:", error);
		}
	}

	return results;
}

async function scrapeUberEatsOrders() {
	console.log("Scraping Uber Eats orders...");
	const main = document.querySelector("main");

	if (!main) {
		console.error("Could not find main element");
		return {
			total: 0,
			restaurants: {},
			orders: [],
			error: "Could not find main element",
		};
	}

	const orders = await findChildMatchingQuery(main, async (e) => {
		const t = e.textContent;
		const href = e.getAttribute("href");

		if (!t || !href) return false;

		return (
			Boolean(t.match(/\$\d+\.\d+/)) &&
			Boolean(t.includes("items for")) &&
			Boolean(href.includes("/store"))
		);
	});

	console.log("Found orders:", orders);
	const result: UberEatsData = {
		total: 0,
		restaurants: {},
		orders: [],
	};

	for (const element of orders) {
		const restaurantLink = element.querySelector('a[href*="/store"]');
		if (!restaurantLink) continue;

		const restaurant = restaurantLink.textContent;
		if (!restaurant) continue;

		const infoElement = await findChildMatchingQuery(element, async (e) => {
			const text = e.textContent;
			return Boolean(text?.includes("items for"));
		});

		if (!infoElement.length) continue;

		const infoText = infoElement[0].textContent;
		const info = infoText
			?.split("•")
			.map((s) => s.trim())
			.slice(0, 2);

		if (!info) continue;

		const itemsAndPrice = info[0].split(" items for ");
		const numOfItems = Number(itemsAndPrice[0]);
		const price = Number.parseFloat(itemsAndPrice[1].slice(1));

		// Update result object
		result.total += price;

		if (result.restaurants[restaurant]) {
			result.restaurants[restaurant].visits += 1;
			result.restaurants[restaurant].total += price;
		} else {
			result.restaurants[restaurant] = { visits: 1, total: price };
		}

		result.orders.push({
			restaurant,
			numOfItems,
			price: itemsAndPrice[1],
			date: info[1],
		});
	}

	console.log({ main, orders, result });
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
				console.error("Scraping error:", error);
				sendResponse({ success: false, error: String(error) });
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
