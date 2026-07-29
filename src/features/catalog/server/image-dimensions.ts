export function readImageDimensions(
	bytes: Uint8Array,
	contentType: string,
): { width: number; height: number } | null {
	const dimensions =
		contentType === "image/png"
			? readPngDimensions(bytes)
			: contentType === "image/jpeg"
				? readJpegDimensions(bytes)
				: contentType === "image/gif"
					? readGifDimensions(bytes)
					: contentType === "image/webp"
						? readWebpDimensions(bytes)
						: contentType === "image/avif"
							? readAvifDimensions(bytes)
							: null;
	return dimensions && dimensions.width > 0 && dimensions.height > 0
		? dimensions
		: null;
}

function readPngDimensions(bytes: Uint8Array) {
	if (
		bytes.length < 24 ||
		bytes[0] !== 0x89 ||
		bytes[1] !== 0x50 ||
		bytes[2] !== 0x4e ||
		bytes[3] !== 0x47
	)
		return null;
	return { width: uint32(bytes, 16), height: uint32(bytes, 20) };
}

function readGifDimensions(bytes: Uint8Array) {
	if (
		bytes.length < 10 ||
		bytes[0] !== 0x47 ||
		bytes[1] !== 0x49 ||
		bytes[2] !== 0x46
	)
		return null;
	return { width: uint16Le(bytes, 6), height: uint16Le(bytes, 8) };
}

function readJpegDimensions(bytes: Uint8Array) {
	if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
	let offset = 2;
	while (offset + 8 < bytes.length) {
		while (bytes[offset] === 0xff) offset += 1;
		const marker = bytes[offset];
		offset += 1;
		if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
		const length = uint16(bytes, offset);
		if (length < 2 || offset + length > bytes.length) break;
		if (isJpegStartOfFrame(marker) && length >= 7) {
			return {
				width: uint16(bytes, offset + 5),
				height: uint16(bytes, offset + 3),
			};
		}
		offset += length;
	}
	return null;
}

function isJpegStartOfFrame(marker: number) {
	return (
		marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
	);
}

function readWebpDimensions(bytes: Uint8Array) {
	if (
		bytes.length < 30 ||
		ascii(bytes, 0, 4) !== "RIFF" ||
		ascii(bytes, 8, 4) !== "WEBP"
	)
		return null;
	const chunk = ascii(bytes, 12, 4);
	if (chunk === "VP8X") {
		return {
			width: uint24Le(bytes, 24) + 1,
			height: uint24Le(bytes, 27) + 1,
		};
	}
	if (chunk === "VP8 " && ascii(bytes, 23, 3) === "\u009d\u0001*") {
		return {
			width: uint16Le(bytes, 26) & 0x3fff,
			height: uint16Le(bytes, 28) & 0x3fff,
		};
	}
	if (chunk === "VP8L" && bytes[20] === 0x2f) {
		const first = bytes[21] ?? 0;
		const second = bytes[22] ?? 0;
		const third = bytes[23] ?? 0;
		const fourth = bytes[24] ?? 0;
		return {
			width: 1 + first + ((second & 0x3f) << 8),
			height: 1 + (second >> 6) + (third << 2) + ((fourth & 0x0f) << 10),
		};
	}
	return null;
}

function readAvifDimensions(bytes: Uint8Array) {
	for (let offset = 0; offset + 16 <= bytes.length; offset += 1) {
		if (ascii(bytes, offset, 4) !== "ispe") continue;
		return {
			width: uint32(bytes, offset + 8),
			height: uint32(bytes, offset + 12),
		};
	}
	return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
	let value = "";
	for (let index = 0; index < length; index += 1)
		value += String.fromCharCode(bytes[offset + index] ?? 0);
	return value;
}

function uint16(bytes: Uint8Array, offset: number) {
	return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function uint16Le(bytes: Uint8Array, offset: number) {
	return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function uint24Le(bytes: Uint8Array, offset: number) {
	return (
		(bytes[offset] ?? 0) |
		((bytes[offset + 1] ?? 0) << 8) |
		((bytes[offset + 2] ?? 0) << 16)
	);
}

function uint32(bytes: Uint8Array, offset: number) {
	return (
		(bytes[offset] ?? 0) * 0x1_00_00_00 +
		((bytes[offset + 1] ?? 0) << 16) +
		((bytes[offset + 2] ?? 0) << 8) +
		(bytes[offset + 3] ?? 0)
	);
}
