import { z } from "zod";
import {
	defaultSiteBrand,
	type SiteBrand,
} from "#/features/settings/site-brand";
import { supportedLocales } from "#/lib/locales";
import { recordKvCacheMetric } from "#/server/cache-observability";

const cacheVersion = 1;
const cacheKey = `site-brand:v${cacheVersion}`;
const cacheTtlSeconds = 300;
const pendingLoads = new WeakMap<KVNamespace, Promise<SiteBrand>>();
const cacheGenerations = new WeakMap<KVNamespace, number>();
const brandSchema = z.object({
	name: z.string().min(1).max(80),
	description: z.string().max(240).optional(),
	logoUrl: z.string().max(2_048).refine(isSafeLogoUrl),
	title: z.string().min(1).max(80),
	seoDescription: z.string().max(320).optional(),
	customHtml: z.string().max(100_000),
	defaultLocale: z.enum(supportedLocales),
});
const cacheSchema = z.object({
	version: z.literal(cacheVersion),
	brand: brandSchema,
	fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function loadSiteBrandOrDefault(
	db?: D1Database,
	cache?: KVNamespace,
) {
	if (!db) return defaultSiteBrand;
	try {
		return await loadSiteBrand(db, cache);
	} catch {
		// The install surface must remain available before its tables exist.
		return defaultSiteBrand;
	}
}

export async function loadSiteBrand(
	db: D1Database,
	cache?: KVNamespace,
): Promise<SiteBrand> {
	if (!cache) return querySiteBrand(db);
	const pending = pendingLoads.get(cache);
	if (pending) return pending;
	const generation = cacheGenerations.get(cache) ?? 0;
	const load = (async () => {
		const cached = await readCache(cache);
		if (cached) return cached;
		const brand = await querySiteBrand(db);
		if ((cacheGenerations.get(cache) ?? 0) === generation)
			await writeCache(cache, brand);
		return brand;
	})();
	pendingLoads.set(cache, load);
	try {
		return await load;
	} finally {
		if (pendingLoads.get(cache) === load) pendingLoads.delete(cache);
	}
}

export async function invalidateSiteBrandCache(cache?: KVNamespace) {
	if (!cache) return;
	cacheGenerations.set(cache, (cacheGenerations.get(cache) ?? 0) + 1);
	pendingLoads.delete(cache);
	const startedAt = performance.now();
	try {
		await cache.delete(cacheKey);
		recordKvCacheMetric(
			{ cache: "site_brand", operation: "delete", outcome: "success" },
			startedAt,
		);
	} catch {
		recordKvCacheMetric(
			{ cache: "site_brand", operation: "delete", outcome: "fallback" },
			startedAt,
		);
		// D1 remains authoritative when optional KV is unavailable.
	}
}

async function querySiteBrand(db: D1Database): Promise<SiteBrand> {
	const rows = await db
		.prepare(
			"SELECT key, value FROM system_settings WHERE key IN ('site.name', 'site.description', 'site.seo_title', 'site.seo_description', 'site.custom_html', 'site.logo_url', 'site.default_locale')",
		)
		.all<{ key: string; value: string }>();
	const values = new Map(
		rows.results.map((row) => [row.key, parsePublicSetting(row.value)]),
	);
	const name = values.get("site.name") || defaultSiteBrand.name;
	const description = values.get("site.description");
	const seoDescription = values.get("site.seo_description");
	const brand = brandSchema.safeParse({
		name,
		...(description ? { description } : {}),
		logoUrl: safeLogoUrl(values.get("site.logo_url")),
		title: values.get("site.seo_title") || name,
		...(seoDescription ? { seoDescription } : {}),
		customHtml: values.get("site.custom_html") || "",
		defaultLocale:
			values.get("site.default_locale") || defaultSiteBrand.defaultLocale,
	});
	return brand.success ? brand.data : defaultSiteBrand;
}

async function readCache(cache: KVNamespace) {
	const startedAt = performance.now();
	try {
		const value = await cache.get(cacheKey);
		if (!value) {
			recordKvCacheMetric(
				{ cache: "site_brand", operation: "read", outcome: "miss" },
				startedAt,
			);
			return null;
		}
		const parsed = await parseCache(value);
		recordKvCacheMetric(
			{
				cache: "site_brand",
				operation: "read",
				outcome: parsed ? "hit" : "corrupt",
			},
			startedAt,
		);
		return parsed;
	} catch {
		recordKvCacheMetric(
			{ cache: "site_brand", operation: "read", outcome: "fallback" },
			startedAt,
		);
		return null;
	}
}

async function parseCache(value: string): Promise<SiteBrand | null> {
	try {
		const parsed = cacheSchema.safeParse(JSON.parse(value));
		if (!parsed.success) return null;
		const fingerprint = await siteBrandFingerprint(parsed.data.brand);
		return fingerprint === parsed.data.fingerprint ? parsed.data.brand : null;
	} catch {
		return null;
	}
}

async function writeCache(cache: KVNamespace, brand: SiteBrand) {
	const startedAt = performance.now();
	try {
		const fingerprint = await siteBrandFingerprint(brand);
		await cache.put(
			cacheKey,
			JSON.stringify({ version: cacheVersion, brand, fingerprint }),
			{
				expirationTtl: cacheTtlSeconds,
			},
		);
		recordKvCacheMetric(
			{ cache: "site_brand", operation: "write", outcome: "success" },
			startedAt,
		);
	} catch {
		recordKvCacheMetric(
			{ cache: "site_brand", operation: "write", outcome: "fallback" },
			startedAt,
		);
		// D1 remains authoritative when optional KV is unavailable.
	}
}

async function siteBrandFingerprint(brand: SiteBrand) {
	const bytes = new TextEncoder().encode(JSON.stringify(brand));
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function parsePublicSetting(value: string) {
	try {
		const parsed: unknown = JSON.parse(value);
		return typeof parsed === "string" ? parsed.trim() : "";
	} catch {
		return "";
	}
}

function safeLogoUrl(value?: string) {
	if (/^\/api\/site-logo(?:\?v=\d+)?$/.test(value ?? "")) return value ?? "";
	return safePublicUrl(value) || defaultSiteBrand.logoUrl;
}

function isSafeLogoUrl(value: string) {
	return (
		value === defaultSiteBrand.logoUrl ||
		/^\/api\/site-logo(?:\?v=\d+)?$/.test(value) ||
		isPublicUrl(value)
	);
}

function isPublicUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
}

function safePublicUrl(value?: string) {
	if (!value) return "";
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.toString()
			: "";
	} catch {
		return "";
	}
}
