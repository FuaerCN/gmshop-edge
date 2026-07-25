import { m } from "#/paraglide/messages";

export function entitlementTypeLabel(type: string) {
	if (type === "stock") return m.entitlement_type_card();
	if (type === "download") return m.entitlement_type_download();
	return m.entitlement_type_build();
}

export function entitlementStatusLabel(status: string) {
	if (status === "pending") return m.entitlement_status_pending();
	if (status === "active") return m.entitlement_status_active();
	if (status === "expired") return m.entitlement_status_expired();
	if (status === "exhausted") return m.entitlement_status_exhausted();
	return m.entitlement_status_revoked();
}
