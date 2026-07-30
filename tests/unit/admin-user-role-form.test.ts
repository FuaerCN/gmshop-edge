import { describe, expect, it, vi } from "vitest";
import {
	adminRoleIdsFromForm,
	userSchema,
} from "#/features/users/components/admin-account-controls";
import { userIdSchema } from "#/features/users/schema";

vi.mock("#/features/access/queries", () => ({
	systemAccessQueryKey: ["admin", "system-access"],
	systemAccessQueryOptions: {},
}));
vi.mock("#/features/users/server/admin", () => ({
	deleteUserFn: vi.fn(),
	saveUserFn: vi.fn(),
	setUserEnabledFn: vi.fn(),
	setUserRolesFn: vi.fn(),
}));

describe("administrator role form values", () => {
	it("accepts Better Auth and UUID user identifiers", () => {
		expect(userIdSchema.parse("rbwMYXoAtoOURCvZcHBJ1IEDaFQOy2HY")).toBe(
			"rbwMYXoAtoOURCvZcHBJ1IEDaFQOy2HY",
		);
		expect(userIdSchema.parse("00000000-0000-4000-8000-000000000001")).toBe(
			"00000000-0000-4000-8000-000000000001",
		);
		expect(userIdSchema.safeParse("").success).toBe(false);
		expect(userIdSchema.safeParse("../user").success).toBe(false);
	});

	it("preserves one or many selected system roles", () => {
		expect(adminRoleIdsFromForm("role-id")).toEqual(["role-id"]);
		expect(adminRoleIdsFromForm(["role-a", "role-b"])).toEqual([
			"role-a",
			"role-b",
		]);
		expect(adminRoleIdsFromForm(undefined)).toEqual([]);
	});

	it("renders roles as a visible checkbox group", () => {
		const roles = userSchema({
			mode: "edit",
			roleOptions: [{ label: "operator", value: "role-id" }],
		}).find((field) => field.name === "roles");

		expect(roles).toMatchObject({
			valueType: "checkbox",
			fieldProps: {
				options: [{ label: "operator", value: "role-id" }],
			},
		});
	});
});
