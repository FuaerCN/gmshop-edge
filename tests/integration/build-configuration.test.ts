import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { saveBuildConfiguration } from "#/features/builds/server/admin";
import { applyMigrations } from "./migrations";

vi.mock("cloudflare:workers", () => ({ env: {} }));

describe("automation configuration snapshots", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let database: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-build-configuration" },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigrations(database);
		await seed(database);
	});

	afterAll(async () => miniflare.dispose());

	it("publishes normalized immutable method and input snapshots", async () => {
		const base = configuration();
		const updatedDefinitionKey = `BUILD_INPUT_${crypto
			.randomUUID()
			.replaceAll("-", "_")
			.toUpperCase()}`;
		const [method] = base.methods;
		if (!method) throw new Error("Build method fixture is required");
		const first = await saveBuildConfiguration(database, base, {
			actorUserId: "admin-user",
		});
		expect(first.activeVersion).toBe(2);
		const second = await saveBuildConfiguration(
			database,
			{
				...base,
				id: first.id,
				credential: "",
				definitions: base.definitions.map((definition, index) =>
					index === 0
						? { ...definition, key: updatedDefinitionKey }
						: definition,
				),
				methods: [
					{
						...method,
						name: "Production build v2",
					},
				],
			},
			{ actorUserId: "admin-user" },
		);
		expect(second.activeVersion).toBe(3);
		const state = await database
			.prepare(
				`SELECT item.version AS active_version,
				 (SELECT COUNT(*) FROM product_automation_methods WHERE sellable_item_id = item.id) AS methods,
				 (SELECT COUNT(*) FROM product_definition_versions WHERE product_id = item.product_id) AS versions,
				 (SELECT COALESCE(SUM(json_array_length(pdv.schema_json)), 0)
				  FROM product_definition_versions pdv
				  WHERE pdv.product_id = item.product_id) AS fields,
				 (SELECT COUNT(*) FROM audit_logs WHERE action = 'automation_configuration.published') AS audits,
				 item.automation_credential_encrypted AS credential_encrypted
				 FROM product_sellable_items item WHERE item.product_id = ?
				 AND item.automation_provider IS NOT NULL LIMIT 1`,
			)
			.bind("11111111-1111-4111-8111-111111111111")
			.first<Record<string, unknown>>();
		expect(state).toMatchObject({
			active_version: 3,
			methods: 2,
			versions: 2,
			fields: 4,
			audits: 2,
		});
		expect(String(state?.credential_encrypted)).not.toContain(
			"github-token-secret",
		);
		const latestDefinition = await database
			.prepare(
				`SELECT schema_json FROM product_definition_versions
				 WHERE product_id = ? ORDER BY version DESC LIMIT 1`,
			)
			.bind("11111111-1111-4111-8111-111111111111")
			.first<{ schema_json: string }>();
		expect(JSON.parse(latestDefinition?.schema_json ?? "[]")).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: updatedDefinitionKey }),
			]),
		);
	});

	it("allows providers for separate build delivery components", async () => {
		const gitLab = await saveBuildConfiguration(
			database,
			{
				...configuration(),
				deliveryComponentId: "13131313-1313-4313-8313-131313131313",
				provider: "gitlab_ci",
				baseUrl: "https://gitlab.example.com",
				repositoryOwner: "team/platform",
				repositoryName: "example-app",
			},
			{ actorUserId: "admin-user" },
		);
		expect(gitLab.activeVersion).toBe(2);
		const configs = await database
			.prepare(
				`SELECT automation_provider AS provider, automation_base_url AS base_url
				 FROM product_sellable_items WHERE product_id = ?
				 AND automation_provider IS NOT NULL ORDER BY automation_provider`,
			)
			.bind("11111111-1111-4111-8111-111111111111")
			.all();
		expect(configs.results).toEqual([
			{
				provider: "github_actions",
				base_url: "https://api.github.com",
			},
			{
				provider: "gitlab_ci",
				base_url: "https://gitlab.example.com",
			},
		]);
	});

	it("does not move an existing configuration between sellable items", async () => {
		const existing = await database
			.prepare(
				"SELECT id FROM product_sellable_items WHERE id = ? AND automation_provider IS NOT NULL LIMIT 1",
			)
			.bind("12121212-1212-4212-8212-121212121212")
			.first<{ id: string }>();
		if (!existing)
			throw new Error("Automation configuration fixture is required");
		await expect(
			saveBuildConfiguration(
				database,
				{
					...configuration(),
					id: existing.id,
					deliveryComponentId: "13131313-1313-4313-8313-131313131313",
				},
				{ actorUserId: "admin-user" },
			),
		).rejects.toMatchObject({ code: "automation_configuration_not_found" });
	});
});

function configuration() {
	return {
		productId: "11111111-1111-4111-8111-111111111111",
		deliveryComponentId: "12121212-1212-4212-8212-121212121212",
		provider: "github_actions" as const,
		baseUrl: "https://api.github.com",
		repositoryOwner: "gmshop",
		repositoryName: "example-app",
		defaultBranch: "main",
		workflowFile: "build.yml",
		credential: "github-token-secret",
		enabled: true,
		methods: [
			{
				key: "production",
				name: "Production build",
				description: "Optimized release",
				runtime: "ubuntu-latest",
				branch: "main",
				command: "bun run build",
				artifactPolicy: "required" as const,
				outputPattern: "dist/*.zip",
				sortOrder: 100,
				enabled: true,
			},
		],
		definitions: [
			{
				key: "license_key",
				name: "License key",
				description: "Customer authorization key",
				inputType: "text" as const,
				scope: "authorization" as const,
				required: true,
				sensitive: true,
				validationPattern: "^[A-Z0-9-]+$",
				minimumValue: null,
				maximumValue: null,
				defaultValue: "",
				sortOrder: 100,
				options: [],
			},
			{
				key: "channel",
				name: "Release channel",
				description: "Build channel",
				inputType: "select" as const,
				scope: "automation" as const,
				required: true,
				sensitive: false,
				validationPattern: "",
				minimumValue: null,
				maximumValue: null,
				defaultValue: "stable",
				sortOrder: 200,
				options: [
					{ value: "stable", label: "Stable" },
					{ value: "preview", label: "Preview" },
				],
			},
		],
	};
}

async function seed(database: D1Database) {
	await database.batch([
		database.prepare(
			`INSERT INTO users
			 (id, name, email, email_verified, enabled, created_at, updated_at)
			 VALUES ('admin-user', 'Admin', 'admin@example.com', 1, 1, 1, 1)`,
		),
		database.prepare(
			`INSERT INTO system_settings (key, value, is_secret, created_at, updated_at)
			 VALUES ('runtime.data_encryption_secret', '"commerce-test-secret"', 1, 1, 1)`,
		),
		database.prepare(
			`INSERT INTO products
			 (id, name, product_type, status, sort_order, created_at, updated_at)
			 VALUES ('11111111-1111-4111-8111-111111111111',
			  'Builder', 'automation', 'active', 100, 1, 1)`,
		),
		database.prepare(
			`INSERT INTO product_sellable_items
			 (id, product_id, name, price_minor, created_at, updated_at)
			 VALUES
			 ('12121212-1212-4212-8212-121212121212',
			  '11111111-1111-4111-8111-111111111111', 'GitHub build', '1000', 1, 1),
			 ('13131313-1313-4313-8313-131313131313',
			  '11111111-1111-4111-8111-111111111111', 'GitLab build', '1000', 1, 1)`,
		),
	]);
}
