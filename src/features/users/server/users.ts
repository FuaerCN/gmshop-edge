import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { account, session } from "#/db/schema";
import { DomainError } from "#/lib/domain-error";
import type { AppDb } from "#/server/db.server";

export type AdminUserRecord = {
	id: string;
	name: string;
	email: string;
	enabled: boolean;
	emailVerified: boolean;
	createdAt: string;
	updatedAt: string;
	roles: string[];
};

export type ListUsersInput = {
	pageIndex?: number;
	pageSize?: number;
	search?: string;
};

export type UserFormInput = {
	id?: string;
	name: string;
	email: string;
	enabled: boolean;
	password?: string;
};

type UserListRow = {
	id: string;
	name: string;
	email: string;
	enabled: number;
	email_verified: number;
	created_at: number;
	updated_at: number;
	role_names: string;
};

export async function listUsers(db: AppDb, input: ListUsersInput = {}) {
	const pageIndex = Math.max(0, input.pageIndex ?? 0);
	const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 10));
	const keyword = input.search?.trim() ?? "";
	const administratorBoundary = `(
		json_array_length(u.role_ids) = 0 OR EXISTS (
		 SELECT 1 FROM json_each(u.role_ids) assigned
		 JOIN roles assigned_role ON assigned_role.id = assigned.value
		 WHERE assigned_role.name NOT IN ('customer', 'guest')
		)
	)`;
	const where = keyword
		? `WHERE ${administratorBoundary} AND (u.name LIKE ? OR u.email LIKE ?)`
		: `WHERE ${administratorBoundary}`;
	const pattern = `%${keyword}%`;
	const bindings = keyword ? [pattern, pattern] : [];
	const [countResult, rowsResult] = await db.$client.batch([
		db.$client
			.prepare(`SELECT COUNT(*) AS total FROM users u ${where}`)
			.bind(...bindings),
		db.$client
			.prepare(`WITH page AS (
		 SELECT u.id, u.name, u.email, u.enabled, u.email_verified,
		  u.created_at, u.updated_at, u.role_ids
		 FROM users u ${where}
		 ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?
		)
		SELECT page.*,
		 COALESCE((
		  SELECT json_group_array(role_name) FROM (
		   SELECT r.name AS role_name FROM json_each(page.role_ids) assigned
		   JOIN roles r ON r.id = assigned.value
		   WHERE r.name NOT IN ('customer', 'guest')
		   ORDER BY r.name
		  )
			 ), '[]') AS role_names
		FROM page ORDER BY page.created_at DESC, page.id DESC`)
			.bind(...bindings, pageSize, pageIndex * pageSize),
	]);
	const count = countResult?.results?.[0] as { total: number } | undefined;
	const rows = rowsResult as D1Result<UserListRow>;
	return {
		data: rows.results.map((row) => ({
			id: row.id,
			name: row.name,
			email: row.email,
			enabled: Boolean(row.enabled),
			emailVerified: Boolean(row.email_verified),
			createdAt: new Date(row.created_at).toISOString(),
			updatedAt: new Date(row.updated_at).toISOString(),
			roles: parseRoleNames(row.role_names),
		})),
		total: count?.total ?? 0,
	};
}

function parseRoleNames(value: string) {
	const parsed: unknown = JSON.parse(value);
	if (
		!Array.isArray(parsed) ||
		!parsed.every((role) => typeof role === "string")
	)
		throw new Error("Invalid user role data");
	return parsed;
}

export async function createUser(db: AppDb, input: UserFormInput) {
	const now = new Date();
	const email = normalizeEmail(input.email);
	const password = assertValidPassword(input.password);
	const userId = randomUUID();
	const passwordHash = await hashPassword(password);
	const createdAt = now.getTime();
	const [created] = await db.$client.batch([
		db.$client
			.prepare(
				`INSERT INTO users
				 (id, name, email, email_verified, image, enabled, created_at, updated_at)
				 VALUES (?, ?, ?, 1, NULL, ?, ?, ?)
				 ON CONFLICT(email) DO NOTHING`,
			)
			.bind(
				userId,
				input.name.trim(),
				email,
				input.enabled ? 1 : 0,
				createdAt,
				createdAt,
			),
		db.$client
			.prepare(
				`INSERT INTO accounts
				 (id, account_id, provider_id, user_id, password, created_at, updated_at)
				 SELECT ?, ?, 'credential', ?, ?, ?, ?
				 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`,
			)
			.bind(
				randomUUID(),
				userId,
				userId,
				passwordHash,
				createdAt,
				createdAt,
				userId,
			),
	]);
	if ((created?.meta.changes ?? 0) !== 1)
		throw new DomainError("email_in_use", 409, "Email is already used");

	return { id: userId };
}

export async function updateUser(
	db: AppDb,
	input: UserFormInput & { currentUserId: string },
) {
	if (!input.id)
		throw new DomainError("user_id_required", 400, "Missing user id");
	if (!input.enabled) {
		await disableUserAtomically(db, input.id, input.currentUserId);
	}

	const email = normalizeEmail(input.email);
	const nextPassword = input.password;
	const now = Date.now();
	const updated = await db.$client
		.prepare(`UPDATE users SET name = ?, email = ?,
			${input.enabled ? "enabled = 1, disabled_at = NULL," : ""}
			updated_at = CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
			WHERE id = ? AND NOT EXISTS (
			 SELECT 1 FROM users other WHERE other.email = ? AND other.id <> ?
			)`)
		.bind(input.name.trim(), email, now, now, input.id, email, input.id)
		.run();
	if ((updated.meta.changes ?? 0) !== 1) {
		const existing = await db.$client
			.prepare("SELECT id FROM users WHERE id = ?")
			.bind(input.id)
			.first<{ id: string }>();
		if (!existing)
			throw new DomainError("user_not_found", 404, "User not found");
		throw new DomainError("email_in_use", 409, "Email is already used");
	}

	if (nextPassword !== undefined && nextPassword !== "") {
		await resetUserPassword(db, { id: input.id, password: nextPassword });
	}

	return { id: input.id };
}

export async function setUserEnabled(
	db: AppDb,
	input: { id: string; enabled: boolean; currentUserId: string },
) {
	if (!input.enabled) {
		await disableUserAtomically(db, input.id, input.currentUserId);
	} else {
		const now = Date.now();
		const result = await db.$client
			.prepare(`UPDATE users SET enabled = 1, disabled_at = NULL,
				updated_at = CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
				WHERE id = ?`)
			.bind(now, now, input.id)
			.run();
		if ((result.meta.changes ?? 0) !== 1)
			throw new DomainError("user_not_found", 404, "User not found");
	}

	return { id: input.id };
}

export async function resetUserPassword(
	db: AppDb,
	input: { id: string; password: string },
) {
	const now = new Date();
	const password = assertValidPassword(input.password);
	const passwordHash = await hashPassword(password);
	const [credentialAccount] = await db
		.select()
		.from(account)
		.where(
			and(eq(account.userId, input.id), eq(account.providerId, "credential")),
		)
		.limit(1);

	if (credentialAccount) {
		await db.batch([
			db
				.update(account)
				.set({ password: passwordHash, updatedAt: now })
				.where(eq(account.id, credentialAccount.id)),
			db.delete(session).where(eq(session.userId, input.id)),
		]);
	} else {
		await db.batch([
			db.insert(account).values({
				id: randomUUID(),
				accountId: input.id,
				providerId: "credential",
				userId: input.id,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			}),
			db.delete(session).where(eq(session.userId, input.id)),
		]);
	}
	return { id: input.id };
}

export async function deleteUser(
	db: AppDb,
	input: { id: string; currentUserId: string },
) {
	if (input.id === input.currentUserId) {
		throw new DomainError(
			"cannot_delete_self",
			409,
			"Cannot delete your own account",
		);
	}
	const result = await db.$client
		.prepare(`DELETE FROM users
			WHERE id = ? AND (
			 enabled <> 1 OR NOT EXISTS (
			  SELECT 1 FROM json_each(users.role_ids) assigned
			  JOIN roles root_role ON root_role.id = assigned.value
			  WHERE root_role.name = 'root' AND root_role.enabled = 1
			 ) OR EXISTS (
			  SELECT 1 FROM users other
			  WHERE other.id <> users.id AND other.enabled = 1
			   AND EXISTS (
			    SELECT 1 FROM json_each(other.role_ids) other_assigned
			    JOIN roles other_role ON other_role.id = other_assigned.value
			    WHERE other_role.name = 'root' AND other_role.enabled = 1
			   )
			 )
			)`)
		.bind(input.id)
		.run();
	if ((result.meta.changes ?? 0) !== 1) {
		const existing = await db.$client
			.prepare("SELECT id FROM users WHERE id = ?")
			.bind(input.id)
			.first<{ id: string }>();
		if (existing)
			throw new DomainError(
				"last_root_required",
				409,
				"Cannot delete the last enabled root user",
			);
	}
	return { id: input.id };
}

async function disableUserAtomically(
	db: AppDb,
	userId: string,
	currentUserId: string,
) {
	if (userId === currentUserId)
		throw new DomainError(
			"cannot_disable_self",
			409,
			"Cannot disable your own account",
		);
	const now = Date.now();
	const results = await db.$client.batch([
		db.$client
			.prepare(
				`UPDATE users SET enabled = 0, disabled_at = ?, updated_at =
				 CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
				 WHERE id = ? AND enabled = 1 AND (
				  NOT EXISTS (
				   SELECT 1 FROM json_each(users.role_ids) assigned
				   JOIN roles root_role ON root_role.id = assigned.value
				   WHERE root_role.name = 'root' AND root_role.enabled = 1
				  ) OR EXISTS (
				   SELECT 1 FROM users other
				   WHERE other.id <> users.id AND other.enabled = 1
				    AND EXISTS (
				     SELECT 1 FROM json_each(other.role_ids) other_assigned
				     JOIN roles other_role ON other_role.id = other_assigned.value
				     WHERE other_role.name = 'root' AND other_role.enabled = 1
				    )
				  )
				 )`,
			)
			.bind(now, now, now, userId),
		db.$client
			.prepare(
				`DELETE FROM sessions WHERE user_id = ?
				 AND EXISTS (SELECT 1 FROM users WHERE id = ? AND enabled = 0)`,
			)
			.bind(userId, userId),
	]);
	const result = results[0];
	if (!result) throw new Error("User update did not return a result");
	if ((result.meta.changes ?? 0) === 1) return;
	const row = await db.$client
		.prepare("SELECT enabled FROM users WHERE id = ?")
		.bind(userId)
		.first<{ enabled: number }>();
	if (!row) throw new DomainError("user_not_found", 404, "User not found");
	if (!row.enabled) return;
	throw new DomainError(
		"last_root_required",
		409,
		"Cannot disable the last enabled root user",
	);
}

function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function assertValidPassword(password: string | undefined) {
	if (!password || password.length < 12 || password.trim().length === 0) {
		throw new DomainError(
			"password_too_short",
			400,
			"Password must be at least 12 characters long",
		);
	}

	return password;
}
