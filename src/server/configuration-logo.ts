import { z } from "zod";
import {
	authProviderSettingKeys,
	storedAuthProvidersSchema,
} from "#/features/auth/provider-settings";
import { siteAssetResponse } from "#/features/settings/server/site-asset-response";
import {
	configurationLogoContentTypes,
	configurationLogoMaxBytes,
} from "#/lib/configuration-logo";
import { DomainError } from "#/lib/domain-error";
import { inspectImage } from "#/lib/image";

export const configurationLogoInputSchema = z.object({
	id: z.string().min(1).max(80),
	contentType: z.enum(configurationLogoContentTypes),
	base64: z.string().max(4_000_000),
});

export type ConfigurationLogoInput = z.output<
	typeof configurationLogoInputSchema
>;

export async function putConfigurationLogo(
	bucket: R2Bucket | undefined,
	key: string,
	input: ConfigurationLogoInput,
) {
	if (!bucket)
		throw new DomainError(
			"configuration_logo_storage_unavailable",
			503,
			"Logo storage is unavailable",
		);
	const bytes = await decodeConfigurationLogo(input);
	await bucket.put(key, bytes, {
		httpMetadata: {
			contentType: input.contentType,
			cacheControl: "public, max-age=3600",
		},
	});
}

export async function deleteConfigurationLogo(
	bucket: R2Bucket | undefined,
	key: string,
) {
	if (!bucket)
		throw new DomainError(
			"configuration_logo_storage_unavailable",
			503,
			"Logo storage is unavailable",
		);
	await bucket.delete(key);
}

export function configurationLogoObjectKey(
	scope: "auth" | "payment",
	id: string,
) {
	return `configuration-logos/${scope}/${id}`;
}

export function configurationLogoUrl(
	scope: "auth" | "payment",
	id: string,
	version: number,
) {
	return `/api/configuration-logo/${scope}/${encodeURIComponent(id)}?v=${version}`;
}

export function configurationLogoResponse(
	request: Request,
	bucket: R2Bucket | undefined,
	key: string | null,
) {
	if (!key) return new Response("Not found", { status: 404 });
	return siteAssetResponse(request, bucket, key);
}

export async function resolvePublicConfigurationLogoKey(
	db: D1Database | undefined,
	scope: string,
	id: string,
) {
	if (!db) return null;
	if (scope === "payment") return resolvePaymentLogoKey(db, id);
	if (scope === "auth") return resolveAuthLogoKey(db, id);
	return null;
}

async function resolvePaymentLogoKey(db: D1Database, id: string) {
	if (!z.uuid().safeParse(id).success) return null;
	const channel = await db
		.prepare(
			"SELECT id, logo_object_key FROM payment_channels WHERE id = ? AND enabled = 1 LIMIT 1",
		)
		.bind(id)
		.first<{ id: string; logo_object_key: string | null }>();
	if (!channel?.logo_object_key) return null;
	return configurationLogoObjectKey("payment", channel.id);
}

async function resolveAuthLogoKey(db: D1Database, providerId: string) {
	if (!/^[a-z][a-z0-9_-]{1,63}$/.test(providerId)) return null;
	const row = await db
		.prepare("SELECT value FROM system_settings WHERE key = ? LIMIT 1")
		.bind(authProviderSettingKeys.providers)
		.first<{ value: string }>();
	if (!row) return null;
	const providers = storedAuthProvidersSchema.safeParse(parseJson(row.value));
	if (!providers.success) return null;
	const provider = providers.data.find(
		(entry) => entry.providerId === providerId && entry.enabled,
	);
	if (
		!provider?.icon ||
		!isConfigurationLogoUrl(provider.icon, "auth", providerId)
	)
		return null;
	return configurationLogoObjectKey("auth", provider.id);
}

function isConfigurationLogoUrl(
	value: string,
	scope: "auth" | "payment",
	id: string,
) {
	const [pathname, query, extra] = value.split("?");
	return (
		extra === undefined &&
		pathname === configurationLogoUrl(scope, id, 0).split("?")[0] &&
		/^v=\d+$/.test(query ?? "")
	);
}

function parseJson(value: string) {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return null;
	}
}

async function decodeConfigurationLogo(input: ConfigurationLogoInput) {
	let bytes: Uint8Array<ArrayBuffer>;
	try {
		bytes = Uint8Array.from(atob(input.base64), (character) =>
			character.charCodeAt(0),
		);
	} catch {
		throw invalidLogo();
	}
	if (!bytes.length) throw invalidLogo();
	if (bytes.length > configurationLogoMaxBytes)
		throw new DomainError(
			"configuration_logo_too_large",
			413,
			"Logo must not exceed 2 MiB",
		);
	const image = await inspectImage(bytes.buffer);
	if (
		!image ||
		image.contentType !== input.contentType ||
		image.width !== image.height
	)
		throw invalidLogo();
	return bytes;
}

function invalidLogo() {
	return new DomainError(
		"configuration_logo_invalid",
		422,
		"Logo must be a valid square image",
	);
}
