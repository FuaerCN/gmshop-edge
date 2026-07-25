export interface HealthComponent {
	key: "database" | "edge_cache" | "commerce_queue" | "object_storage";
	status: "operational" | "degraded" | "unavailable";
	detail:
		| "cloudflare_d1"
		| "cloudflare_kv"
		| "async_delivery"
		| "r2_storage"
		| "binding_missing"
		| "query_failed"
		| "read_failed";
	count?: number;
	latencyMs?: number;
}

export interface HealthReport {
	status: "ok" | "degraded";
	service: "gmshop-edge";
	version: "v1";
	time: string;
	components: HealthComponent[];
}

export const healthSnapshotTtlMs = 10_000;

const livenessBody = JSON.stringify({
	status: "ok",
	service: "gmshop-edge",
	version: "v1",
});
const methodNotAllowedBody = JSON.stringify({ error: "method_not_allowed" });

/**
 * Liveness proves only that this Worker can execute a request. It deliberately
 * avoids bindings so external monitors cannot amplify D1 or KV reads.
 */
export function handleLivenessRequest(request: Request): Response | null {
	const { pathname } = new URL(request.url);
	if (pathname !== "/healthz") return null;
	if (request.method !== "GET" && request.method !== "HEAD")
		return new Response(methodNotAllowedBody, {
			status: 405,
			headers: {
				allow: "GET, HEAD",
				"cache-control": "no-store",
				"content-length": String(methodNotAllowedBody.length),
				"content-type": "application/json; charset=utf-8",
				pragma: "no-cache",
			},
		});

	return new Response(request.method === "HEAD" ? null : livenessBody, {
		headers: {
			"cache-control": "no-store",
			"content-length": String(livenessBody.length),
			"content-type": "application/json; charset=utf-8",
			pragma: "no-cache",
		},
	});
}

const healthSnapshots = new WeakMap<
	object,
	{ expiresAt: number; value: Promise<HealthReport> }
>();

export function getHealthSnapshot(
	env: Partial<Env>,
	now = Date.now(),
): Promise<HealthReport> {
	const cacheKey = env.DB ?? env.CACHE;
	if (!cacheKey) return checkHealth(env);
	const cached = healthSnapshots.get(cacheKey);
	if (cached && cached.expiresAt > now) return cached.value;

	const value = checkHealth(env).catch((error) => {
		if (healthSnapshots.get(cacheKey)?.value === value) {
			healthSnapshots.delete(cacheKey);
		}
		throw error;
	});
	healthSnapshots.set(cacheKey, {
		expiresAt: now + healthSnapshotTtlMs,
		value,
	});
	return value;
}

export async function checkHealth(env: Partial<Env>): Promise<HealthReport> {
	const [database, edgeCache] = await Promise.all([
		checkDatabase(env.DB),
		checkKv(env.CACHE),
	]);
	const components: HealthComponent[] = [
		database,
		edgeCache,
		bindingStatus("commerce_queue", env.COMMERCE_QUEUE, "async_delivery"),
		bindingStatus("object_storage", env.FILES, "r2_storage"),
	];

	return {
		status: components.some((component) => component.status !== "operational")
			? "degraded"
			: "ok",
		service: "gmshop-edge",
		version: "v1",
		time: new Date().toISOString(),
		components,
	};
}

async function checkDatabase(db?: D1Database): Promise<HealthComponent> {
	if (!db)
		return {
			key: "database",
			status: "unavailable",
			detail: "binding_missing",
		};
	const started = Date.now();
	try {
		await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
		return {
			key: "database",
			status: "operational",
			detail: "cloudflare_d1",
			latencyMs: Date.now() - started,
		};
	} catch {
		return {
			key: "database",
			status: "unavailable",
			detail: "query_failed",
			latencyMs: Date.now() - started,
		};
	}
}

async function checkKv(kv?: KVNamespace): Promise<HealthComponent> {
	if (!kv)
		return {
			key: "edge_cache",
			status: "unavailable",
			detail: "binding_missing",
		};
	const started = Date.now();
	try {
		await kv.get("health:probe");
		return {
			key: "edge_cache",
			status: "operational",
			detail: "cloudflare_kv",
			latencyMs: Date.now() - started,
		};
	} catch {
		return {
			key: "edge_cache",
			status: "unavailable",
			detail: "read_failed",
			latencyMs: Date.now() - started,
		};
	}
}

function bindingStatus(
	key: HealthComponent["key"],
	binding: unknown,
	detail: HealthComponent["detail"],
): HealthComponent {
	return {
		key,
		status: binding ? "operational" : "unavailable",
		detail: binding ? detail : "binding_missing",
	};
}
