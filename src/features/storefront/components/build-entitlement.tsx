"use client";

import {
	Download,
	ExternalLink,
	Hammer,
	History,
	RotateCcw,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox as ProCheckbox } from "#/components/pro/base/fields/checkbox";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import type { getStoreOrderFn } from "#/features/storefront/server/functions";
import { formatBytes, formatDateTime } from "#/lib/format";
import { m } from "#/paraglide/messages";

type OrderData = Awaited<ReturnType<typeof getStoreOrderFn>>;
type AutomationEntitlement = OrderData["automationRuns"][number];
type InputValue = string | boolean | string[];

export function AutomationEntitlementCard({
	automation,
	notificationChannels,
	orderNumber,
	onChanged,
}: {
	automation: AutomationEntitlement;
	notificationChannels: OrderData["automationNotificationChannels"];
	orderNumber: string;
	onChanged: () => void;
}) {
	const [methodId, setMethodId] = useState(automation.methods[0]?.id ?? "");
	const [notificationChannel, setNotificationChannel] = useState<
		"none" | "email"
	>("none");
	const [values, setValues] = useState<Record<string, InputValue>>({});
	const [submitting, setSubmitting] = useState(false);
	const [actingJobId, setActingJobId] = useState("");
	const [automationOpen, setAutomationOpen] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const exhausted =
		automation.usageLimit !== null &&
		automation.usageCount >= automation.usageLimit;
	const methodSelectId = `automation-method-${automation.id}`;
	const notificationSelectId = `automation-notification-${automation.id}`;
	function updateValue(key: string, value: InputValue) {
		setValues((current) => ({ ...current, [key]: value }));
	}
	async function submit() {
		if (!methodId || exhausted || submitting) return;
		setSubmitting(true);
		const authorizationValues: Record<string, InputValue> = {};
		const automationValues: Record<string, InputValue> = {};
		for (const definition of automation.definitions) {
			const value = values[definition.key];
			if (value === undefined || value === "") continue;
			if (definition.scope === "authorization")
				authorizationValues[definition.key] = value;
			else automationValues[definition.key] = value;
		}
		try {
			const response = await fetch(
				`/api/shop/orders/${encodeURIComponent(orderNumber)}/automation`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({
						entitlementId: automation.id,
						methodId,
						idempotencyKey: crypto.randomUUID(),
						notificationChannel,
						authorizationValues,
						automationValues,
					}),
				},
			);
			if (!response.ok) throw new Error("automation_failed");
			setValues({});
			setMethodId(automation.methods[0]?.id ?? "");
			setNotificationChannel("none");
			setAutomationOpen(false);
			toast.success(m.store_automation_created());
			onChanged();
		} catch {
			toast.error(m.store_automation_failed());
		} finally {
			setSubmitting(false);
		}
	}
	async function downloadArtifact(
		automationJobId: string,
		artifact: AutomationEntitlement["jobs"][number]["artifacts"][number],
	) {
		const response = await fetch(
			`/api/shop/orders/${encodeURIComponent(orderNumber)}/automation/${encodeURIComponent(automationJobId)}/artifacts/${encodeURIComponent(artifact.id)}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
				credentials: "same-origin",
			},
		);
		if (!response.ok) return toast.error(m.store_download_failed());
		const url = URL.createObjectURL(await response.blob());
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = artifact.fileName;
		anchor.click();
		URL.revokeObjectURL(url);
	}
	async function runJobAction(jobId: string, action: "cancel" | "retry") {
		if (actingJobId) return;
		setActingJobId(jobId);
		try {
			const response = await fetch(
				`/api/shop/orders/${encodeURIComponent(orderNumber)}/automation/${encodeURIComponent(jobId)}/${action}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
					credentials: "same-origin",
				},
			);
			if (!response.ok) throw new Error("build_action_failed");
			toast.success(
				action === "retry"
					? m.store_automation_retry_queued()
					: m.store_automation_cancelled(),
			);
			onChanged();
		} catch {
			toast.error(m.store_automation_action_failed());
		} finally {
			setActingJobId("");
		}
	}
	return (
		<div className="flex flex-wrap gap-2">
			{!exhausted && automation.status === "active" ? (
				<Dialog open={automationOpen} onOpenChange={setAutomationOpen}>
					<DialogTrigger asChild>
						<Button size="sm">
							<Hammer />
							{m.store_automation_now()}
						</Button>
					</DialogTrigger>
					<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
						<DialogHeader>
							<DialogTitle>{m.store_automation_now()}</DialogTitle>
							<DialogDescription>
								{automation.productName} · {automation.sellableItemName}
							</DialogDescription>
						</DialogHeader>
						<form
							className="grid gap-4 py-2"
							onSubmit={(event) => {
								event.preventDefault();
								void submit();
							}}
						>
							<div className="grid gap-2">
								<Label htmlFor={methodSelectId}>
									{m.store_automation_method()}
								</Label>
								<Select value={methodId} onValueChange={setMethodId}>
									<SelectTrigger className="w-full" id={methodSelectId}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{automation.methods.map((method) => (
											<SelectItem key={method.id} value={method.id}>
												{automationMethodLabel(method.name, method.key)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor={notificationSelectId}>
									{m.store_automation_notification()}
								</Label>
								<Select
									value={notificationChannel}
									onValueChange={(value) =>
										setNotificationChannel(value as "none" | "email")
									}
								>
									<SelectTrigger className="w-full" id={notificationSelectId}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">
											{m.store_automation_notification_none()}
										</SelectItem>
										<SelectItem
											disabled={!notificationChannels.email}
											value="email"
										>
											{m.store_automation_notification_email()}
											{notificationChannels.email
												? ""
												: ` · ${m.store_automation_notification_unavailable()}`}
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								{automation.definitions.map((definition) => (
									<AutomationField
										key={definition.key}
										definition={definition}
										value={values[definition.key]}
										onChange={(value) => updateValue(definition.key, value)}
									/>
								))}
							</div>
							<DialogFooter showCloseButton>
								<Button disabled={!methodId || submitting} type="submit">
									<Hammer />
									{submitting
										? m.store_automation_submitting()
										: m.store_automation_now()}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			) : null}
			<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
				<DialogTrigger asChild>
					<Button size="sm" variant="outline">
						<History />
						{m.store_automation_history()}
					</Button>
				</DialogTrigger>
				<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<History className="size-4" />
							{m.store_automation_history()}
						</DialogTitle>
						<DialogDescription>
							{automation.productName} · {automation.sellableItemName}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-3">
						{automation.jobs.length ? (
							automation.jobs.map((job) => {
								const methodName =
									automation.methods.find(
										(method) => method.key === job.methodKey,
									)?.name ?? "";
								const cancellable = [
									"queued",
									"dispatching",
									"running",
								].includes(job.status);
								const retryable = ["failed", "cancelled", "expired"].includes(
									job.status,
								);
								return (
									<div
										className="grid gap-4 rounded-2xl bg-muted/30 p-4"
										key={job.id}
									>
										<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
											<div className="min-w-0">
												<p className="font-medium">
													{automationMethodLabel(methodName, job.methodKey)}
												</p>
												<p className="mt-1 text-muted-foreground text-xs">
													{formatDateTime(job.createdAt)}
												</p>
												<p className="mt-1 truncate font-mono text-muted-foreground text-xs">
													{job.id}
												</p>
											</div>
											<div className="flex items-center justify-between gap-3 sm:min-w-60 sm:flex-col sm:items-end sm:justify-between">
												<Badge
													className={buildStatusBadgeClass(job.status)}
													variant="outline"
												>
													{buildStatusLabel(job.status)}
												</Badge>
												<div className="flex flex-wrap justify-end gap-2">
													{job.runUrl ? (
														<Button asChild size="sm" variant="outline">
															<a
																href={job.runUrl}
																rel="noreferrer"
																target="_blank"
															>
																<ExternalLink />
																{m.automation_center_open_run()}
															</a>
														</Button>
													) : null}
													{retryable ? (
														<Button
															disabled={Boolean(actingJobId)}
															onClick={() => void runJobAction(job.id, "retry")}
															size="sm"
														>
															<RotateCcw />
															{m.store_automation_retry()}
														</Button>
													) : null}
													{cancellable ? (
														<Button
															disabled={Boolean(actingJobId)}
															onClick={() =>
																void runJobAction(job.id, "cancel")
															}
															size="sm"
															variant="destructive"
														>
															<X />
															{m.store_automation_cancel()}
														</Button>
													) : null}
												</div>
											</div>
										</div>
										{job.artifacts.map((artifact) => (
											<div
												className="flex items-center justify-between gap-3 border-border/60 border-t pt-3 text-sm"
												key={artifact.id}
											>
												<div className="min-w-0">
													<p className="truncate font-medium">
														{artifact.fileName}
													</p>
													<p className="mt-1 text-muted-foreground text-xs">
														{formatBytes(artifact.sizeBytes)}
													</p>
												</div>
												<Button
													onClick={() =>
														void downloadArtifact(job.id, artifact)
													}
													size="sm"
												>
													<Download />
													{m.store_download()}
												</Button>
											</div>
										))}
									</div>
								);
							})
						) : (
							<p className="py-6 text-center text-muted-foreground text-sm">
								{m.store_automation_empty()}
							</p>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function buildStatusLabel(status: string) {
	switch (status) {
		case "queued":
			return m.status_queued();
		case "dispatching":
			return m.status_dispatching();
		case "running":
			return m.status_running();
		case "succeeded":
			return m.status_succeeded();
		case "failed":
			return m.status_failed();
		case "cancelled":
			return m.status_cancelled();
		case "expired":
			return m.status_expired();
		default:
			return status;
	}
}

function automationMethodLabel(name: string, key: string) {
	const normalizedName = name.trim();
	if (
		normalizedName &&
		!["run", "default", "standard"].includes(normalizedName.toLowerCase())
	) {
		return normalizedName;
	}
	if (["run", "default", "standard"].includes(key.toLowerCase())) {
		return m.store_automation_default_method();
	}
	return normalizedName || m.store_automation_default_method();
}

function buildStatusBadgeClass(status: string) {
	if (status === "succeeded") {
		return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
	}
	if (status === "failed") {
		return "border-destructive/20 bg-destructive/10 text-destructive-foreground";
	}
	if (["queued", "dispatching", "running"].includes(status)) {
		return "border-primary/20 bg-primary/10 text-primary";
	}
	return "border-border bg-background text-muted-foreground";
}

function AutomationField({
	definition,
	value,
	onChange,
}: {
	definition: AutomationEntitlement["definitions"][number];
	value: InputValue | undefined;
	onChange: (value: InputValue) => void;
}) {
	const id = `automation-input-${definition.key}`;
	return (
		<div className="grid content-start gap-2">
			<Label htmlFor={id}>
				{definition.name}
				{definition.required ? " *" : ""}
			</Label>
			{definition.inputType === "boolean" ? (
				<Switch id={id} checked={value === true} onCheckedChange={onChange} />
			) : definition.inputType === "select" ? (
				<Select
					value={typeof value === "string" ? value : ""}
					onValueChange={onChange}
				>
					<SelectTrigger id={id} className="w-full">
						<SelectValue placeholder={definition.defaultValue ?? undefined} />
					</SelectTrigger>
					<SelectContent>
						{definition.options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : definition.inputType === "multiselect" ? (
				<ProCheckbox
					id={id}
					options={definition.options}
					optionsClassName="grid gap-3 sm:grid-cols-2"
					value={Array.isArray(value) ? value : []}
					onChange={onChange}
				/>
			) : (
				<Input
					id={id}
					type={
						definition.sensitive
							? "password"
							: definition.inputType === "number"
								? "number"
								: "text"
					}
					autoComplete={definition.sensitive ? "off" : undefined}
					placeholder={
						definition.maskedValue ??
						definition.exampleValue ??
						definition.defaultValue ??
						undefined
					}
					value={typeof value === "string" ? value : ""}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
			{definition.description ? (
				<p className="text-muted-foreground text-xs">
					{definition.description}
				</p>
			) : null}
		</div>
	);
}
