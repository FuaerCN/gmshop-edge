export const authProviderPresets = [
	{
		providerId: "google",
		providerType: "social",
		displayName: "Google",
		icon: "google",
		scopes: ["openid", "email", "profile"],
	},
	{
		providerId: "github",
		providerType: "social",
		displayName: "GitHub",
		icon: "github",
		scopes: ["read:user", "user:email"],
	},
	{
		providerId: "discord",
		providerType: "social",
		displayName: "Discord",
		icon: "discord",
		scopes: ["identify", "email"],
	},
	{
		providerId: "apple",
		providerType: "social",
		displayName: "Apple",
		icon: "apple",
		scopes: ["name", "email"],
	},
	{
		providerId: "microsoft",
		providerType: "social",
		displayName: "Microsoft",
		icon: "microsoft",
		scopes: ["openid", "email", "profile"],
	},
	{
		providerId: "line",
		providerType: "social",
		displayName: "LINE",
		icon: "line",
		scopes: ["openid", "profile", "email"],
	},
	{
		providerId: "telegram",
		providerType: "social",
		displayName: "Telegram",
		icon: "telegram",
		scopes: ["openid", "profile"],
	},
	{
		providerId: "wechat",
		providerType: "social",
		displayName: "WeChat",
		icon: "wechat",
		scopes: ["snsapi_login"],
	},
] as const;

export const authProviderAllowedScopes = {
	google: ["openid", "email", "profile"],
	github: ["read:user", "user:email"],
	discord: ["identify", "email"],
	apple: ["name", "email"],
	microsoft: ["openid", "email", "profile"],
	line: ["openid", "profile", "email"],
	telegram: ["openid", "profile", "phone"],
	wechat: ["snsapi_login"],
} as const;
