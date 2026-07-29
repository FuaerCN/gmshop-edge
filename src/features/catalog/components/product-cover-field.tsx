"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { Upload, UploadTrigger } from "#/components/pro/base/fields/upload";
import type { ProSchemaFormValue } from "#/components/pro/form";
import { m } from "#/paraglide/messages";

const productCoverContentTypes = [
	"image/avif",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export type ProductCoverUpload = {
	contentType: (typeof productCoverContentTypes)[number];
	base64: string;
};

export function ProductCoverField({
	value,
	onChange,
	currentUrl,
}: {
	value: ProSchemaFormValue;
	onChange: (value: ProSchemaFormValue) => void;
	currentUrl?: string;
}) {
	const upload = useMemo(() => parseProductCoverUpload(value), [value]);
	const previewUrl = upload
		? `data:${upload.contentType};base64,${upload.base64}`
		: currentUrl;

	async function selectFile(file?: File) {
		if (!file) return false;
		if (!isProductCoverContentType(file.type)) {
			toast.error(m.catalog_cover_image_invalid());
			return false;
		}
		if (file.size > 5_000_000) {
			toast.error(m.settings_error_asset_too_large());
			return false;
		}
		const dataUrl = await fileDataUrl(file);
		const dimensions = await readBrowserImageDimensions(dataUrl);
		if (!dimensions) {
			toast.error(m.catalog_cover_image_invalid());
			return false;
		}
		const nextUpload = {
			contentType: file.type,
			base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
		} satisfies ProductCoverUpload;
		onChange(JSON.stringify(nextUpload));
		return dataUrl;
	}

	return (
		<div className="space-y-2">
			<div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-lg border bg-muted">
				<Upload
					accept={productCoverContentTypes.join(",")}
					className="size-full"
					maxCount={1}
					multiple={false}
					upload={async (files) => selectFile(files[0])}
					value={[]}
				>
					{previewUrl ? (
						<img
							alt={m.catalog_gallery_cover()}
							className="size-full object-cover"
							src={previewUrl}
						/>
					) : null}
					<UploadTrigger
						className={
							previewUrl
								? "absolute inset-0 size-full border-0 bg-background/10 text-transparent opacity-0 backdrop-blur-[1px] transition-opacity hover:bg-background/60 hover:text-foreground hover:opacity-100 focus-visible:bg-background/60 focus-visible:text-foreground focus-visible:opacity-100"
								: "absolute inset-0 size-full border-0"
						}
					/>
				</Upload>
			</div>
			<p className="text-xs text-muted-foreground">
				{m.catalog_cover_upload_description()}
			</p>
		</div>
	);
}

export function parseProductCoverUpload(value: unknown) {
	if (typeof value !== "string" || !value.trim()) return null;
	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return null;
		const contentType = Reflect.get(parsed, "contentType");
		const base64 = Reflect.get(parsed, "base64");
		return isProductCoverContentType(contentType) &&
			typeof base64 === "string" &&
			base64.length > 0
			? ({ contentType, base64 } satisfies ProductCoverUpload)
			: null;
	} catch {
		return null;
	}
}

function isProductCoverContentType(
	value: unknown,
): value is ProductCoverUpload["contentType"] {
	return productCoverContentTypes.some((contentType) => contentType === value);
}

function fileDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

export function readBrowserImageDimensions(dataUrl: string) {
	return new Promise<{ width: number; height: number } | null>((resolve) => {
		const image = new Image();
		image.onload = () =>
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = () => resolve(null);
		image.src = dataUrl;
	});
}
