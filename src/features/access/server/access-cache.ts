import { z } from "zod";
import { mergeRolePermissions } from "#/features/access/permissions";
import { permissionsJsonSchema } from "#/features/access/rbac-json";
import { systemRbacModuleIds } from "#/features/access/system-rbac";
import { recordKvCacheMetric } from "#/server/cache-observability";

const accessCacheVersion = 2;
const accessCacheTtlSeconds = 300;
const accessCachePrefix = `rbac-access:v${accessCacheVersion}`;
const pendingLoads = new WeakMap<
	D1Database,
	Map<string, Promise<EffectiveUserAccess>>
>();

export type AccessSessionUser = {
	id: string;
	name: string;
	email: string;
	enabled: boolean | null | undefined;
	updatedAt: Date | string;
};

export type EffectiveUserAccess = {
	user: AccessSessionUser;
	roles: string[];
	root: boolean;
	permissions: ReadonlyMap<string, number>;
};
type AuthoritativeUserAccess = EffectiveUserAccess & { revision: number };

export class AccessDeniedError extends Error {
	constructor(readonly status: 401 | 403) {
		super(status === 401 ? "Unauthorized" : "Forbidden");
		this.name = "AccessDeniedError";
	}
}

const cachedAccessSchema = z
	.object({
		version: z.literal(accessCacheVersion),
		userId: z.string().min(1),
		revision: z.number().int().nonnegative(),
		roles: z.array(z.string().min(1).max(64)).min(1),
		root: z.boolean(),
		permissions: z.array(
			z.object({
				module: z.enum(systemRbacModuleIds),
				permissionMask: z.number().int().positive(),
			}),
		),
	})
	.refine(({ root, roles }) => root === roles.includes("root"));

type CachedUserAccess = z.infer<typeof cachedAccessSchema>;

export async function loadEffectiveUserAccess(
	db: D1Database,
	kv: KVNamespace | undefined,
	user: AccessSessionUser,
): Promise<EffectiveUserAccess> {
	const authoritative = await loadAuthoritativeAccess(db, user.id);
	const { revision } = authoritative;
	const key = `${accessCachePrefix}:${user.id}:${revision}`;
	const bindingLoads = bindingPendingLoads(db);
	const pending = bindingLoads.get(key);
	if (pending) return await pending;

	const load = (async () => {
		const cached = await readCachedAccess(kv, key, user.id, revision);
		return cached
			? hydrateAccess(authoritative.user, cached)
			: cacheAuthoritativeAccess(kv, key, authoritative);
	})();
	bindingLoads.set(key, load);
	try {
		return await load;
	} finally {
		if (bindingLoads.get(key) === load) bindingLoads.delete(key);
	}
}

function bindingPendingLoads(db: D1Database) {
	const existing = pendingLoads.get(db);
	if (existing) return existing;
	const loads = new Map<string, Promise<EffectiveUserAccess>>();
	pendingLoads.set(db, loads);
	return loads;
}

async function loadAuthoritativeAccess(
	db: D1Database,
	userId: string,
): Promise<AuthoritativeUserAccess> {
	const rows = await db
		.prepare(`SELECT u.name AS user_name, u.email AS user_email,
			 u.enabled AS user_enabled, u.updated_at AS user_updated_at,
			 r.name AS role_name, r.permissions_json
			FROM users u
			LEFT JOIN json_each(u.role_ids) assigned
			LEFT JOIN roles r ON r.id = assigned.value AND r.enabled = 1
			WHERE u.id = ?
			ORDER BY r.name`)
		.bind(userId)
		.all<{
			user_name: string;
			user_email: string;
			user_enabled: number;
			user_updated_at: number;
			role_name: string | null;
			permissions_json: string | null;
		}>();
	const first = rows.results[0];
	if (!first) throw new AccessDeniedError(403);
	if (first.user_enabled !== 1) throw new AccessDeniedError(403);
	const roleRows = rows.results.filter(
		(
			row,
		): row is typeof row & {
			role_name: string;
			permissions_json: string;
		} => row.role_name !== null && row.permissions_json !== null,
	);
	const roleNames = roleRows.map((row) => row.role_name);
	if (roleNames.length === 0) throw new AccessDeniedError(403);
	const root = roleNames.includes("root");
	const permissions = root
		? new Map<string, number>()
		: mergeRolePermissions(
				roleRows.flatMap((row) =>
					Object.entries(parsePermissions(row.permissions_json)).map(
						([module, permissionMask]) => ({ module, permissionMask }),
					),
				),
			);
	const authoritativeUser: AccessSessionUser = {
		id: userId,
		name: first.user_name,
		email: first.user_email,
		enabled: true,
		updatedAt: new Date(first.user_updated_at),
	};
	return {
		user: authoritativeUser,
		revision: first.user_updated_at,
		roles: roleNames,
		root,
		permissions,
	};
}

async function cacheAuthoritativeAccess(
	kv: KVNamespace | undefined,
	key: string,
	access: AuthoritativeUserAccess,
) {
	const snapshot: CachedUserAccess = {
		version: accessCacheVersion,
		userId: access.user.id,
		revision: access.revision,
		roles: access.roles,
		root: access.root,
		permissions: systemRbacModuleIds.flatMap((module) => {
			const permissionMask = access.permissions.get(module);
			return permissionMask ? [{ module, permissionMask }] : [];
		}),
	};
	await writeCachedAccess(kv, key, snapshot);
	return access;
}

export function memoizeRequestAccess(
	cache: WeakMap<Request, Promise<EffectiveUserAccess>>,
	request: Request,
	load: () => Promise<EffectiveUserAccess>,
) {
	const cached = cache.get(request);
	if (cached) return cached;
	const pending = load();
	cache.set(request, pending);
	return pending;
}

async function readCachedAccess(
	kv: KVNamespace | undefined,
	key: string,
	userId: string,
	revision: number,
) {
	if (!kv) return null;
	const startedAt = performance.now();
	try {
		const value = await kv.get(key);
		if (!value) {
			recordKvCacheMetric(
				{ cache: "rbac_access", operation: "read", outcome: "miss" },
				startedAt,
			);
			return null;
		}
		const parsed = parseCachedAccess(value, userId, revision);
		recordKvCacheMetric(
			{
				cache: "rbac_access",
				operation: "read",
				outcome: parsed ? "hit" : "corrupt",
			},
			startedAt,
		);
		return parsed;
	} catch {
		recordKvCacheMetric(
			{ cache: "rbac_access", operation: "read", outcome: "fallback" },
			startedAt,
		);
		return null;
	}
}

async function writeCachedAccess(
	kv: KVNamespace | undefined,
	key: string,
	value: CachedUserAccess,
) {
	if (!kv) return;
	const startedAt = performance.now();
	try {
		await kv.put(key, JSON.stringify(value), {
			expirationTtl: accessCacheTtlSeconds,
		});
		recordKvCacheMetric(
			{ cache: "rbac_access", operation: "write", outcome: "success" },
			startedAt,
		);
	} catch {
		recordKvCacheMetric(
			{ cache: "rbac_access", operation: "write", outcome: "fallback" },
			startedAt,
		);
		// D1 remains authoritative when optional KV is unavailable.
	}
}

function parseCachedAccess(
	value: string,
	userId: string,
	revision: number,
): CachedUserAccess | null {
	try {
		const parsed = cachedAccessSchema.safeParse(JSON.parse(value));
		if (!parsed.success) return null;
		return parsed.data.userId === userId && parsed.data.revision === revision
			? parsed.data
			: null;
	} catch {
		return null;
	}
}

function hydrateAccess(
	user: AccessSessionUser,
	snapshot: CachedUserAccess,
): EffectiveUserAccess {
	return {
		user,
		roles: snapshot.roles,
		root: snapshot.root,
		permissions: mergeRolePermissions(snapshot.permissions),
	};
}

function parsePermissions(value: string) {
	try {
		return permissionsJsonSchema.parse(JSON.parse(value));
	} catch {
		throw new AccessDeniedError(403);
	}
}
