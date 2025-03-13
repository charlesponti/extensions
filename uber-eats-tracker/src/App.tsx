import { useState, useEffect } from "react";
import type { Order, RestaurantInfo, UberEatsData } from "./types";

interface StatusOverlayProps {
	message: string;
}

function StatusOverlay({ message }: StatusOverlayProps) {
	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				backgroundColor: "rgba(0, 0, 0, 0.7)",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				zIndex: 10000,
				color: "white",
				fontSize: "24px",
			}}
		>
			<div
				style={{
					width: "50px",
					height: "50px",
					border: "5px solid #f3f3f3",
					borderTop: "5px solid #3498db",
					borderRadius: "50%",
					animation: "spin 2s linear infinite",
					marginBottom: "20px",
				}}
			/>
			<div>{message}</div>
			<style>
				{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
			</style>
		</div>
	);
}

interface RestaurantsListProps {
	restaurants: Record<string, RestaurantInfo>;
}

function RestaurantsList({ restaurants }: RestaurantsListProps) {
	const sortedRestaurants = Object.entries(restaurants).sort(
		(a, b) => b[1].total - a[1].total,
	);

	return (
		<div className="grid gap-4 p-4 max-w-2xl mx-auto">
			{sortedRestaurants.map(([restaurant, info]) => (
				<div
					key={restaurant}
					className="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow"
				>
					<div className="card-body p-4">
						<h3 className="card-title text-lg font-bold text-primary">
							{restaurant}
						</h3>
						<div className="flex justify-between items-center mt-2">
							<div className="badge badge-secondary badge-lg">
								{info.visits} {info.visits === 1 ? "visit" : "visits"}
							</div>
							<div className="text-xl font-semibold text-accent">
								${info.total.toFixed(2)}
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

interface OrdersListProps {
	orders: Order[];
}

function OrdersList({ orders }: OrdersListProps) {
	const sortedOrders = [...orders].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	return (
		<div className="grid gap-4 p-4 max-w-2xl mx-auto">
			{sortedOrders.map((order) => (
				<div
					key={`${order.date}`}
					className="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow"
				>
					<div className="card-body p-4">
						<div className="flex justify-between items-start">
							<h3 className="card-title text-lg font-bold text-primary">
								{order.restaurant}
							</h3>
							<div className="badge badge-primary">{order.price}</div>
						</div>
						<div className="flex justify-between items-center mt-2">
							<div className="text-base-content/70">
								{order.numOfItems} {order.numOfItems === 1 ? "item" : "items"}
							</div>
							<div className="text-sm text-base-content/60">
								{new Date(order.date).toLocaleDateString("en-US", {
									year: "numeric",
									month: "short",
									day: "numeric",
								})}
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

interface ResultsSummaryProps {
	data: UberEatsData;
}

function ResultsSummary({ data }: ResultsSummaryProps) {
	// Find most visited restaurant
	let mostVisited = { name: "None", visits: 0 };
	let highestSpend = { name: "None", total: 0 };

	for (const [restaurant, info] of Object.entries(data.restaurants)) {
		if (info.visits > mostVisited.visits) {
			mostVisited = { name: restaurant, visits: info.visits };
		}

		if (info.total > highestSpend.total) {
			highestSpend = { name: restaurant, total: info.total };
		}
	}

	return (
		<div className="card bg-base-100 shadow-xl p-6 max-w-2xl mx-auto">
			<div className="space-y-6">
				<div className="stat bg-base-200 rounded-box p-4">
					<div className="stat-title text-base-content/60">Total Spent</div>
					<div className="stat-value text-primary">
						${data.total.toFixed(2)}
					</div>
				</div>

				<div className="stat bg-base-200 rounded-box p-4">
					<div className="stat-title text-base-content/60">Total Orders</div>
					<div className="stat-value text-secondary">{data.orders.length}</div>
				</div>

				<div className="stat bg-base-200 rounded-box p-4">
					<div className="stat-title text-base-content/60">
						Most Visited Restaurant
					</div>
					<div className="stat-value text-accent text-2xl">
						{mostVisited.name}
					</div>
					<div className="stat-desc text-base-content/70 text-lg mt-1">
						{mostVisited.visits} visits
					</div>
				</div>

				<div className="stat bg-base-200 rounded-box p-4">
					<div className="stat-title text-base-content/60">
						Highest Spend Restaurant
					</div>
					<div className="stat-value text-accent text-2xl">
						{highestSpend.name}
					</div>
					<div className="stat-desc text-base-content/70 text-lg mt-1">
						${highestSpend.total.toFixed(2)}
					</div>
				</div>
			</div>
		</div>
	);
}

function App() {
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string>("");
	const [data, setData] = useState<UberEatsData | null>(null);
	const [loadingMessage, setLoadingMessage] = useState<string>("");
	const [activeTab, setActiveTab] = useState<string>("summary");
	const [isOnOrdersPage, setIsOnOrdersPage] = useState<boolean>(false);

	useEffect(() => {
		// Check if we're on the orders page when component mounts
		if (typeof chrome !== "undefined" && chrome.tabs) {
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				const currentUrl = tabs[0]?.url || "";
				setIsOnOrdersPage(currentUrl.includes("ubereats.com/orders"));
			});
		}

		// Listen for messages from background script
		if (typeof chrome !== "undefined" && chrome.runtime) {
			chrome.runtime.onMessage.addListener((message) => {
				if (
					message.action === "enableScrapeButton" ||
					(message.type === "URL_UPDATED" &&
						message.url.includes("ubereats.com/orders"))
				) {
					setIsOnOrdersPage(true);
				}

				if (message.action === "scrapingStatusUpdate") {
					setLoading(true);
					if (message.status === "loading-orders") {
						setLoadingMessage("Loading all orders...");
					} else if (message.status === "analyzing-orders") {
						setLoadingMessage("Analyzing your order history...");
					}
				}

				if (message.action === "scrapingComplete") {
					setLoading(false);
					setData(message.data);
					localStorage.setItem("uberEatsData", JSON.stringify(message.data));
				}
			});
		}

		// Get cached results if available
		const savedData = localStorage.getItem("uberEatsData");
		if (savedData) {
			try {
				setData(JSON.parse(savedData));
			} catch (e) {
				console.error("Error parsing saved data", e);
			}
		}

		// Also try to get latest results from background script
		if (typeof chrome !== "undefined" && chrome.runtime) {
			chrome.runtime.sendMessage({ action: "getResults" }, (response) => {
				if (response) {
					setData(response);
				}
			});
		}
	}, []);

	async function startScraping() {
		try {
			setLoading(true);
			setError("");
			setLoadingMessage("Starting to scrape orders...");

			// Communicate with the background script to start scraping
			if (typeof chrome !== "undefined" && chrome.runtime) {
				chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
					const activeTabId = tabs[0]?.id;
					if (!activeTabId) {
						setError("No active tab found.");
						setLoading(false);
						return;
					}

					// Send a ping message to check if the content script is ready
					chrome.tabs.sendMessage(
						activeTabId,
						{ action: "ping" },
						(response) => {
							if (chrome.runtime.lastError) {
								console.error(
									"Content script not ready:",
									chrome.runtime.lastError.message,
								);
								setError(
									"Content script not ready. Please refresh the page and try again.",
								);
								setLoading(false);
								return;
							}

							// If the content script is ready, proceed with starting the scraping
							if (response?.ready) {
								chrome.runtime.sendMessage({
									action: "initiateScrapingOnActiveTab",
								});
							} else {
								setError(
									"Content script not ready. Please refresh the page and try again.",
								);
								setLoading(false);
							}
						},
					);
				});
			} else {
				// Fallback for non-extension environment (development)
				setError("Chrome extension APIs not available");
				setLoading(false);
			}
		} catch (error) {
			console.error("Error scraping orders:", error);
			setError("An error occurred while scraping");
			setLoading(false);
		}
	}

	function navigateToOrdersPage() {
		if (typeof chrome !== "undefined" && chrome.runtime) {
			chrome.runtime.sendMessage({ action: "navigateToOrdersPage" });
		} else {
			// Fallback for non-extension environments (like development)
			window.open("https://www.ubereats.com/orders", "_blank");
		}
	}

	return (
		<div className="uber-eats-tracker-app">
			<div>
				<h1>Uber Eats Tracker</h1>
			</div>

			<div className="controls">
				<button
					type="button"
					className="primary-button"
					onClick={navigateToOrdersPage}
				>
					Go to Uber Eats Orders
				</button>
				<button
					type="button"
					className="primary-button"
					onClick={startScraping}
					disabled={!isOnOrdersPage || loading}
				>
					{loading ? "Scraping..." : "Scrape Orders"}
				</button>
			</div>

			{loading && <StatusOverlay message={loadingMessage} />}

			{error && <div className="error-message">{error}</div>}

			{data && !loading && !error && (
				<div className="results-container">
					<div className="tabs tabs-border">
						<button
							type="button"
							className={activeTab === "summary" ? "tab active" : "tab"}
							onClick={() => setActiveTab("summary")}
						>
							Summary
						</button>
						<button
							type="button"
							className={activeTab === "restaurants" ? "tab active" : "tab"}
							onClick={() => setActiveTab("restaurants")}
						>
							Restaurants
						</button>
						<button
							type="button"
							className={activeTab === "orders" ? "tab active" : "tab"}
							onClick={() => setActiveTab("orders")}
						>
							Orders
						</button>
					</div>

					<div className="tab-content-container">
						{activeTab === "summary" && <ResultsSummary data={data} />}
						{activeTab === "restaurants" && (
							<RestaurantsList restaurants={data.restaurants} />
						)}
						{activeTab === "orders" && <OrdersList orders={data.orders} />}
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
