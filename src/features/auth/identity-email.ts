const internalIdentityDomain = "@identity.gmshop.invalid";

export function isInternalIdentityEmail(email: string | null | undefined) {
	return email?.trim().toLowerCase().endsWith(internalIdentityDomain) === true;
}

export function telegramIdentityEmail(telegramUserId: string) {
	return `telegram-${telegramUserId}${internalIdentityDomain}`;
}
