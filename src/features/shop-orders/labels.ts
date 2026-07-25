import type { ShopOrderStatus } from "#/features/shop-orders/schema";
import { m } from "#/paraglide/messages";

export function shopOrderStatusLabel(status: ShopOrderStatus | string) {
	if (status === "pending_payment")
		return m.shop_order_status_pending_payment();
	if (status === "paid") return m.shop_order_status_paid();
	if (status === "fulfilling") return m.shop_order_status_fulfilling();
	if (status === "completed") return m.shop_order_status_completed();
	if (status === "cancelled") return m.shop_order_status_cancelled();
	if (status === "expired") return m.shop_order_status_expired();
	if (status === "refunding") return m.shop_order_status_refunding();
	if (status === "refunded") return m.shop_order_status_refunded();
	return m.shop_order_status_failed();
}
