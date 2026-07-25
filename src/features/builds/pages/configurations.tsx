"use client";

import { Info, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ProButton } from "#/components/pro/base/button";
import { Switch as ProSwitch } from "#/components/pro/base/fields/checkbox";
import { Input } from "#/components/pro/base/fields/input";
import { Select as ProSelect } from "#/components/pro/base/fields/select";
import { FormItem, ProArrayField } from "#/components/pro/form";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "#/components/ui/accordion";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import {
	type BuildDefinitionDraft,
	type BuildInputScope,
	type BuildInputType,
	type BuildMethodDraft,
	type BuildProvider,
	type ConfigurationDraft,
	newBuildDefinition,
	newBuildMethod,
} from "#/features/builds/configuration-draft";
import { m } from "#/paraglide/messages";

type Provider = BuildProvider;
type InputType = BuildInputType;
type InputScope = BuildInputScope;
type BuildMethod = BuildMethodDraft;
type BuildDefinition = BuildDefinitionDraft;

export function BuildConfigurationFields({
	draft,
	onChange,
	showEnabled = true,
}: {
	draft: ConfigurationDraft;
	onChange: (draft: ConfigurationDraft) => void;
	showEnabled?: boolean;
}) {
	return (
		<>
			<section className="grid gap-4 border-y py-4 md:grid-cols-2 lg:grid-cols-3">
				<SelectField
					label={m.automation_configs_provider()}
					value={draft.provider}
					options={[
						{ value: "github_actions", label: "GitHub Actions" },
						{ value: "gitlab_ci", label: "GitLab CI" },
					]}
					onChange={(provider) =>
						onChange({
							...draft,
							provider: provider as Provider,
							baseUrl:
								provider === "gitlab_ci" &&
								draft.baseUrl === "https://api.github.com"
									? "https://gitlab.com"
									: provider === "github_actions" &&
											draft.baseUrl === "https://gitlab.com"
										? "https://api.github.com"
										: draft.baseUrl,
						})
					}
				/>
				<TextField
					label={m.automation_configs_base_url()}
					required
					type="url"
					value={draft.baseUrl}
					onChange={(baseUrl) => onChange({ ...draft, baseUrl })}
				/>
				<RepositoryField
					label={m.automation_configs_repository_name()}
					owner={draft.repositoryOwner}
					name={draft.repositoryName}
					onChange={(repositoryOwner, repositoryName) =>
						onChange({ ...draft, repositoryOwner, repositoryName })
					}
				/>
				<TextField
					label={m.automation_configs_branch()}
					required
					value={draft.defaultBranch}
					onChange={(defaultBranch) => onChange({ ...draft, defaultBranch })}
				/>
				<TextField
					label={m.automation_configs_workflow()}
					required
					value={draft.workflowFile}
					onChange={(workflowFile) => onChange({ ...draft, workflowFile })}
				/>
				<TextField
					label={m.automation_configs_token()}
					required={!draft.configured}
					type="password"
					value={draft.credential}
					placeholder={
						draft.configured ? m.common_leave_blank_to_keep() : undefined
					}
					onChange={(credential) => onChange({ ...draft, credential })}
				/>
				{showEnabled ? (
					<ToggleField
						label={m.common_enabled()}
						tooltip={m.automation_configs_enabled_tooltip()}
						checked={draft.enabled}
						onChange={(enabled) => onChange({ ...draft, enabled })}
					/>
				) : null}
			</section>
			<Accordion
				className="border-y"
				defaultValue={["methods", "inputs"]}
				type="multiple"
			>
				<AccordionItem value="methods">
					<AccordionSectionTrigger
						description={m.automation_configs_methods_description()}
						title={m.automation_configs_methods()}
					/>
					<AccordionContent>
						<MethodsEditor
							methods={draft.methods}
							onChange={(methods) => onChange({ ...draft, methods })}
						/>
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="inputs">
					<AccordionSectionTrigger
						description={m.automation_configs_inputs_description()}
						title={m.automation_configs_inputs()}
					/>
					<AccordionContent>
						<DefinitionsEditor
							definitions={draft.definitions}
							onChange={(definitions) => onChange({ ...draft, definitions })}
						/>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</>
	);
}

function AccordionSectionTrigger({
	title,
	description,
}: {
	title: ReactNode;
	description: string;
}) {
	return (
		<AccordionTrigger>
			<span className="flex min-w-0 items-center gap-1.5">
				<span>{title}</span>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground">
								<Info className="size-4" />
							</span>
						</TooltipTrigger>
						<TooltipContent>{description}</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</span>
		</AccordionTrigger>
	);
}

function MethodsEditor({
	methods,
	onChange,
}: {
	methods: BuildMethod[];
	onChange: (methods: BuildMethod[]) => void;
}) {
	const setMethods = (next: BuildMethod[]) =>
		onChange(
			next.map((method, index) => ({
				...method,
				sortOrder: (index + 1) * 100,
			})),
		);
	const update = (index: number, patch: Partial<BuildMethod>) =>
		setMethods(
			methods.map((method, current) =>
				current === index ? { ...method, ...patch } : method,
			),
		);
	return (
		<div>
			<ProArrayField
				addLabel={m.automation_configs_add_method()}
				create={() => newBuildMethod(methods.length)}
				getKey={(method) => method.uiId}
				itemExtra={(method, index) => (
					<ToggleField
						label={m.common_enabled()}
						tooltip={m.automation_configs_method_enabled_tooltip()}
						checked={method.enabled}
						onChange={(enabled) => update(index, { enabled })}
					/>
				)}
				itemLabel={(method, index) =>
					method.name || `${m.automation_configs_methods()} ${index + 1}`
				}
				min={1}
				onChange={setMethods}
				removeLabel={m.common_delete()}
				reorderLabel={m.pro_action_dragToReorder()}
				value={methods}
			>
				{(method, { index }) => (
					<div className="grid gap-3 sm:grid-cols-3">
						<TextField
							label={m.automation_configs_key()}
							required
							value={method.key}
							onChange={(key) => update(index, { key })}
						/>
						<TextField
							label={m.automation_configs_method_name()}
							required
							value={method.name}
							onChange={(name) => update(index, { name })}
						/>
						<TextField
							label={m.automation_configs_runtime()}
							required
							value={method.runtime}
							onChange={(runtime) => update(index, { runtime })}
						/>
						<TextField
							label={m.automation_configs_branch()}
							value={method.branch}
							onChange={(branch) => update(index, { branch })}
						/>
						<TextField
							label={m.automation_configs_command()}
							value={method.command}
							onChange={(command) => update(index, { command })}
						/>
						<SelectField
							label={m.automation_configs_artifact_policy()}
							value={method.artifactPolicy}
							options={[
								{
									value: "none",
									label: m.automation_configs_artifact_policy_none(),
								},
								{
									value: "optional",
									label: m.automation_configs_artifact_policy_optional(),
								},
								{
									value: "required",
									label: m.automation_configs_artifact_policy_required(),
								},
							]}
							onChange={(artifactPolicy) =>
								update(index, {
									artifactPolicy:
										artifactPolicy as BuildMethod["artifactPolicy"],
									outputPattern:
										artifactPolicy === "none"
											? ""
											: method.outputPattern || "dist/*.zip",
								})
							}
						/>
						{method.artifactPolicy !== "none" ? (
							<TextField
								label={m.automation_configs_output_pattern()}
								required
								value={method.outputPattern}
								onChange={(outputPattern) => update(index, { outputPattern })}
							/>
						) : null}
						<TextField
							label={m.access_role_description()}
							value={method.description}
							onChange={(description) => update(index, { description })}
						/>
					</div>
				)}
			</ProArrayField>
		</div>
	);
}

function DefinitionsEditor({
	definitions,
	onChange,
}: {
	definitions: BuildDefinition[];
	onChange: (definitions: BuildDefinition[]) => void;
}) {
	const setDefinitions = (next: BuildDefinition[]) =>
		onChange(
			next.map((definition, index) => ({
				...definition,
				sortOrder: (index + 1) * 100,
			})),
		);
	const update = (index: number, patch: Partial<BuildDefinition>) =>
		setDefinitions(
			definitions.map((definition, current) =>
				current === index ? { ...definition, ...patch } : definition,
			),
		);
	return (
		<div className="space-y-3">
			{definitions.length === 0 ? (
				<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
					{m.automation_configs_no_inputs()}
				</p>
			) : null}
			<ProArrayField
				addLabel={m.automation_configs_add_input()}
				create={() => newBuildDefinition(definitions.length)}
				getKey={(definition) => definition.uiId}
				itemExtra={(definition, index) => (
					<>
						<ToggleField
							label={m.automation_configs_required()}
							tooltip={m.automation_configs_required_tooltip()}
							checked={definition.required}
							onChange={(required) => update(index, { required })}
						/>
						<ToggleField
							label={m.automation_configs_sensitive()}
							tooltip={m.automation_configs_sensitive_tooltip()}
							checked={definition.sensitive}
							onChange={(sensitive) => update(index, { sensitive })}
						/>
					</>
				)}
				itemLabel={(definition, index) =>
					definition.name || `${m.automation_configs_inputs()} ${index + 1}`
				}
				onChange={setDefinitions}
				removeLabel={m.common_delete()}
				reorderLabel={m.pro_action_dragToReorder()}
				value={definitions}
			>
				{(definition, { index }) => {
					const hasOptions =
						definition.inputType === "select" ||
						definition.inputType === "multiselect";
					return (
						<div className="space-y-3">
							<div className="grid gap-3 sm:grid-cols-3">
								<TextField
									label={m.automation_configs_key()}
									required
									value={definition.key}
									onChange={(key) => update(index, { key })}
								/>
								<TextField
									label={m.common_name()}
									required
									value={definition.name}
									onChange={(name) => update(index, { name })}
								/>
								<SelectField
									label={m.automation_configs_input_type()}
									value={definition.inputType}
									options={inputTypeOptions()}
									onChange={(inputType) =>
										update(index, {
											inputType: inputType as InputType,
											options:
												inputType === "select" || inputType === "multiselect"
													? definition.options
													: [],
										})
									}
								/>
								<SelectField
									label={m.automation_configs_input_scope()}
									value={definition.scope}
									options={scopeOptions()}
									onChange={(scope) =>
										update(index, { scope: scope as InputScope })
									}
								/>
								<TextField
									label={m.access_role_description()}
									value={definition.description}
									onChange={(description) => update(index, { description })}
								/>
								<TextField
									label={m.automation_configs_default_value()}
									value={definition.defaultValue}
									onChange={(defaultValue) => update(index, { defaultValue })}
								/>
								<TextField
									label={m.automation_configs_example_value()}
									value={definition.exampleValue}
									onChange={(exampleValue) => update(index, { exampleValue })}
								/>
								<TextField
									label={m.automation_configs_validation_pattern()}
									value={definition.validationPattern}
									onChange={(validationPattern) =>
										update(index, { validationPattern })
									}
								/>
								{definition.inputType === "number" ? (
									<div className="grid grid-cols-2 gap-2">
										<NullableNumberField
											label={m.automation_configs_minimum()}
											value={definition.minimumValue}
											onChange={(minimumValue) =>
												update(index, { minimumValue })
											}
										/>
										<NullableNumberField
											label={m.automation_configs_maximum()}
											value={definition.maximumValue}
											onChange={(maximumValue) =>
												update(index, { maximumValue })
											}
										/>
									</div>
								) : (
									<div />
								)}
							</div>
							{hasOptions ? (
								<OptionsEditor
									options={definition.options}
									onChange={(options) => update(index, { options })}
								/>
							) : null}
						</div>
					);
				}}
			</ProArrayField>
		</div>
	);
}

function OptionsEditor({
	options,
	onChange,
}: {
	options: BuildDefinition["options"];
	onChange: (options: BuildDefinition["options"]) => void;
}) {
	const update = (
		index: number,
		patch: Partial<BuildDefinition["options"][number]>,
	) =>
		onChange(
			options.map((option, current) =>
				current === index ? { ...option, ...patch } : option,
			),
		);
	return (
		<div className="space-y-2 rounded-md border bg-background p-3">
			<div className="flex items-center justify-between">
				<span className="font-medium text-sm">
					{m.automation_configs_options()}
				</span>
				<ProButton
					type="button"
					size="sm"
					variant="ghost"
					onClick={() =>
						onChange([
							...options,
							{ uiId: crypto.randomUUID(), value: "", label: "" },
						])
					}
				>
					<Plus />
					{m.automation_configs_add_option()}
				</ProButton>
			</div>
			{options.map((option, index) => (
				<div className="grid grid-cols-[1fr_1fr_auto] gap-2" key={option.uiId}>
					<Input
						aria-label={m.automation_configs_option_value()}
						placeholder={m.automation_configs_option_value()}
						required
						value={option.value}
						onChange={(event) => update(index, { value: event.target.value })}
					/>
					<Input
						aria-label={m.automation_configs_option_label()}
						placeholder={m.automation_configs_option_label()}
						required
						value={option.label}
						onChange={(event) => update(index, { label: event.target.value })}
					/>
					<ProButton
						aria-label={m.common_delete()}
						type="button"
						size="icon-sm"
						variant="ghost"
						onClick={() =>
							onChange(options.filter((_, current) => current !== index))
						}
					>
						<Trash2 />
					</ProButton>
				</div>
			))}
		</div>
	);
}

function TextField({
	label,
	value,
	onChange,
	required,
	type = "text",
	placeholder,
}: {
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
	type?: string;
	placeholder?: string;
}) {
	return (
		<FormItem label={label} required={required}>
			<Input
				type={type}
				required={required}
				value={value}
				placeholder={placeholder}
				onChange={(event) => onChange(event.target.value)}
			/>
		</FormItem>
	);
}

function RepositoryField({
	label,
	owner,
	name,
	onChange,
}: {
	label: ReactNode;
	owner: string;
	name: string;
	onChange: (owner: string, name: string) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const combined = [owner, name].filter(Boolean).join("/");
	const [value, setValue] = useState(combined);
	useEffect(() => {
		if (document.activeElement !== inputRef.current) setValue(combined);
	}, [combined]);
	return (
		<FormItem label={label} required>
			<Input
				onChange={(event) => {
					const raw = event.target.value;
					setValue(raw);
					const separator = raw.lastIndexOf("/");
					onChange(
						separator < 0 ? "" : raw.slice(0, separator),
						separator < 0 ? raw : raw.slice(separator + 1),
					);
				}}
				placeholder="owner/repository"
				ref={inputRef}
				required
				value={value}
			/>
		</FormItem>
	);
}

function NullableNumberField({
	label,
	value,
	onChange,
}: {
	label: ReactNode;
	value: number | null;
	onChange: (value: number | null) => void;
}) {
	return (
		<FormItem label={label}>
			<Input
				type="number"
				value={value ?? ""}
				onChange={(event) =>
					onChange(
						event.target.value === "" ? null : event.target.valueAsNumber,
					)
				}
			/>
		</FormItem>
	);
}

function SelectField({
	label,
	value,
	options,
	onChange,
}: {
	label: ReactNode;
	value: string;
	options: Array<{ value: string; label: string }>;
	onChange: (value: string) => void;
}) {
	return (
		<FormItem label={label}>
			<ProSelect
				onChange={(next) => {
					if (typeof next === "string") onChange(next);
				}}
				options={options}
				value={value}
			/>
		</FormItem>
	);
}

function ToggleField({
	label,
	checked,
	onChange,
	disabled,
	tooltip,
}: {
	label: ReactNode;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	tooltip?: string;
}) {
	return (
		<div className="flex min-h-9 items-center gap-2">
			<ProSwitch
				aria-label={String(label)}
				disabled={disabled}
				onChange={onChange}
				value={checked}
			/>
			<span className="text-sm">{label}</span>
			{tooltip ? (
				<ProButton
					aria-label={tooltip}
					className="size-6"
					size="icon-sm"
					tooltip={tooltip}
					type="button"
					variant="ghost"
				>
					<Info />
				</ProButton>
			) : null}
		</div>
	);
}

function inputTypeOptions() {
	return [
		{ value: "text", label: m.automation_configs_type_text() },
		{ value: "number", label: m.automation_configs_type_number() },
		{ value: "boolean", label: m.automation_configs_type_boolean() },
		{ value: "select", label: m.automation_configs_type_select() },
		{ value: "multiselect", label: m.automation_configs_type_multiselect() },
	];
}

function scopeOptions() {
	return [
		{
			value: "authorization",
			label: m.automation_configs_scope_authorization(),
		},
		{ value: "automation", label: m.automation_configs_scope_build() },
	];
}
