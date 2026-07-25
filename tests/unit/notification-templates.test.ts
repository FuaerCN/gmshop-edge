import { describe, expect, it } from "vitest";
import { notificationTemplateSchema } from "#/features/notifications/schema";
import {
	builtinNotificationTemplateRows,
	commerceNotificationEvents,
	renderNotificationTemplate,
} from "#/features/notifications/templates";
import { supportedLocales } from "#/lib/locales";

describe("notification templates", () => {
	it("provides safe defaults for every event, channel, and locale", () => {
		expect(builtinNotificationTemplateRows).toHaveLength(
			commerceNotificationEvents.length * supportedLocales.length,
		);
		const values = {
			site_name: "GMShop Edge",
			order_number: "ORDER-1001",
			product_name: "Digital product",
			status: "completed",
			amount: "USD 12.99",
			order_url: "https://shop.example/orders/ORDER-1001",
			case_number: "AS-1001",
			resolution: "Resolved",
		};
		for (const template of builtinNotificationTemplateRows) {
			const rendered = renderNotificationTemplate(template.body, values);
			expect(rendered).not.toMatch(/{{\s*[a-z_]+\s*}}/);
			expect(rendered).toContain("https://shop.example/");
		}
	});

	it("accepts content-only edits and rejects unsupported variables", () => {
		expect(() =>
			notificationTemplateSchema.parse({
				id: "notification-email-order_paid-en-US",
				subject: "",
				body: "Hello {{unknown_secret}}",
			}),
		).toThrow();
		expect(
			notificationTemplateSchema.parse({
				id: "notification-email-automation_ready-zh-CN",
				subject: "",
				body: "构建完成：{{order_url}}",
			}),
		).toMatchObject({
			id: "notification-email-automation_ready-zh-CN",
		});
	});
});
