const telegramIdentityDomain = "@telegram.invalid";
const legacyInternalIdentityDomain = "@identity.gmshop.invalid";

export function isInternalIdentityEmail(email: string | null | undefined) {
	const normalized = email?.trim().toLowerCase();
	return (
		normalized?.endsWith(telegramIdentityDomain) === true ||
		normalized?.endsWith(legacyInternalIdentityDomain) === true
	);
}

export function telegramIdentityEmail(telegramUserId: string) {
	return `${telegramUserId}${telegramIdentityDomain}`;
}
