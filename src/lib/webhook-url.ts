const blockedHostnames = new Set([
	"0.0.0.0",
	"localhost",
	"localhost.localdomain",
	"metadata.google.internal",
	"169.254.169.254",
	"[::]",
	"[::1]",
]);

export function isSafeWebhookUrl(value: string) {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" || url.username || url.password) return false;
		const hostname = url.hostname.toLowerCase();
		if (
			blockedHostnames.has(hostname) ||
			hostname.endsWith(".local") ||
			hostname.endsWith(".internal") ||
			hostname.endsWith(".localhost")
		)
			return false;
		return classifyIpAddress(hostname) !== "non-public";
	} catch {
		return false;
	}
}

import { classifyIpAddress } from "./ip-address";
