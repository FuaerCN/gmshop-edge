export function formatMinorInput(
	minor: string | null,
	decimals: number,
): string {
	if (minor == null || minor === "") return "";
	const normalized = minor.replace(/^0+(?=\d)/, "");
	if (decimals === 0) return normalized;
	const padded = normalized.padStart(decimals + 1, "0");
	return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`;
}

export function parseMajorInput(
	value: string,
	decimals: number,
): string | null | undefined {
	const normalized = value.trim();
	if (!normalized) return null;
	const pattern =
		decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{0,${decimals}})?$`);
	if (!pattern.test(normalized)) return undefined;
	const [whole = "0", fraction = ""] = normalized.split(".");
	const scale = 10n ** BigInt(decimals);
	return (
		BigInt(whole) * scale +
		BigInt(fraction.padEnd(decimals, "0") || "0")
	).toString();
}
