import { encryptSecret } from "#/lib/secrets";

export function encryptOrderInput(value: string, commerceSecret: string) {
	return encryptSecret(value, commerceSecret, "order-input");
}
