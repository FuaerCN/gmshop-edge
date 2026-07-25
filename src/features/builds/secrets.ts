import { decryptSecret, encryptSecret } from "#/lib/secrets";

export function encryptBuildConfigSecret(
	value: string,
	commerceSecret: string,
) {
	return encryptSecret(value, commerceSecret, "build-config");
}

export function decryptBuildConfigSecret(
	value: string,
	commerceSecret: string,
) {
	return decryptSecret(value, commerceSecret, "build-config");
}

export function encryptAutomationCallbackSecret(
	value: string,
	commerceSecret: string,
) {
	return encryptSecret(value, commerceSecret, "build-callback");
}

export function decryptAutomationCallbackSecret(
	value: string,
	commerceSecret: string,
) {
	return decryptSecret(value, commerceSecret, "build-callback");
}

export function encryptBuildInput(value: string, commerceSecret: string) {
	return encryptSecret(value, commerceSecret, "build-input");
}

export function decryptBuildInput(value: string, commerceSecret: string) {
	return decryptSecret(value, commerceSecret, "build-input");
}
