export type IpAddressScope = "public" | "non-public";

export function classifyIpAddress(value: string): IpAddressScope | null {
	const normalized = value.replace(/^\[|\]$/g, "").toLowerCase();
	const ipv4 = parseIpv4(normalized);
	if (ipv4) return isPublicIpv4(ipv4) ? "public" : "non-public";
	const ipv6 = parseIpv6(normalized);
	if (ipv6 === null) return null;
	return isPublicIpv6(ipv6) ? "public" : "non-public";
}

export function isPublicIpAddress(value: string) {
	return classifyIpAddress(value) === "public";
}

function parseIpv4(value: string) {
	const parts = value.split(".");
	if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part)))
		return null;
	const octets = parts.map(Number);
	return octets.some((octet) => octet > 255) ? null : octets;
}

function isPublicIpv4([first = 0, second = 0, third = 0]: number[]) {
	return !(
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 100 && second >= 64 && second <= 127) ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 0) ||
		(first === 192 && second === 168) ||
		(first === 192 && second === 88 && third === 99) ||
		(first === 198 && (second === 18 || second === 19)) ||
		(first === 198 && second === 51 && third === 100) ||
		(first === 203 && second === 0 && third === 113) ||
		first >= 224
	);
}

function parseIpv6(value: string): bigint | null {
	if (!value.includes(":")) return null;
	const embeddedIpv4 = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value)?.[1];
	let normalized = value;
	if (embeddedIpv4) {
		const octets = parseIpv4(embeddedIpv4);
		if (!octets) return null;
		const [a = 0, b = 0, c = 0, d = 0] = octets;
		normalized = `${value.slice(0, -embeddedIpv4.length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}
	const halves = normalized.split("::");
	if (halves.length > 2) return null;
	const left = halves[0]?.split(":").filter(Boolean) ?? [];
	const right = halves[1]?.split(":").filter(Boolean) ?? [];
	const missing = 8 - left.length - right.length;
	if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
	const groups = [...left, ...Array(missing).fill("0"), ...right];
	if (
		groups.length !== 8 ||
		groups.some((part) => !/^[\da-f]{1,4}$/.test(part))
	)
		return null;
	return groups.reduce(
		(result, part) => (result << 16n) | BigInt(`0x${part}`),
		0n,
	);
}

function isPublicIpv6(address: bigint) {
	const isGlobalUnicast = address >> 125n === 1n;
	const isDocumentation = address >> 96n === 0x2001_0db8n;
	return isGlobalUnicast && !isDocumentation;
}
