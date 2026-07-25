import { describe, expect, it } from "vitest";
import { saveBuildConfigurationSchema } from "#/features/builds/schema";

const configuration = {
	productId: "11111111-1111-4111-8111-111111111111",
	deliveryComponentId: "22222222-2222-4222-8222-222222222222",
	provider: "gitlab_ci" as const,
	baseUrl: "https://gitlab.example.com",
	repositoryOwner: "team/platform",
	repositoryName: "app",
	defaultBranch: "main",
	workflowFile: ".gitlab-ci.yml",
	credential: "token",
	enabled: true,
	methods: [
		{
			key: "production",
			name: "Production",
			description: "",
			runtime: "linux",
			branch: "main",
			command: "bun run build",
			artifactPolicy: "required",
			outputPattern: "dist/*.zip",
			sortOrder: 100,
			enabled: true,
		},
	],
	definitions: [],
};

describe("build provider URL", () => {
	it("accepts a public self-hosted GitLab HTTPS origin", () => {
		expect(saveBuildConfigurationSchema.safeParse(configuration).success).toBe(
			true,
		);
	});

	it.each([
		"http://gitlab.example.com",
		"https://localhost",
		"https://127.0.0.1",
		"https://10.0.0.8",
		"https://169.254.169.254/latest/meta-data",
		"https://user:password@gitlab.example.com",
	])("rejects unsafe provider URL %s", (baseUrl) => {
		expect(
			saveBuildConfigurationSchema.safeParse({
				...configuration,
				baseUrl,
			}).success,
		).toBe(false);
	});
});
