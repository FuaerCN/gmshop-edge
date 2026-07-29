import { describe, expect, it, vi } from "vitest";
import { adminRoleIdsFromForm } from "#/features/users/pages/admin-list";

vi.mock("#/features/access/queries", () => ({
	systemAccessQueryKey: ["admin", "system-access"],
	systemAccessQueryOptions: {},
}));
vi.mock("#/features/users/queries", () => ({
	adminUsersQueryKey: ["admin", "users"],
	adminUsersQueryOptions: vi.fn(),
}));
vi.mock("#/features/users/server/admin", () => ({
	deleteUserFn: vi.fn(),
	saveUserFn: vi.fn(),
	setUserEnabledFn: vi.fn(),
	setUserRolesFn: vi.fn(),
}));

describe("administrator role form values", () => {
	it("preserves one or many selected system roles", () => {
		expect(adminRoleIdsFromForm("role-id")).toEqual(["role-id"]);
		expect(adminRoleIdsFromForm(["role-a", "role-b"])).toEqual([
			"role-a",
			"role-b",
		]);
		expect(adminRoleIdsFromForm(undefined)).toEqual([]);
	});
});
