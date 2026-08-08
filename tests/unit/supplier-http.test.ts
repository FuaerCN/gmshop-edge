import { describe, expect, it, vi } from "vitest";
import { supplierFetchJson } from "#/features/suppliers/providers/http";

describe("supplier HTTP response limits", () => {
	it("parses a bounded JSON response", async () => {
		await expect(
			supplierFetchJson(
				async () => Response.json({ ok: true }),
				"https://supplier.example/api",
				{},
				{ validateDestination: false },
			),
		).resolves.toEqual({ status: 200, body: { ok: true } });
	});

	it("cancels a chunked response once it exceeds the byte limit", async () => {
		const cancel = vi.fn();
		const fetcher: typeof fetch = async () =>
			new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new Uint8Array(700_000));
						controller.enqueue(new Uint8Array(700_000));
					},
					cancel,
				}),
			);
		await expect(
			supplierFetchJson(
				fetcher,
				"https://supplier.example/api",
				{},
				{ validateDestination: false },
			),
		).rejects.toMatchObject({ code: "invalid_supplier_response", status: 502 });
		expect(cancel).toHaveBeenCalledWith("body_too_large");
	});
});
