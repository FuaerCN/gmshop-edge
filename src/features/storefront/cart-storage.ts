import { useSyncExternalStore } from "react";

export type LocalCartItem = { sellableItemId: string; quantity: number };
type LocalCart = { version: 2; items: LocalCartItem[] };

const STORAGE_KEY = "gmshop-cart:v2";
const CHANGE_EVENT = "gmshop-cart-change";
const EMPTY_CART: LocalCart = { version: 2, items: [] };
const serverSnapshot = EMPTY_CART;
let cachedRaw: string | null | undefined;
let cachedCart = EMPTY_CART;

export function readLocalCart(): LocalCart {
	if (typeof window === "undefined") return EMPTY_CART;
	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (raw === cachedRaw) return cachedCart;
	cachedRaw = raw;
	try {
		const parsed = JSON.parse(raw ?? "") as Partial<LocalCart>;
		if (parsed.version !== 2 || !Array.isArray(parsed.items)) return EMPTY_CART;
		cachedCart = {
			version: 2,
			items: parsed.items
				.filter(
					(item): item is LocalCartItem =>
						typeof item?.sellableItemId === "string" &&
						item.sellableItemId.length > 0 &&
						Number.isInteger(item.quantity) &&
						item.quantity > 0,
				)
				.slice(0, 50),
		};
		return cachedCart;
	} catch {
		return EMPTY_CART;
	}
}

export function writeLocalCart(items: LocalCartItem[]) {
	if (typeof window === "undefined") return;
	const value: LocalCart = { version: 2, items: items.slice(0, 50) };
	const raw = JSON.stringify(value);
	window.localStorage.setItem(STORAGE_KEY, raw);
	cachedRaw = raw;
	cachedCart = value;
	window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function addLocalCartItem(
	sellableItemId: string,
	quantity: number,
	maximumQuantity: number,
) {
	const cart = readLocalCart();
	const existing = cart.items.find(
		(item) => item.sellableItemId === sellableItemId,
	);
	if ((existing?.quantity ?? 0) + quantity > maximumQuantity) return false;
	writeLocalCart(
		existing
			? cart.items.map((item) =>
					item.sellableItemId === sellableItemId
						? { ...item, quantity: item.quantity + quantity }
						: item,
				)
			: [...cart.items, { sellableItemId, quantity }],
	);
	return true;
}

export function removeLocalCartItem(sellableItemId: string) {
	writeLocalCart(
		readLocalCart().items.filter(
			(item) => item.sellableItemId !== sellableItemId,
		),
	);
}

export function useLocalCart() {
	return useSyncExternalStore(subscribe, readLocalCart, () => serverSnapshot);
}

function subscribe(listener: () => void) {
	if (typeof window === "undefined") return () => undefined;
	window.addEventListener(CHANGE_EVENT, listener);
	window.addEventListener("storage", listener);
	return () => {
		window.removeEventListener(CHANGE_EVENT, listener);
		window.removeEventListener("storage", listener);
	};
}
