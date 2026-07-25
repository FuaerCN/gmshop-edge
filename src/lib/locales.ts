export const supportedLocales = ["en-US", "zh-CN"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

/**
 * Native names identify locale choices and intentionally stay independent of
 * the active UI language. They are not Paraglide messages.
 */
export const localeLabels: Record<SupportedLocale, string> = {
	"en-US": "English",
	"zh-CN": "简体中文",
};
