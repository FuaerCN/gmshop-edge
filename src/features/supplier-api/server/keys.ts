import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { z } from "zod";
import { resolveStoreAccount } from "#/features/storefront/server/account";
import { DomainError } from "#/lib/domain-error";
import { encryptSecret } from "#/lib/secrets";
import { getDb } from "#/server/db.server";
import { loadRuntimeConfig } from "#/server/runtime-config";
import { supplierApiKeyCreateSchema, supplierApiKeyIdSchema } from "../schema";
import { supplierApiIsEnabled } from "./auth";

export const listSupplierApiKeysFn = createServerFn({ method: "GET" }).handler(
	async () => {
		type ApiKeyRow = {
			id: string;
			name: string;
			key_id: string;
			last_used_at: number | null;
			revoked_at: number | null;
			created_at: number;
		};
		const request = getRequest();
		const db = getDb(request).$client;
		const account = await resolveStoreAccount(db, request, { required: true });
		const userId = account?.user.id ?? "";
		const [enabled, keys] = await Promise.all([
			supplierApiIsEnabled(db),
			db
				.prepare(
					"SELECT id, name, key_id, last_used_at, revoked_at, created_at FROM supplier_api_keys WHERE user_id = ? ORDER BY created_at DESC, id DESC",
				)
				.bind(userId)
				.all<ApiKeyRow>(),
		]);
		return { enabled, keys: keys.results };
	},
);

export const createSupplierApiKeyFn = createServerFn({ method: "POST" })
	.validator((value: z.input<typeof supplierApiKeyCreateSchema>) =>
		supplierApiKeyCreateSchema.parse(value),
	)
	.handler(async () => {
		const request = getRequest();
		const db = getDb(request).$client;
		const account = await resolveStoreAccount(db, request, { required: true });
		const userId = account?.user.id ?? "";
		if (!(await supplierApiIsEnabled(db)))
			throw new DomainError(
				"supplier_api_not_enabled",
				403,
				"API purchasing is not enabled",
			);
		const runtime = await loadRuntimeConfig(db);
		if (!runtime.commerceSecret)
			throw new DomainError(
				"supplier_api_unavailable",
				503,
				"Supplier API unavailable",
			);
		const apiKey = `gme_${crypto.randomUUID().replaceAll("-", "")}`;
		const apiSecret = Array.from(
			crypto.getRandomValues(new Uint8Array(32)),
			(byte) => byte.toString(16).padStart(2, "0"),
		).join("");
		const now = Date.now();
		await db
			.prepare(
				`INSERT INTO supplier_api_keys (id, user_id, name, key_id, secret_encrypted, secret_revision, allowed_callback_origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
			)
			.bind(
				crypto.randomUUID(),
				userId,
				`API Key · ${apiKey.slice(-8)}`,
				apiKey,
				await encryptSecret(
					apiSecret,
					runtime.commerceSecret,
					"supplier-api-key",
				),
				null,
				now,
				now,
			)
			.run();
		return { apiKey, apiSecret };
	});

export const revokeSupplierApiKeyFn = createServerFn({ method: "POST" })
	.validator((value: z.input<typeof supplierApiKeyIdSchema>) =>
		supplierApiKeyIdSchema.parse(value),
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		const db = getDb(request).$client;
		const account = await resolveStoreAccount(db, request, { required: true });
		await db
			.prepare(
				"UPDATE supplier_api_keys SET revoked_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
			)
			.bind(Date.now(), Date.now(), data.id, account?.user.id ?? "")
			.run();
		return { revoked: true };
	});
