// @vitest-environment jsdom

import type { ColumnDef } from "@tanstack/react-table";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CheckboxControl } from "#/components/pro/base/fields/checkbox";
import { ProTable } from "#/components/pro/table";

interface RowData {
	id: string;
	name: string;
}

describe("ProTable row selection", () => {
	let root: Root | undefined;
	let container: HTMLDivElement | undefined;

	afterEach(() => {
		act(() => root?.unmount());
		container?.remove();
	});

	it("retains a selected row and exposes the bulk actions", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		const columns: ColumnDef<RowData>[] = [
			{
				id: "select",
				cell: ({ row, table }) => (
					<CheckboxControl
						aria-label={`Select ${row.original.name}`}
						checked={row.getIsSelected()}
						onClick={() =>
							table.setRowSelection((current) => ({
								...current,
								[row.id]: !row.getIsSelected(),
							}))
						}
					/>
				),
			},
			{ accessorKey: "name", header: "Name" },
		];

		await act(async () => {
			root?.render(
				<ProTable
					columns={columns}
					data={[{ id: "one", name: "One" }]}
					toolbar={false}
					pagination={false}
					bulkToolbar={({ selectedRows }) => (
						<span>{selectedRows.length} selected</span>
					)}
				/>,
			);
		});
		const checkbox =
			container.querySelector<HTMLButtonElement>('[role="checkbox"]');
		expect(checkbox).not.toBeNull();

		await act(async () => checkbox?.click());

		expect(checkbox?.getAttribute("data-state")).toBe("checked");
		expect(container.textContent).toContain("1 selected");
	});
});
