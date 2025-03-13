// Define types for our data structures
export interface RestaurantInfo {
	visits: number;
	total: number;
}

export interface Order {
	restaurant: string;
	numOfItems: number;
	price: string;
	date: string;
}

export interface UberEatsData {
	total: number;
	restaurants: Record<string, RestaurantInfo>;
	orders: Order[];
	error?: string;
}
