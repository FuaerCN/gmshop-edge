import { toast } from "sonner";
import { m } from "#/paraglide/messages";

export function showNotificationError() {
	toast.error(m.notifications_operation_failed());
}
