import { DomainError } from "#/lib/domain-error";
import { isPublicIpAddress } from "#/lib/ip-address";

type DnsResolver = (hostname: string, type: "A" | "AAAA") => Promise<string[]>;

export async function assertPublicSupplierHostname(
	hostname: string,
	resolve: DnsResolver = resolveDnsOverHttps,
) {
	const answers = (
		await Promise.all([resolve(hostname, "A"), resolve(hostname, "AAAA")])
	).flat();
	if (!answers.length || answers.some((answer) => !isPublicIpAddress(answer)))
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
