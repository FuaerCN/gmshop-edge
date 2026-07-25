import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

import {
	account,
	auditLogs,
	exchangeRates,
	notificationTemplates,
	roles,
	systemSettings,
	user,
} from "#/db/schema";
import { builtinStorefrontRoles } from "#/features/access/storefront-access";
import {
	authProviderSettingKeys,
	initialStoredAuthProviders,
} from "#/features/auth/provider-settings";
import { defaultFiatExchangeRates } from "#/features/exchange-rates/default-fiat-rates";
import { exchangeRateSyncSettingKeys } from "#/features/exchange-rates/server/sync";
import { initialCommerceSettings } from "#/features/installation/defaults";
import { builtinNotificationTemplateRows } from "#/features/notifications/templates";
import { DomainError } from "#/lib/domain-error";
import type { AppDb } from "#/server/db.server";
import {
	createInitialRuntimeConfig,
	type RuntimeConfig,
	runtimeConfigEntries,
} from "#/server/runtime-config";

export type InstallInput = {
	name: string;
	email: string;
	password: string;
};

export async function isInstalled(db: AppDb) {
	const row = await db.$client
		.prepare(`SELECT COUNT(*) AS value FROM users
			INNER JOIN json_each(users.role_ids) assigned
			INNER JOIN roles ON roles.id = assigned.value
			WHERE roles.name = 'root' AND roles.enabled = 1 AND users.enabled = 1`)
		.first<{ value: number }>();
	return (row?.value ?? 0) > 0;
}

export async function installSystem(
	db: AppDb,
	input: InstallInput,
	runtimeConfig: RuntimeConfig = createInitialRuntimeConfig(),
) {
	if (await isInstalled(db)) {
		throw new DomainError(
			"already_installed",
			409,
			"System has already been installed.",
		);
	}

	const now = new Date();
	const userId = randomUUID();
	const rootRoleId = randomUUID();
	const storefrontRoles = builtinStorefrontRoles.map((role) => ({
		...role,
		id: randomUUID(),
	}));
	const email = normalizeEmail(input.email);
	const name = input.name.trim() || "Root";
	const password = assertPassword(input.password);

	const passwordHash = await hashPassword(password);
	const allowedHosts = runtimeConfig.betterAuthUrl
		? [new URL(runtimeConfig.betterAuthUrl).host.toLowerCase()]
		: [];
	const initialRates = Object.entries(defaultFiatExchangeRates).map(
		([quoteCurrency, rate], index) => ({
			id: `rate-usd-${quoteCurrency.toLowerCase()}`,
			baseCurrency: "USD",
			quoteCurrency,
			rawRate: rate,
			rate,
			source: "exchangerate_host",
			enabled: quoteCurrency === "CNY",
			adjustmentBps: 0,
			sortOrder: (index + 1) * 100,
			observedAt: now,
			expiresAt: null,
			createdAt: now,
			updatedAt: now,
		}),
	);
	await db
		.batch([
			db.insert(roles).values({
				id: rootRoleId,
				name: "root",
				description: "Built-in unrestricted system role",
				builtIn: true,
				enabled: true,
				createdAt: now,
				updatedAt: now,
			}),
			db.insert(roles).values(
				storefrontRoles.map((role) => ({
					...role,
					permissionsJson: {},
					builtIn: true,
					enabled: true,
					createdAt: now,
					updatedAt: now,
				})),
			),
			db.insert(user).values({
				id: userId,
				name,
				email,
				emailVerified: true,
				image: null,
				enabled: true,
				roleIds: [rootRoleId],
				createdAt: now,
				updatedAt: now,
			}),
			db.insert(account).values({
				id: randomUUID(),
				accountId: userId,
				providerId: "credential",
				userId,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			}),
			...runtimeConfigEntries(runtimeConfig).map((entry) =>
				db.insert(systemSettings).values({
					key: entry.key,
					value: entry.value,
					isSecret: entry.isSecret,
					updatedBy: userId,
					createdAt: now,
					updatedAt: now,
				}),
			),
			db.insert(systemSettings).values({
				key: "security.allowed_hosts",
				value: allowedHosts,
				isSecret: false,
				updatedBy: userId,
				createdAt: now,
				updatedAt: now,
			}),
			...initialCommerceSettings.map((entry) =>
				db.insert(systemSettings).values({
					key: entry.key,
					value: entry.value,
					isSecret: false,
					updatedBy: userId,
					createdAt: now,
					updatedAt: now,
				}),
			),
			...Array.from(
				{ length: Math.ceil(initialRates.length / 7) },
				(_, index) =>
					db
						.insert(exchangeRates)
						.values(initialRates.slice(index * 7, index * 7 + 7)),
			),
			db.insert(systemSettings).values([
				{
					key: exchangeRateSyncSettingKeys.config,
					value: {
						provider: "exchangerate_host",
						enabled: false,
						intervalMs: 86_400_000,
						adjustmentBps: 0,
					},
					isSecret: false,
					updatedBy: userId,
					createdAt: now,
					updatedAt: now,
				},
				{
					key: exchangeRateSyncSettingKeys.status,
					value: {
						lastSyncedAt: null,
						lastStatus: "never",
						lastErrorCode: null,
					},
					isSecret: false,
					updatedBy: userId,
					createdAt: now,
					updatedAt: now,
				},
			]),
			...Array.from(
				{
					length: Math.ceil(builtinNotificationTemplateRows.length / 8),
				},
				(_, index) =>
					db.insert(notificationTemplates).values(
						builtinNotificationTemplateRows
							.slice(index * 8, index * 8 + 8)
							.map((template) => ({
								...template,
								enabled: true,
								createdAt: now,
								updatedAt: now,
							})),
					),
			),
			db.insert(systemSettings).values(
				[
					[authProviderSettingKeys.providers, initialStoredAuthProviders],
					[authProviderSettingKeys.revision, 1],
					[authProviderSettingKeys.telegramMiniAppEnabled, false],
				].map(([key, value]) => ({
					key: String(key),
					value,
					isSecret: false,
					updatedBy: userId,
					createdAt: now,
					updatedAt: now,
				})),
			),
			db.insert(auditLogs).values({
				id: randomUUID(),
				actorUserId: userId,
				action: "system.installed",
				targetType: "role",
				targetId: rootRoleId,
				after: { rootEmail: email, role: "root" },
				createdAt: now,
			}),
		])
		.catch(async (error) => {
			// A concurrent installer can pass the initial read before the other D1
			// batch commits. Re-read authoritative state instead of parsing unstable
			// SQLite error text or leaking the failed statement across the boundary.
			if (await isInstalled(db)) {
				throw new DomainError(
					"already_installed",
					409,
					"System has already been installed.",
				);
			}
			throw error;
		});

	return { email, installed: true };
}

function normalizeEmail(value: string) {
	const email = value.trim().toLowerCase();
	if (!email)
		throw new DomainError("email_required", 400, "Email is required.");
	return email;
}

function assertPassword(value: string) {
	if (value.length < 12) {
		throw new DomainError(
			"password_too_short",
			400,
			"Password must be at least 12 characters long.",
		);
	}
	return value;
}
