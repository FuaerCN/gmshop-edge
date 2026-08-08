import {
	BodyLimitExceededError,
	readBoundedResponseBytes,
} from "#/lib/bounded-stream";
import { DomainError } from "#/lib/domain-error";
import { assertPublicSupplierHostname } from "../server/destination-security";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export async function supplierFetchJson(
	fetcher: typeof fetch,
	url: string,
	init: RequestInit,
	options: { validateDestination?: boolean } = {},
): Promise<{ status: number; body: unknown }> {
	const destination = new URL(url);
	if (destination.protocol !== "https:" || destination.port)
		throw new DomainError(
			"supplier_destination_rejected",
			400,
			"Supplier destination is not allowed",
		);
	if (options.validateDestination !== false)
		await assertPublicSupplierHostname(destination.hostname);
	let response: Response;
	try {
		response = await fetcher(url, {
			...init,
			redirect: "manual",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch {
		throw new DomainError(
			"supplier_request_uncertain",
			502,
			"Supplier request outcome is uncertain",
		);
	}
	if (response.status >= 300 && response.status < 400) {
		throw new DomainError(
			"supplier_redirect_rejected",
			502,
			"Supplier redirects are not allowed",
		);
	}
	let bytes: Uint8Array;
	try {
		bytes = await readBoundedResponseBytes(response, MAX_RESPONSE_BYTES);
	} catch (error) {
		if (error instanceof BodyLimitExceededError) throw invalidResponse();
		throw error;
	}
	let body: unknown;
	try {
		body = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw invalidResponse();
	}
	return { status: response.status, body };
}

function invalidResponse() {
	return new DomainError(
		"invalid_supplier_response",
		502,
		"Supplier returned an invalid response",
	);
}
