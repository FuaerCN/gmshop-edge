import { DomainError } from "#/lib/domain-error";

export const storefrontCustomerRoleName = "customer";
export const storefrontGuestRoleName = "guest";
export const storefrontRoleNames = [
	storefrontCustomerRoleName,
	storefrontGuestRoleName,
] as const;
export type StorefrontRole = (typeof storefrontRoleNames)[number];

export const builtinStorefrontRoles = [
	{
		name: "customer",
		description: "Built-in authenticated storefront customer role",
	},
] as const;

export const storefrontPermissions = [
	"catalog.read",
	"checkout.create",
	"order.lookup",
	"payment.retry",
	"account.read",
	"account.update",
	"cart.manage",
	"library.read",
] as const;
export type StorefrontPermission = (typeof storefrontPermissions)[number];

const guestPermissions: ReadonlySet<StorefrontPermission> = new Set([
	"catalog.read",
	"checkout.create",
	"order.lookup",
	"payment.retry",
]);
const customerPermissions: ReadonlySet<StorefrontPermission> = new Set([
	...guestPermissions,
	"account.read",
	"account.update",
	"cart.manage",
	"library.read",
]);

export function hasStorefrontPermission(
	role: StorefrontRole,
	permission: StorefrontPermission,
) {
	return (role === "customer" ? customerPermissions : guestPermissions).has(
		permission,
	);
}

export function requireStorefrontPermission(
	role: StorefrontRole,
	permission: StorefrontPermission,
) {
	if (!hasStorefrontPermission(role, permission))
		throw new DomainError(
			"storefront_access_denied",
			403,
			"Storefront access is denied",
		);
}
