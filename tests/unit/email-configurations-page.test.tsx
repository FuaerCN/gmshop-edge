// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailConfigurationsPage } from "#/features/notifications/pages/email-configurations";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
	modalFormProps: vi.fn(),
	proTableProps: vi.fn(),
	reorderEmailChannelsFn: vi.fn(),
	setEmailChannelEnabledFn: vi.fn(),
}));

vi.mock("#/components/pro/table", () => ({
	ProTable: (props: unknown) => {
		mocks.proTableProps(props);
		return null;
	},
}));

vi.mock("#/components/pro/form", () => ({
	ModalForm: (props: unknown) => {
		mocks.modalFormProps(props);
		return null;
	},
}));

vi.mock("#/lib/pro-table-url-state", () => ({
	useCurrentProTableUrlState: () => ({
		initialState: {},
		onChange: vi.fn(),
	}),
}));

vi.mock("#/features/notifications/server/admin", () => ({
	getNotificationCenterFn: vi.fn(
		async (): Promise<{
			configs: never[];
			deliveries: never[];
			templates: never[];
		}> => ({
			configs: [],
			deliveries: [],
			templates: [],
		}),
	),
	reorderEmailChannelsFn: mocks.reorderEmailChannelsFn,
	saveEmailChannelFn: vi.fn(),
	sendTestEmailFn: vi.fn(),
	setEmailChannelEnabledFn: mocks.setEmailChannelEnabledFn,
}));

describe("email configurations list", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => root.unmount());
		container.remove();
		vi.clearAllMocks();
	});

	it("persists the visible row order through drag sorting", async () => {
		const queryClient = new QueryClient({
			defaultOptions: {
				mutations: { retry: false },
				queries: { retry: false },
			},
		});
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<EmailConfigurationsPage />
				</QueryClientProvider>,
			);
		});

		const props = mocks.proTableProps.mock.lastCall?.[0] as {
			columns: Array<{
				accessorKey?: string;
				cell?: (context: {
					row: {
						original: { id: string; name: string; enabled: boolean };
					};
				}) => {
					props: { onCheckedChange: (enabled: boolean) => void };
				};
			}>;
			dragSort: {
				rowKey: string;
				onDragSortEnd: (rows: Array<{ id: string }>) => void;
			};
		};
		expect(props.dragSort.rowKey).toBe("id");
		expect(props.columns[0]).toEqual(
			expect.objectContaining({ accessorKey: "enabled" }),
		);
		const enabledCell = props.columns[0]?.cell;
		const enabledSwitch = enabledCell?.({
			row: {
				original: {
					id: "00000000-0000-4000-8000-000000000001",
					name: "Primary",
					enabled: true,
				},
			},
		});
		await act(async () => enabledSwitch?.props.onCheckedChange(false));
		expect(mocks.setEmailChannelEnabledFn).toHaveBeenCalledWith(
			{
				data: {
					id: "00000000-0000-4000-8000-000000000001",
					enabled: false,
				},
			},
			expect.anything(),
		);
		expect(props.columns).not.toContainEqual(
			expect.objectContaining({ accessorKey: "sortOrder" }),
		);
		const configForm = mocks.modalFormProps.mock.calls[0]?.[0] as {
			schema: Array<{ name: string }>;
		};
		expect(configForm.schema).not.toContainEqual(
			expect.objectContaining({ name: "enabled" }),
		);

		await act(async () => {
			props.dragSort.onDragSortEnd([{ id: "second" }, { id: "first" }]);
		});
		expect(mocks.reorderEmailChannelsFn).toHaveBeenCalledWith(
			{
				data: { ids: ["second", "first"] },
			},
			expect.anything(),
		);
	});
});
