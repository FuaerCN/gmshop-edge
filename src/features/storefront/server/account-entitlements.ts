const EXPIRED_ENTITLEMENT_RETENTION_MS = 7 * 86_400_000;

export type AccountEntitlementRow = {
	id: string;
	entitlement_type: string;
	status: string;
	usage_limit: number | null;
	usage_count: number;
	access_limit: number | null;
	access_count: number;
	activated_at: number | null;
	expires_at: number | null;
	product_name: string;
	sellable_item_name: string;
	product_id: string;
	sellable_item_id: string;
	sellable_item_enabled: number | null;
	renewal_mode: string | null;
	product_status: string | null;
	order_number: string;
	created_at: number;
	delivery_count: number;
	download_asset_count: number;
	automation_job_count: number;
	automation_artifact_count: number;
};

export function listVisibleStoreEntitlements(
	db: D1Database,
	userId: string,
	now = Date.now(),
) {
	return db
		.prepare(
			`SELECT ce.id, ce.entitlement_type, ce.status, ce.usage_limit,
			 ce.usage_count, ce.access_limit, ce.access_count, ce.activated_at,
			 ce.expires_at, ce.product_id, ce.sellable_item_id,
			 oi.product_name, oi.sellable_item_name,
			 s.enabled AS sellable_item_enabled, s.renewal_mode,
			 p.status AS product_status,
			 (SELECT COUNT(*) FROM delivery_records delivery
			  JOIN entitlement_grants grant_row
			   ON grant_row.source_order_item_id = delivery.order_item_id
			  WHERE grant_row.entitlement_id = ce.id
			   AND delivery.status = 'delivered') AS delivery_count,
			 (SELECT COUNT(*) FROM order_item_download_assets snapshot
			  JOIN entitlement_grants grant_row
			   ON grant_row.source_order_item_id = snapshot.order_item_id
			  WHERE grant_row.entitlement_id = ce.id) AS download_asset_count,
			 (SELECT COUNT(*) FROM automation_jobs job
			  WHERE job.entitlement_id = ce.id) AS automation_job_count,
			 (SELECT COUNT(*) FROM automation_artifacts artifact
			  JOIN automation_jobs job ON job.id = artifact.automation_job_id
			  WHERE job.entitlement_id = ce.id
			   AND artifact.upload_status = 'ready') AS automation_artifact_count,
			 orders.order_number, ce.created_at
			 FROM customer_entitlements ce
			 JOIN shop_order_items oi ON oi.id = ce.order_item_id
			 JOIN shop_orders orders ON orders.id = oi.order_id
			 LEFT JOIN products p ON p.id = ce.product_id
			 LEFT JOIN product_sellable_items s ON s.id = ce.sellable_item_id
			 WHERE ce.user_id = ? AND ce.status <> 'exhausted'
			  AND (
			   ce.status <> 'expired'
			   OR (ce.expires_at IS NOT NULL AND ce.expires_at >= ?)
			  )
			 ORDER BY ce.created_at DESC, ce.id DESC LIMIT 100`,
		)
		.bind(userId, now - EXPIRED_ENTITLEMENT_RETENTION_MS)
		.all<AccountEntitlementRow>();
}
