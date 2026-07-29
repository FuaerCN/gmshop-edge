import { invalidateSiteBrandCache } from "#/features/settings/server/site-brand";
import {
	type SiteAssetContentType,
	siteAssetMaxBytes,
} from "#/features/settings/site-assets";
import { DomainError } from "#/lib/domain-error";
import { inspectImage } from "#/lib/image";

export type SiteAssetInput = {
	contentType: SiteAssetContentType;
	base64: string;
};

const siteLogo = {
	key: "branding/site-logo",
	setting: "site.logo_url",
	url: "/api/site-logo",
} as const;

type SiteAssetDependencies = {
	db: D1Database;
	bucket: {
		put(
			key: string,
			value: Uint8Array<ArrayBuffer>,
			options: {
				httpMetadata: { contentType: string; cacheControl: string };
			},
		): Promise<unknown>;
		delete(key: string): Promise<unknown>;
	};
	cache?: KVNamespace;
	userId: string;
	requestId?: string | null;
	ipAddress?: string | null;
};

export async function uploadSiteLogo(
	input: SiteAssetInput,
	dependencies: SiteAssetDependencies,
) {
	const bytes = await validateSiteLogo(input);
	await dependencies.bucket.put(siteLogo.key, bytes, {
		httpMetadata: {
			contentType: input.contentType,
			cacheControl: "public, max-age=3600",
		},
	});
	const value = `${siteLogo.url}?v=${Date.now()}`;
	await saveSiteAssetSetting(value, dependencies);
	return { url: value };
}

export async function removeSiteLogo(dependencies: SiteAssetDependencies) {
	await dependencies.bucket.delete(siteLogo.key);
	await saveSiteAssetSetting("", dependencies);
	return { removed: true as const };
}

export async function validateSiteLogo(input: SiteAssetInput) {
	let bytes: Uint8Array<ArrayBuffer>;
	try {
		bytes = Uint8Array.from(atob(input.base64), (character) =>
			character.charCodeAt(0),
		);
	} catch {
		throw new DomainError(
			"site_asset_invalid",
			400,
			"Site asset is not valid base64",
		);
	}
	if (!bytes.length)
		throw new DomainError("site_asset_invalid", 400, "Site asset is empty");
	if (bytes.length > siteAssetMaxBytes.logo)
		throw new DomainError(
			"site_asset_too_large",
			413,
			"Site asset is too large",
		);

	const image = await inspectImage(bytes.buffer);
	if (!image || image.contentType !== input.contentType)
		throw new DomainError(
			"site_asset_invalid",
			400,
			"Site asset content does not match its image type",
		);
	if (image.width !== image.height)
		throw new DomainError(
			"site_logo_not_square",
			422,
			"Site logo must be square",
		);
	return bytes;
}

async function saveSiteAssetSetting(
	value: string,
	dependencies: SiteAssetDependencies,
) {
	const key = siteLogo.setting;
	const now = Date.now();
	await dependencies.db.batch([
		dependencies.db
			.prepare(`INSERT INTO system_settings
			(key, value, is_secret, updated_by, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
			.bind(key, JSON.stringify(value), dependencies.userId, now, now),
		dependencies.db
			.prepare(`INSERT INTO audit_logs
			(id, actor_user_id, action, target_type, target_id, request_id, ip_address, after, created_at)
			VALUES (?, ?, ?, 'system_setting', ?, ?, ?, ?, ?)`)
			.bind(
				crypto.randomUUID(),
				dependencies.userId,
				value ? "site_asset.uploaded" : "site_asset.removed",
				key,
				dependencies.requestId ?? null,
				dependencies.ipAddress ?? null,
				JSON.stringify({ key, configured: !!value }),
				now,
			),
	]);
	await invalidateSiteBrandCache(dependencies.cache);
}
