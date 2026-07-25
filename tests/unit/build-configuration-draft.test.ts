import { describe, expect, it } from "vitest";
import { createBuildConfigurationDraft } from "#/features/builds/configuration-draft";
import { saveBuildConfigurationSchema } from "#/features/builds/schema";

describe("inline automation configuration draft", () => {
	it("starts with a complete default automation method and validates after primary fields are filled", () => {
		const draft = createBuildConfigurationDraft();

		expect(draft.provider).toBe("github_actions");
		expect(draft.methods).toHaveLength(1);
		expect(draft.methods[0]?.name).not.toBe("");
		expect(
			saveBuildConfigurationSchema.safeParse({
				...draft,
				productId: "11111111-1111-4111-8111-111111111111",
				deliveryComponentId: "22222222-2222-4222-8222-222222222222",
				repositoryOwner: "gmshop",
				repositoryName: "product",
				credential: "token",
			}).success,
		).toBe(true);
	});

	it("enforces artifact policy and output-pattern shape", () => {
		const draft = createBuildConfigurationDraft();
		const base = {
			...draft,
			productId: "11111111-1111-4111-8111-111111111111",
			deliveryComponentId: "22222222-2222-4222-8222-222222222222",
			repositoryOwner: "gmshop",
			repositoryName: "product",
			credential: "token",
		};
		expect(
			saveBuildConfigurationSchema.safeParse({
				...base,
				methods: [
					{ ...draft.methods[0], artifactPolicy: "none", outputPattern: "" },
				],
			}).success,
		).toBe(true);
		expect(
			saveBuildConfigurationSchema.safeParse({
				...base,
				methods: [
					{
						...draft.methods[0],
						artifactPolicy: "required",
						outputPattern: "",
					},
				],
			}).success,
		).toBe(false);
	});
});
