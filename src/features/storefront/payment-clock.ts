import { useSyncExternalStore } from "react";

const subscribers = new Set<() => void>();
let timer: number | undefined;
let currentNow = 0;

function subscribe(callback: () => void) {
	currentNow = Date.now();
	subscribers.add(callback);
	if (timer === undefined)
		timer = window.setInterval(() => {
			currentNow = Date.now();
			for (const subscriber of subscribers) subscriber();
		}, 1_000);
	return () => {
		subscribers.delete(callback);
		if (subscribers.size === 0 && timer !== undefined) {
			window.clearInterval(timer);
			timer = undefined;
		}
	};
}

export function usePaymentClock() {
	return useSyncExternalStore(
		subscribe,
		() => currentNow,
		() => 0,
	);
}

export function formatPaymentRemaining(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${remainder
		.toString()
		.padStart(2, "0")}`;
}
