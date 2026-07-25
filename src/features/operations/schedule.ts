export type ScheduledTaskName =
	| "order_expiration"
	| "delivery_publish"
	| "build_publish"
	| "refund_publish"
	| "notification_publish"
	| "exchange_rate_sync"
	| "commerce_maintenance";

export const manualScheduledTaskNames = [
	"order_expiration",
	"delivery_publish",
	"build_publish",
	"refund_publish",
	"notification_publish",
	"exchange_rate_sync",
	"commerce_maintenance",
] as const satisfies ReadonlyArray<ScheduledTaskName>;

export const scheduledTaskCatalog = manualScheduledTaskNames.map((task) => ({
	task,
	manual: true as const,
}));

export function formatScheduleInterval(durationMs: number, locale: string) {
	const seconds = Math.max(0, Math.floor(durationMs / 1_000));
	const units = [
		{ unit: "day", seconds: 86_400 },
		{ unit: "hour", seconds: 3_600 },
		{ unit: "minute", seconds: 60 },
	] as const;
	const interval = units.find(
		(candidate) =>
			seconds >= candidate.seconds && seconds % candidate.seconds === 0,
	);
	const formatted = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: interval?.unit ?? "second",
		unitDisplay: "long",
	}).format(interval ? seconds / interval.seconds : seconds);
	return /^(ja|ko|zh)(-|$)/.test(locale)
		? formatted.replaceAll(/\s/g, "")
		: formatted;
}

export function nextTaskExecutionAt(
	_task: ScheduledTaskName,
	_lastStartedAt: string | null,
	_nowRateIntervals: unknown,
	now = Date.now(),
) {
	return new Date(Math.floor(now / 60_000) * 60_000 + 60_000).toISOString();
}
