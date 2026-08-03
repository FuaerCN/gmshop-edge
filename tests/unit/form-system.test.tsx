// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Password } from "#/components/pro/base/fields/input";
import {
	formBooleanValue,
	ModalForm,
	ProSchemaForm,
} from "#/components/pro/form";
import { AuthAnimationProvider } from "#/features/auth/components/auth-animation-context";
import { UserAuthForm } from "#/features/auth/components/user-auth-form";
import { m } from "#/paraglide/messages";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tanstack/react-router", () => ({
	Link: "a",
	useNavigate: () => vi.fn(),
}));
vi.mock("#/features/auth/auth-client", () => ({
	authClient: { signIn: { email: vi.fn() } },
}));
vi.mock("#/features/auth/server/provider-admin", () => ({
	listPublicAuthProvidersFn: vi.fn(async () => [
		{
			providerId: "credential",
			providerType: "email",
			allowSignup: true,
			passwordLoginEnabled: true,
			emailOtpEnabled: false,
			emailDeliveryEnabled: true,
		},
	]),
}));

describe("application form system", () => {
	let container: HTMLDivElement | undefined;

	afterEach(() => {
		container?.remove();
		container = undefined;
	});

	it("keeps TanStack Form as the only application form runtime", () => {
		const packageJson = JSON.parse(
			readFileSync(resolve("package.json"), "utf8"),
		) as { dependencies?: Record<string, string> };
		expect(packageJson.dependencies).toHaveProperty("@tanstack/react-form");
		expect(packageJson.dependencies).not.toHaveProperty("react-hook-form");
		expect(packageJson.dependencies).not.toHaveProperty("@hookform/resolvers");

		for (const path of [
			"src/features/auth/components/user-auth-form.tsx",
			"src/features/installation/pages/install.tsx",
		]) {
			const source = readFileSync(resolve(path), "utf8");
			expect(source, path).toContain('from "@tanstack/react-form"');
			expect(source, path).not.toMatch(/react-hook-form|@hookform\/resolvers/);
		}
	});

	it("distributes localized schema errors to named sign-in fields", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<QueryClientProvider client={new QueryClient()}>
					<AuthAnimationProvider>
						<UserAuthForm />
					</AuthAnimationProvider>
				</QueryClientProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		await act(async () => {
			container?.querySelector("form")?.requestSubmit();
			await Promise.resolve();
		});

		const email = container.querySelector<HTMLInputElement>("#sign-in-email");
		const password =
			container.querySelector<HTMLInputElement>("#sign-in-password");
		expect(email?.getAttribute("aria-invalid")).toBe("true");
		expect(password?.getAttribute("aria-invalid")).toBe("true");
		expect(container.textContent).toContain(m.auth_email_required());
		expect(container.textContent).toContain(m.auth_password_required());

		await act(async () => root.unmount());
	});

	it("renders one right-aligned forgot-password link below the password input", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<QueryClientProvider client={new QueryClient()}>
					<AuthAnimationProvider>
						<UserAuthForm />
					</AuthAnimationProvider>
				</QueryClientProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		const links = Array.from(container.querySelectorAll("a")).filter(
			(link) => link.textContent === m.auth_forgot_password(),
		);
		const link = links[0] as HTMLAnchorElement;
		const password = container.querySelector("#sign-in-password");
		const email = container.querySelector("#sign-in-email");
		const alignment = link?.parentElement;
		const passwordField = alignment?.parentElement;

		expect(links).toHaveLength(1);
		expect(alignment?.classList).toContain("justify-end");
		expect(passwordField?.contains(password)).toBe(true);
		expect(passwordField?.contains(link)).toBe(true);
		expect(email?.parentElement?.contains(link)).toBe(false);
		expect(
			(password as Element).compareDocumentPosition(link) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();

		await act(async () => root.unmount());
	});

	it("keeps the password visibility control keyboard reachable", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);

		await act(async () => {
			root.render(<Password aria-label={m.common_password()} />);
		});

		const button = container.querySelector<HTMLButtonElement>("button");
		expect(button?.tabIndex).toBe(0);
		expect(button?.getAttribute("aria-label")).toBe(m.pro_field_showPassword());

		await act(async () => root.unmount());
	});

	it("parses serialized switch values without treating false as truthy", () => {
		expect(formBooleanValue(false)).toBe(false);
		expect(formBooleanValue("false")).toBe(false);
		expect(formBooleanValue(undefined)).toBe(false);
		expect(formBooleanValue(true)).toBe(true);
		expect(formBooleanValue("true")).toBe(true);
	});

	it("supports value-dependent fields in ProForm schemas", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<ProSchemaForm
					initialValues={{ provider: "smtp" }}
					schema={[
						{ name: "provider", label: "Provider" },
						{
							name: "smtpHost",
							label: "SMTP host",
							hidden: (values) => values.provider !== "smtp",
						},
						{
							name: "domain",
							label: "Mailgun domain",
							hidden: (values) => values.provider !== "mailgun",
						},
					]}
				/>,
			);
		});

		expect(container.textContent).toContain("SMTP host");
		expect(container.textContent).not.toContain("Mailgun domain");
		await act(async () => root.unmount());
	});

	it("renders overlay validation errors on fields without calling onFinish", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);
		const onFinish = vi.fn();

		await act(async () => {
			root.render(
				<ModalForm
					open
					title="Payment"
					schema={[{ name: "secret", label: "Secret" }]}
					validate={() => ({ secret: ["Use at least 8 characters"] })}
					onFinish={onFinish}
				/>,
			);
		});
		await act(async () => {
			document
				.querySelector<HTMLFormElement>('[data-slot="pro-modal-content"] form')
				?.requestSubmit();
			await Promise.resolve();
		});

		const input = document.querySelector<HTMLInputElement>("#secret");
		expect(onFinish).not.toHaveBeenCalled();
		expect(input?.getAttribute("aria-invalid")).toBe("true");
		expect(document.body.textContent).toContain("Use at least 8 characters");

		await act(async () => root.unmount());
	});
});
