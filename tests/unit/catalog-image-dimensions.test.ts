import { describe, expect, it } from "vitest";
import { readImageDimensions } from "#/features/catalog/server/image-dimensions";

describe("product media dimensions", () => {
	it("reads dimensions without restricting the image aspect ratio", () => {
		const png = new Uint8Array(24);
		png.set([0x89, 0x50, 0x4e, 0x47], 0);
		writeUint32(png, 16, 1_600);
		writeUint32(png, 20, 1_000);
		const dimensions = readImageDimensions(png, "image/png");
		expect(dimensions).toEqual({ width: 1_600, height: 1_000 });
	});

	it("rejects content that does not match its declared image type", () => {
		expect(readImageDimensions(new Uint8Array(32), "image/png")).toBeNull();
	});
});

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
	bytes[offset] = (value >>> 24) & 0xff;
	bytes[offset + 1] = (value >>> 16) & 0xff;
	bytes[offset + 2] = (value >>> 8) & 0xff;
	bytes[offset + 3] = value & 0xff;
}
