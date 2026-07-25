import { isIP } from "node:net";
import { DomainError } from "#/lib/domain-error";
import { type SupplierProvider, supplierProtocolVersions } from "../schema";

export type NormalizedSupplierSource = {
	provider: SupplierProvider;
	baseUrl: string;
	normalizedApiOrigin: string;
	protocolVersion: string;
};

export function normalizeSupplierSource(
	provider: SupplierProvider,
	value: string,
): NormalizedSupplierSource {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw invalidSourceUrl();
	}
	if (
		url.protocol !== "https:" ||
		url.username !== "" ||
		url.password !== "" ||
		url.search !== "" ||
		url.hash !== "" ||
		(url.port !== "" && url.port !== "443") ||
		url.pathname !== "/" ||
		isIP(url.hostname) !== 0 ||
		url.hostname.toLowerCase() === "localhost"
	) {
		throw invalidSourceUrl();
	}
	const hostname = url.hostname.toLowerCase();
	const normalizedApiOrigin = `https://${hostname}`;
	return {
		provider,
		baseUrl: normalizedApiOrigin,
		normalizedApiOrigin,
		protocolVersion: supplierProtocolVersions[provider],
	};
}

export function sameSupplierSource(
	left: Pick<
		NormalizedSupplierSource,
		"provider" | "normalizedApiOrigin" | "protocolVersion"
	>,
	right: Pick<
		NormalizedSupplierSource,
		"provider" | "normalizedApiOrigin" | "protocolVersion"
	>,
): boolean {
	return (
		left.provider === right.provider &&
		left.normalizedApiOrigin === right.normalizedApiOrigin &&
		left.protocolVersion === right.protocolVersion
	);
}

function invalidSourceUrl() {
	return new DomainError(
		"invalid_supplier_source_url",
		400,
		"Supplier API URL must be a public HTTPS origin",
	);
}
