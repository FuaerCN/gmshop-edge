import { decryptSecret, encryptSecret } from "#/lib/secrets";

export function encryptDeliveryContent(value: string, commerceSecret: string) {
	return encryptSecret(value, commerceSecret, "delivery-content");
}

export function decryptDeliveryContent(value: string, commerceSecret: string) {
	return decryptSecret(value, commerceSecret, "delivery-content");
}
