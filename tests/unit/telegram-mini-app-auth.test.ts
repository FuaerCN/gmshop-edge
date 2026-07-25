import { describe, expect, it } from "vitest";
import {
	TelegramMiniAppAuthError,
	verifyTelegramMiniAppInitData,
} from "#/features/auth/server/telegram-mini-app";
import { signedTelegramInitData } from "../helpers/telegram-init-data";

const botToken = "123456:telegram-test-token";
const now = 1_800_000_000_000;

describe("Telegram Mini App initData verification", () => {
	it("validates the Bot-token HMAC and returns a typed identity", async () => {
		const initData = await signedTelegramInitData(
			botToken,
			Math.floor(now / 1_000),
		);
		await expect(
			verifyTelegramMiniAppInitData(initData, botToken, { now }),
		).resolves.toMatchObject({
			telegramUserId: "900719925474000",
			firstName: "Mini",
			lastName: "User",
			username: "mini_user",
			authenticatedAt: now,
		});
	});

	it("rejects tampering, the wrong Bot, expiration, future data and duplicate keys", async () => {
		const valid = await signedTelegramInitData(
			botToken,
			Math.floor(now / 1_000),
		);
		await expect(
			verifyTelegramMiniAppInitData(
				valid.replace("mini_user", "attacker"),
				botToken,
				{
					now,
				},
			),
		).rejects.toMatchObject({ code: "invalid_signature" });
		await expect(
			verifyTelegramMiniAppInitData(valid, "wrong-token", { now }),
		).rejects.toMatchObject({ code: "invalid_signature" });
		await expect(
			verifyTelegramMiniAppInitData(valid, botToken, { now: now + 300_001 }),
		).rejects.toMatchObject({ code: "expired_auth_date" });
		const future = await signedTelegramInitData(
			botToken,
			Math.floor((now + 31_000) / 1_000),
		);
		await expect(
			verifyTelegramMiniAppInitData(future, botToken, { now }),
		).rejects.toMatchObject({ code: "future_auth_date" });
		await expect(
			verifyTelegramMiniAppInitData(`${valid}&auth_date=1`, botToken, { now }),
		).rejects.toBeInstanceOf(TelegramMiniAppAuthError);
	});
});
