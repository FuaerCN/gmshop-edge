"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "#/components/ui/switch";
import { userOperationErrorMessage } from "#/features/users/error-message";
import { setUserEnabledFn } from "#/features/users/server/admin";
import type { AdminUserRecord } from "#/features/users/server/users";
import { ConfirmDialog } from "#/layouts/components/confirm-dialog";
import { m } from "#/paraglide/messages";

export function adminRoleIdsFromForm(value: unknown) {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string") return [value];
	return [];
}

export function UserEnabledSwitch({
	user,
	label = user.email,
	onChanged,
}: {
	user: AdminUserRecord;
	label?: string;
	onChanged: () => void | Promise<void>;
}) {
	const [confirmDisable, setConfirmDisable] = useState(false);
	const setEnabled = useMutation({
		mutationFn: setUserEnabledFn,
		onSuccess: async () => {
			setConfirmDisable(false);
			await onChanged();
		},
		onError: async (error) => {
			setConfirmDisable(false);
			toast.error(userOperationErrorMessage(error));
			await onChanged();
		},
	});

	return (
		<>
			<Switch
				aria-label={m.admin_users_toggleLabel({ email: label })}
				checked={user.enabled}
				disabled={setEnabled.isPending}
				onCheckedChange={(enabled) => {
					if (!enabled) {
						setConfirmDisable(true);
						return;
					}
					setEnabled.mutate({ data: { id: user.id, enabled: true } });
				}}
			/>
			<ConfirmDialog
				open={confirmDisable}
				onOpenChange={setConfirmDisable}
				title={m.admin_users_disable_title()}
				desc={m.admin_users_disable_description({ email: label })}
				confirmText={m.admin_users_disable_title()}
				destructive
				isLoading={setEnabled.isPending}
				handleConfirm={() =>
					setEnabled.mutate({ data: { id: user.id, enabled: false } })
				}
			/>
		</>
	);
}

export function userSchema({
	mode,
	roleOptions,
	accountFields = true,
	emailField = accountFields,
	profileFields = false,
}: {
	mode: "create" | "edit";
	roleOptions: Array<{ label: string; value: string }>;
	accountFields?: boolean;
	emailField?: boolean;
	profileFields?: boolean;
}) {
	return [
		{ name: "name", label: m.admin_users_name(), required: true },
		...(emailField
			? [
					{
						name: "email",
						label: m.common_email(),
						valueType: "email" as const,
						required: true,
					},
				]
			: []),
		...(profileFields
			? [
					{
						name: "note",
						label: m.customers_note(),
						valueType: "textarea" as const,
					},
				]
			: []),
		...(accountFields
			? [
					{
						name: "roles",
						label: m.admin_users_roles(),
						valueType: "checkbox" as const,
						fieldProps: {
							options: roleOptions,
							optionsClassName: "grid gap-x-6 gap-y-3 sm:grid-cols-2",
						},
					},
					{
						name: "password",
						label:
							mode === "create"
								? m.common_password()
								: m.admin_users_newPassword(),
						valueType: "password" as const,
						required: mode === "create",
						initialValue: "",
						extra: mode === "edit" ? m.admin_users_passwordExtra() : undefined,
					},
				]
			: []),
	];
}
