import { storeOrderLookupSchema } from "#/features/storefront/schema";

const storagePrefix = "gmshop-order-access:v1:";

export function readGuestOrderEmail(orderNumber: string) {
	if (typeof window === "undefined") return "";
	const normalizedOrderNumber =
		storeOrderLookupSchema.shape.orderNumber.safeParse(orderNumber);
	if (!normalizedOrderNumber.success) return "";
	try {
		const stored = JSON.parse(
			window.sessionStorage.getItem(
				`${storagePrefix}${normalizedOrderNumber.data}`,
			) ?? "",
		) as { version?: unknown; orderNumber?: unknown; email?: unknown };
		if (stored.version !== 1) return "";
		const access = storeOrderLookupSchema.safeParse(stored);
		return access.success &&
			access.data.orderNumber === normalizedOrderNumber.data
			? access.data.email
			: "";
	} catch {
		return "";
	}
}

export function writeGuestOrderEmail(orderNumber: string, email: string) {
	if (typeof window === "undefined") return "";
	const access = storeOrderLookupSchema.safeParse({ orderNumber, email });
	if (!access.success) return "";
	try {
		window.sessionStorage.setItem(
			`${storagePrefix}${access.data.orderNumber}`,
			JSON.stringify({
				version: 1,
				orderNumber: access.data.orderNumber,
				email: access.data.email,
			}),
		);
		return access.data.email;
	} catch {
		return "";
	}
}
