import type { AfterSaleStatus } from "./schema";

const transitions: Record<AfterSaleStatus, readonly AfterSaleStatus[]> = {
	open: ["processing", "rejected", "closed"],
	processing: ["resolved", "rejected", "closed"],
	resolved: ["closed"],
	rejected: ["closed"],
	closed: [],
};

export function afterSaleNextStatuses(status: AfterSaleStatus) {
	return transitions[status];
}

export function canTransitionAfterSale(
	from: AfterSaleStatus,
	to: AfterSaleStatus,
) {
	return transitions[from].includes(to);
}
