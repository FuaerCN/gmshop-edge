import { describe, expect, it, vi } from "vitest";
import {
	BodyLimitExceededError,
	readBoundedRequestBytes,
	readBoundedStream,
} from "#/lib/bounded-stream";

describe("bounded stream reader", () => {
	it("combines chunks at the exact byte limit", async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2]));
				controller.enqueue(new Uint8Array([3, 4]));
				controller.close();
			},
		});
		await expect(readBoundedStream(stream, 4)).resolves.toEqual(
			new Uint8Array([1, 2, 3, 4]),
		);
	});

	it("cancels a chunked stream immediately after it crosses the limit", async () => {
		const cancel = vi.fn();
		let pulls = 0;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulls += 1;
				controller.enqueue(new Uint8Array(3));
			},
			cancel,
		});
		await expect(readBoundedStream(stream, 5)).rejects.toBeInstanceOf(
			BodyLimitExceededError,
		);
		expect(cancel).toHaveBeenCalledWith("body_too_large");
		expect(pulls).toBeLessThanOrEqual(3);
	});

	it("rejects an oversized declared request without reading its stream", async () => {
		const pull = vi.fn();
		const request = new Request("https://example.com/callback", {
			method: "POST",
			headers: { "Content-Length": "6" },
			body: new ReadableStream<Uint8Array>({ pull }),
			duplex: "half",
		} as RequestInit & { duplex: "half" });
		await expect(readBoundedRequestBytes(request, 5)).rejects.toBeInstanceOf(
			BodyLimitExceededError,
		);
		expect(request.bodyUsed).toBe(false);
	});
});
