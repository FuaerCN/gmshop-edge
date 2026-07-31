import { describe, expect, it } from "vitest";
import {
	constantTimeStringEqual,
	deriveTelegramWebhookSecret,
	telegramDataKeyId,
} from "#/features/telegram/server/secret";

describe("Telegram webhook secret", () => {
	it("is deterministic and purpose-separated by bot and provider revision", async () => {
		const first = await deriveTelegramWebhookSecret("data-key", "123", 4);
		expect(first).toBe(await deriveTelegramWebhookSecret("data-key", "123", 4));
		expect(first).not.toBe(
			await deriveTelegramWebhookSecret("data-key", "124", 4),
		);
		expect(first).not.toBe(
			await deriveTelegramWebhookSecret("data-key", "123", 5),
		);
		expect(first).not.toContain("=");
	});

	it("stores only a non-secret key identifier and compares exact values", async () => {
		const identifier = await telegramDataKeyId("data-key");
		expect(identifier).not.toContain("data-key");
		expect(constantTimeStringEqual(identifier, identifier)).toBe(true);
		expect(constantTimeStringEqual(identifier, `${identifier}x`)).toBe(false);
	});
});
