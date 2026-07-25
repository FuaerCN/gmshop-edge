import { getLocale } from "#/paraglide/runtime";

export function formatDateTime(
	value: Date | string | number,
	locale = getLocale(),
	timeZone?: string,
) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "medium",
		timeZone,
	}).format(date);
}

export function formatDate(
	value: Date | string | number,
	locale = getLocale(),
	timeZone?: string,
) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone,
	}).format(date);
}

export function formatNumber(value: number, locale = getLocale()) {
	return new Intl.NumberFormat(locale).format(value);
}

export function formatBasisPoints(valueBps: number, locale = getLocale()) {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: valueBps % 100 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(valueBps / 10_000);
}

export function formatMinorAmount(
	amountMinor: string | bigint,
	currency: string,
	decimals: number,
	locale: string = getLocale(),
) {
	const amount = BigInt(amountMinor);
	const negative = amount < 0n;
	const absolute = negative ? -amount : amount;
	const divisor = 10n ** BigInt(decimals);
	const integer = absolute / divisor;
	const fraction = (absolute % divisor).toString().padStart(decimals, "0");
	const grouped = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	}).format(integer);
	const signed = `${negative ? "-" : ""}${grouped}`;
	if (decimals === 0) return `${currency.toUpperCase()} ${signed}`;
	const decimal =
		new Intl.NumberFormat(locale)
			.formatToParts(1.1)
			.find((part) => part.type === "decimal")?.value ?? ".";
	return `${currency.toUpperCase()} ${signed}${decimal}${fraction}`;
}

export function formatMinorAmountWithSymbol(
	amountMinor: string | bigint,
	currency: string,
	decimals: number,
	locale: string = getLocale(),
) {
	const normalizedCurrency = currency.toUpperCase();
	const symbol =
		new Intl.NumberFormat(locale, {
			style: "currency",
			currency: normalizedCurrency,
			currencyDisplay: "narrowSymbol",
		})
			.formatToParts(0)
			.find((part) => part.type === "currency")?.value ?? normalizedCurrency;
	const amount = BigInt(amountMinor);
	const negative = amount < 0n;
	const absolute = negative ? -amount : amount;
	const divisor = 10n ** BigInt(decimals);
	const integer = absolute / divisor;
	const fraction = (absolute % divisor).toString().padStart(decimals, "0");
	const grouped = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 0,
	}).format(integer);
	if (decimals === 0) return `${negative ? "-" : ""}${symbol}${grouped}`;
	const decimal =
		new Intl.NumberFormat(locale)
			.formatToParts(1.1)
			.find((part) => part.type === "decimal")?.value ?? ".";
	return `${negative ? "-" : ""}${symbol}${grouped}${decimal}${fraction}`;
}

export function formatBytes(valueBytes: number, locale = getLocale()) {
	const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
	let value = Math.max(0, valueBytes);
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: units[unitIndex],
		unitDisplay: "short",
		maximumFractionDigits: unitIndex === 0 ? 0 : 1,
	}).format(value);
}
