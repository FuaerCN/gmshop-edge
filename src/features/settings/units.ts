const settingUnits = {
	"orders.default_expiry_ms": "milliseconds",
	"automation.artifact_retention_ms": "milliseconds",
	"queue.retry_base_ms": "milliseconds",
	"retention.audit_ms": "milliseconds",
} as const;

export type SystemSettingUnit =
	(typeof settingUnits)[keyof typeof settingUnits];

export function systemSettingUnit(key: string) {
	return settingUnits[key as keyof typeof settingUnits];
}
