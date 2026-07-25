import { m } from "#/paraglide/messages";

export type BuildProvider = "github_actions" | "gitlab_ci";
export type BuildInputType =
	| "text"
	| "number"
	| "boolean"
	| "select"
	| "multiselect";
export type BuildInputScope = "authorization" | "automation";

export type BuildMethodDraft = {
	uiId: string;
	key: string;
	name: string;
	description: string;
	runtime: string;
	branch: string;
	command: string;
	artifactPolicy: "none" | "optional" | "required";
	outputPattern: string;
	sortOrder: number;
	enabled: boolean;
};

export type BuildDefinitionDraft = {
	uiId: string;
	key: string;
	name: string;
	description: string;
	inputType: BuildInputType;
	scope: BuildInputScope;
	required: boolean;
	sensitive: boolean;
	validationPattern: string;
	minimumValue: number | null;
	maximumValue: number | null;
	defaultValue: string;
	exampleValue: string;
	sortOrder: number;
	options: Array<{ uiId: string; value: string; label: string }>;
};

export type ConfigurationDraft = {
	id?: string;
	provider: BuildProvider;
	baseUrl: string;
	repositoryOwner: string;
	repositoryName: string;
	defaultBranch: string;
	workflowFile: string;
	credential: string;
	enabled: boolean;
	configured: boolean;
	methods: BuildMethodDraft[];
	definitions: BuildDefinitionDraft[];
};

export function createBuildConfigurationDraft(): ConfigurationDraft {
	return {
		provider: "github_actions",
		baseUrl: "https://api.github.com",
		repositoryOwner: "",
		repositoryName: "",
		defaultBranch: "main",
		workflowFile: "build.yml",
		credential: "",
		enabled: true,
		configured: false,
		methods: [newBuildMethod(0)],
		definitions: [],
	};
}

export function newBuildMethod(index: number): BuildMethodDraft {
	return {
		uiId: crypto.randomUUID(),
		key: `method_${index + 1}`,
		name: m.automation_configs_default_method(),
		description: "",
		runtime: "ubuntu-latest",
		branch: "main",
		command: "bun run build",
		artifactPolicy: "required",
		outputPattern: "dist/*.zip",
		sortOrder: (index + 1) * 100,
		enabled: true,
	};
}

export function newBuildDefinition(index: number): BuildDefinitionDraft {
	return {
		uiId: crypto.randomUUID(),
		key: `input_${index + 1}`,
		name: "",
		description: "",
		inputType: "text",
		scope: "automation",
		required: false,
		sensitive: false,
		validationPattern: "",
		minimumValue: null,
		maximumValue: null,
		defaultValue: "",
		exampleValue: "",
		sortOrder: (index + 1) * 100,
		options: [],
	};
}
