import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull } from "drizzle-orm";

import { account, session, supplierApiKeys } from "#/db/schema";
import { DomainError } from "#/lib/domain-error";
import type { AppDb } from "#/server/db.server";
import { requireMutableNonRootUser } from "./root-protection";

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

export type UserFormInput = {
	id?: string;
	name: string;
	email: string;
	enabled: boolean;
	note?: string | null;
	password?: string;
};

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
				 (id, name, email, email_verified, image, enabled, customer_note,
				  created_at, updated_at)
				 VALUES (?, ?, ?, 1, NULL, ?, ?, ?, ?)
				 ON CONFLICT(email) DO NOTHING`,
			)
			.bind(
				userId,
				input.name.trim(),
				email,
				input.enabled ? 1 : 0,
				input.note?.trim() || null,
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
	} else await requireMutableNonRootUser(db.$client, input.id);

	const email = normalizeEmail(input.email);
	const nextPassword = input.password;
	const now = Date.now();
	const noteAssignment = input.note === undefined ? "" : "customer_note = ?,";
	const noteBindings =
		input.note === undefined ? [] : [input.note?.trim() || null];
	const updated = await db.$client
		.prepare(`UPDATE users SET name = ?, email = ?,
			${noteAssignment}
			${input.enabled ? "enabled = 1, disabled_at = NULL," : ""}
			updated_at = CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
			WHERE id = ? AND NOT EXISTS (
			 SELECT 1 FROM users other WHERE other.email = ? AND other.id <> ?
			) AND NOT EXISTS (
			 SELECT 1 FROM json_each(users.role_ids) assigned
			 JOIN roles root_role ON root_role.id = assigned.value
			 WHERE root_role.name = 'root' AND root_role.enabled = 1
			)`)
		.bind(
			input.name.trim(),
			email,
			...noteBindings,
			now,
			now,
			input.id,
			email,
			input.id,
		)
		.run();
	if ((updated.meta.changes ?? 0) !== 1) {
		const existing = await db.$client
			.prepare("SELECT id FROM users WHERE id = ?")
			.bind(input.id)
			.first<{ id: string }>();
		if (!existing)
			throw new DomainError("user_not_found", 404, "User not found");
		await requireMutableNonRootUser(db.$client, input.id);
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
	if (input.enabled) await requireMutableNonRootUser(db.$client, input.id);
	if (!input.enabled) {
		await disableUserAtomically(db, input.id, input.currentUserId);
	} else {
		const now = Date.now();
		const result = await db.$client
			.prepare(`UPDATE users SET enabled = 1, disabled_at = NULL,
				updated_at = CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
				WHERE id = ? AND NOT EXISTS (
				 SELECT 1 FROM json_each(users.role_ids) assigned
				 JOIN roles root_role ON root_role.id = assigned.value
				 WHERE root_role.name = 'root' AND root_role.enabled = 1
				)`)
			.bind(now, now, input.id)
			.run();
		if ((result.meta.changes ?? 0) !== 1)
			await requireMutableNonRootUser(db.$client, input.id);
	}

	return { id: input.id };
}

export async function resetUserPassword(
	db: AppDb,
	input: { id: string; password: string },
) {
	await requireMutableNonRootUser(db.$client, input.id);
	const now = new Date();
	const password = assertValidPassword(input.password);
	const passwordHash = await hashPassword(password);
	const revokeSupplierKeys = db
		.update(supplierApiKeys)
		.set({ revokedAt: now, updatedAt: now })
		.where(
			and(
				eq(supplierApiKeys.userId, input.id),
				isNull(supplierApiKeys.revokedAt),
			),
		);
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
			revokeSupplierKeys,
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
			revokeSupplierKeys,
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
	await requireMutableNonRootUser(db.$client, input.id);
	const result = await db.$client
		.prepare(`DELETE FROM users WHERE id = ? AND NOT EXISTS (
			  SELECT 1 FROM json_each(users.role_ids) assigned
			  JOIN roles root_role ON root_role.id = assigned.value
			  WHERE root_role.name = 'root' AND root_role.enabled = 1
			 )`)
		.bind(input.id)
		.run();
	if ((result.meta.changes ?? 0) !== 1) {
		const existing = await db.$client
			.prepare("SELECT id FROM users WHERE id = ?")
			.bind(input.id)
			.first<{ id: string }>();
		if (existing) await requireMutableNonRootUser(db.$client, input.id);
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
	await requireMutableNonRootUser(db.$client, userId);
	const now = Date.now();
	const results = await db.$client.batch([
		db.$client
			.prepare(
				`UPDATE users SET enabled = 0, disabled_at = ?, updated_at =
				 CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
					 WHERE id = ? AND enabled = 1 AND NOT EXISTS (
					   SELECT 1 FROM json_each(users.role_ids) assigned
					   JOIN roles root_role ON root_role.id = assigned.value
					   WHERE root_role.name = 'root' AND root_role.enabled = 1
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
	const user = await requireMutableNonRootUser(db.$client, userId);
	if (!user.enabled) return;
	throw new Error("Enabled user was not disabled");
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
