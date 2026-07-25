import { publishPendingBuilds } from "#/features/builds/server/outbox";
import { syncConfiguredExchangeRates } from "#/features/exchange-rates/server/sync";
import { publishPendingDeliveries } from "#/features/fulfillment/server/outbox";
import { publishPendingNotifications } from "#/features/notifications/server/delivery";
import { fanOutPendingCommerceNotifications } from "#/features/notifications/server/fanout";
import { manualScheduledTaskNames } from "#/features/operations/schedule";
import { runTrackedTask } from "#/features/operations/server/task-runs";
import { expireStoreOrders } from "#/features/shop-orders/server/expiration";
import { publishPendingRefunds } from "#/features/shop-payments/server/refunds";
import { DomainError } from "#/lib/domain-error";
import { redactAuditValue } from "#/server/audit-redaction";
import { loadRuntimeConfig } from "#/server/runtime-config";
import { runMaintenance } from "#/server/scheduled/maintenance";

export const operationsTasks = manualScheduledTaskNames;
export type OperationsTask = (typeof operationsTasks)[number];
export type OperationsTaskRunResult = {
	task: OperationsTask;
	result: Record<string, number>;
	completedAt: string;
};

type RunOperationsTaskInput = {
	task: OperationsTask;
	actorUserId: string;
	requestId?: string | null;
	ipAddress?: string | null;
	now?: number;
};

export async function runOperationsTask(
	env: Env,
	input: RunOperationsTaskInput,
): Promise<OperationsTaskRunResult> {
	return runTrackedTask(
		env.DB,
		{
			task: input.task,
			trigger: "manual",
			...(input.now === undefined ? {} : { now: input.now }),
		},
		() => runOperationsTaskCore(env, input),
	);
}

async function runOperationsTaskCore(
	env: Env,
	input: RunOperationsTaskInput,
): Promise<OperationsTaskRunResult> {
	const now = input.now ?? Date.now();
	let result: Record<string, number>;
	try {
		switch (input.task) {
			case "order_expiration": {
				result = await expireStoreOrders(env.DB, now);
				break;
			}
			case "delivery_publish": {
				result = await publishPendingDeliveries(env.DB, env.COMMERCE_QUEUE);
				break;
			}
			case "build_publish": {
				result = await publishPendingBuilds(env.DB, env.COMMERCE_QUEUE);
				break;
			}
			case "refund_publish": {
				result = await publishPendingRefunds(env.DB, env.COMMERCE_QUEUE);
				break;
			}
			case "notification_publish": {
				const fanout = await fanOutPendingCommerceNotifications(env.DB);
				const published = await publishPendingNotifications(
					env.DB,
					env.COMMERCE_QUEUE,
				);
				result = { ...fanout, ...published };
				break;
			}
			case "exchange_rate_sync": {
				const runtime = await loadRuntimeConfig(env.DB);
				result = await syncConfiguredExchangeRates(
					env.DB,
					runtime.dataEncryptionSecret,
					fetch,
					now,
				);
				break;
			}
			case "commerce_maintenance": {
				result = await runMaintenance(env, "manual", undefined, now);
				break;
			}
		}
	} catch (error) {
		await recordTaskAudit(
			env.DB,
			input,
			"operations.task_failed",
			{
				code: operationsErrorCode(error),
			},
			now,
		);
		throw error;
	}
	await recordTaskAudit(
		env.DB,
		input,
		"operations.task_run",
		redactAuditValue(result),
		now,
	);
	return { task: input.task, result, completedAt: new Date(now).toISOString() };
}

async function recordTaskAudit(
	db: D1Database,
	input: RunOperationsTaskInput,
	action: string,
	after: unknown,
	now: number,
) {
	await db
		.prepare(
			`INSERT INTO audit_logs
			 (id, actor_user_id, action, target_type, target_id, request_id,
			  ip_address, after, created_at)
			 VALUES (?, ?, ?, 'operations_task', ?, ?, ?, ?, ?)`,
		)
		.bind(
			crypto.randomUUID(),
			input.actorUserId,
			action,
			input.task,
			input.requestId ?? null,
			input.ipAddress ?? null,
			JSON.stringify(after),
			now,
		)
		.run();
}

function operationsErrorCode(error: unknown) {
	return error instanceof DomainError ? error.code : "task_error";
}
