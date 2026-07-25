import { decryptSecret, encryptSecret } from "#/lib/secrets";

export function encryptNotificationConfig(value: string, secret: string) {
	return encryptSecret(value, secret, "notification-config");
}

export function decryptNotificationConfig(value: string, secret: string) {
	return decryptSecret(value, secret, "notification-config");
}

export function encryptNotificationMessage(value: string, secret: string) {
	return encryptSecret(value, secret, "notification-message");
}

export function decryptNotificationMessage(value: string, secret: string) {
	return decryptSecret(value, secret, "notification-message");
}

export function encryptNotificationDestination(value: string, secret: string) {
	return encryptSecret(value, secret, "notification-destination");
}

export function decryptNotificationDestination(value: string, secret: string) {
	return decryptSecret(value, secret, "notification-destination");
}
