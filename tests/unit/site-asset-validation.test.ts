import { describe, expect, it } from "vitest";
import { validateSiteLogo } from "#/features/settings/server/site-asset";

describe("site asset validation and persistence", () => {
	it("detects the actual type and validates square logo dimensions before R2", async () => {
		await expect(
			validateSiteLogo(encoded("image/png", png(2, 2))),
		).resolves.toMatchObject({
			bytes: expect.any(Uint8Array),
			contentType: "image/png",
		});
		await expect(
			validateSiteLogo(encoded("image/png", png(3, 2))),
		).rejects.toMatchObject({ code: "site_logo_not_square", status: 422 });
		await expect(
			validateSiteLogo(encoded("image/jpeg", png(2, 2))),
		).resolves.toMatchObject({ contentType: "image/png" });
	});

	it("rejects malformed, empty, oversized, and implausibly large images", async () => {
		await expect(
			validateSiteLogo({
				contentType: "image/png",
				base64: "%%%",
			}),
		).rejects.toMatchObject({ code: "site_asset_invalid", status: 400 });
		await expect(
			validateSiteLogo({ contentType: "image/png", base64: "" }),
		).rejects.toMatchObject({ code: "site_asset_invalid", status: 400 });
		await expect(
			validateSiteLogo({
				contentType: "image/png",
				base64: toBase64(new Uint8Array(2 * 1024 * 1024 + 1)),
			}),
		).rejects.toMatchObject({ code: "site_asset_too_large", status: 413 });
		await expect(
			validateSiteLogo(encoded("image/png", png(10_001, 10_001))),
		).rejects.toMatchObject({ code: "site_asset_invalid", status: 400 });
	});

	it("reads dimensions from all accepted image formats", async () => {
		await expect(
			validateSiteLogo(encoded("image/jpeg", jpeg(4, 4))),
		).resolves.toMatchObject({ contentType: "image/jpeg" });
		await expect(
			validateSiteLogo(encoded("image/webp", webp(5, 5))),
		).resolves.toMatchObject({ contentType: "image/webp" });
	});
});

function encoded(
	contentType: "image/png" | "image/jpeg" | "image/webp",
	bytes: Uint8Array,
) {
	return { contentType, base64: toBase64(bytes) };
}

function toBase64(bytes: Uint8Array) {
	let value = "";
	for (const byte of bytes) value += String.fromCharCode(byte);
	return btoa(value);
}

function png(width: number, height: number) {
	const bytes = new Uint8Array(33);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	bytes.set([0x49, 0x48, 0x44, 0x52], 12);
	new DataView(bytes.buffer).setUint32(16, width);
	new DataView(bytes.buffer).setUint32(20, height);
	return bytes;
}

function jpeg(width: number, height: number) {
	const bytes = new Uint8Array(23);
	bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
	new DataView(bytes.buffer).setUint16(7, height);
	new DataView(bytes.buffer).setUint16(9, width);
	bytes.set([0xff, 0xd9], 21);
	return bytes;
}

function webp(width: number, height: number) {
	const bytes = new Uint8Array(30);
	bytes.set(new TextEncoder().encode("RIFF"));
	new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
	bytes.set(new TextEncoder().encode("WEBPVP8X"), 8);
	new DataView(bytes.buffer).setUint32(16, 10, true);
	writeUint24(bytes, 24, width - 1);
	writeUint24(bytes, 27, height - 1);
	return bytes;
}

function writeUint24(bytes: Uint8Array, offset: number, value: number) {
	bytes[offset] = value & 0xff;
	bytes[offset + 1] = (value >> 8) & 0xff;
	bytes[offset + 2] = (value >> 16) & 0xff;
}
