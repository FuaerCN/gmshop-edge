import { DomainError } from "#/lib/domain-error";

type DnsResolver = (hostname: string, type: "A" | "AAAA") => Promise<string[]>;

export async function assertPublicSupplierHostname(
	hostname: string,
	resolve: DnsResolver = resolveDnsOverHttps,
) {
	const answers = (
		await Promise.all([resolve(hostname, "A"), resolve(hostname, "AAAA")])
	).flat();
	if (!answers.length || answers.some(isPrivateAddress))
		throw new DomainError(
			"supplier_destination_rejected",
			400,
			"Supplier hostname must resolve only to public addresses",
		);
}

async function resolveDnsOverHttps(hostname: string, type: "A" | "AAAA") {
	const url = new URL("https://cloudflare-dns.com/dns-query");
	url.searchParams.set("name", hostname);
	url.searchParams.set("type", type);
	const response = await fetch(url, {
		headers: { Accept: "application/dns-json" },
		redirect: "error",
		signal: AbortSignal.timeout(5_000),
	});
	if (!response.ok)
		throw new DomainError(
			"supplier_dns_unavailable",
			503,
			"Supplier hostname could not be resolved safely",
		);
	const value = (await response.json()) as {
		Status?: unknown;
		Answer?: Array<{ type?: unknown; data?: unknown }>;
	};
	if (value.Status !== 0 && value.Status !== 3)
		throw new DomainError(
			"supplier_dns_unavailable",
			503,
			"Supplier hostname could not be resolved safely",
		);
	const expected = type === "A" ? 1 : 28;
	return (value.Answer ?? [])
		.filter(
			(answer) => answer.type === expected && typeof answer.data === "string",
		)
		.map((answer) => String(answer.data).toLowerCase());
}

function isPrivateAddress(value: string) {
	if (value.includes(".")) return isPrivateIpv4(value);
	const normalized = value.toLowerCase();
	const firstGroup = Number.parseInt(normalized.split(":")[0] ?? "", 16);
	return (
		!Number.isInteger(firstGroup) ||
		firstGroup < 0x2000 ||
		firstGroup > 0x3fff ||
		normalized.startsWith("2001:db8:") ||
		normalized === "::" ||
		normalized === "::1" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		normalized.startsWith("fe8") ||
		normalized.startsWith("fe9") ||
		normalized.startsWith("fea") ||
		normalized.startsWith("feb") ||
		normalized.startsWith("::ffff:127.") ||
		normalized.startsWith("::ffff:10.") ||
		normalized.startsWith("::ffff:192.168.") ||
		normalized.startsWith("::ffff:169.254.")
	);
}

function isPrivateIpv4(value: string) {
	const parts = value.split(".").map(Number);
	if (
		parts.length !== 4 ||
		parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
	)
		return true;
	const [first = 0, second = 0] = parts;
	return (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 100 && second >= 64 && second <= 127) ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 0) ||
		(first === 192 && second === 0 && parts[2] === 2) ||
		(first === 192 && second === 168) ||
		(first === 192 && second === 88 && parts[2] === 99) ||
		(first === 198 && (second === 18 || second === 19)) ||
		(first === 198 && second === 51 && parts[2] === 100) ||
		(first === 203 && second === 0 && parts[2] === 113) ||
		first >= 224
	);
}
