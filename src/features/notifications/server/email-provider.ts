import {
	createMail,
	type EmailOptions,
	type Provider,
	type Result,
	type EmailAddress as VisulimaEmailAddress,
} from "@visulima/email";
import { mailgunProvider } from "@visulima/email/providers/mailgun";
import { postmarkProvider } from "@visulima/email/providers/postmark";
import { resendProvider } from "@visulima/email/providers/resend";
import { sendGridProvider } from "@visulima/email/providers/sendgrid";
import { smtpProvider } from "@visulima/email/providers/smtp";
import { DomainError } from "#/lib/domain-error";

export const emailProviderIds = [
	"resend",
	"postmark",
	"sendgrid",
	"mailgun",
	"smtp",
	"cloudflare_email",
] as const;

export type EmailProviderId = (typeof emailProviderIds)[number];

type EmailProviderConfig = {
	provider: EmailProviderId;
	apiKey: string | null;
	domain: string | null;
	region: "us" | "eu";
	smtpHost: string | null;
	smtpPort: number | null;
	smtpUser: string | null;
	cloudflareEmail: SendEmail | null;
};

type ProviderEmailMessage = {
	to: string;
	from: string;
	replyTo: string;
	subject: string;
	text: string;
	html: string;
	idempotencyKey: string;
};

export async function sendProviderEmail(
	config: EmailProviderConfig,
	message: ProviderEmailMessage,
): Promise<Result<{ messageId: string }>> {
	if (config.provider === "cloudflare_email") {
		if (!config.cloudflareEmail)
			throw new DomainError(
				"notification_cloudflare_email_unavailable",
				503,
				'Cloudflare Send Email binding "EMAIL" is unavailable',
			);
		const result = await config.cloudflareEmail.send({
			from: parseCloudflareEmailAddress(message.from),
			to: parseCloudflareEmailAddress(message.to),
			...(message.replyTo
				? { replyTo: parseCloudflareEmailAddress(message.replyTo) }
				: {}),
			subject: message.subject,
			text: message.text,
			...(message.html ? { html: message.html } : {}),
			headers: { "Idempotency-Key": message.idempotencyKey },
		});
		return { success: true, data: { messageId: result.messageId } };
	}
	const mail = createProviderMail(config);
	return mail.send({
		from: parseEmailAddress(message.from),
		to: parseEmailAddress(message.to),
		...(message.replyTo ? { replyTo: parseEmailAddress(message.replyTo) } : {}),
		subject: message.subject,
		text: message.text,
		...(message.html ? { html: message.html } : {}),
		headers: { "Idempotency-Key": message.idempotencyKey },
	});
}

function createProviderMail(config: EmailProviderConfig) {
	if (!config.apiKey) throw new Error("Email provider credential is required");
	switch (config.provider) {
		case "resend":
			return createMail(
				resendProvider({
					apiKey: config.apiKey,
					retries: 0,
					timeout: 10_000,
				}) as unknown as Provider<unknown, unknown, EmailOptions>,
			);
		case "postmark":
			return createMail(
				postmarkProvider({
					serverToken: config.apiKey,
					retries: 0,
					timeout: 10_000,
				}),
			);
		case "sendgrid":
			return createMail(
				sendGridProvider({
					apiKey: config.apiKey,
					retries: 0,
					timeout: 10_000,
				}),
			);
		case "mailgun":
			if (!config.domain) throw new Error("Mailgun domain is required");
			return createMail(
				mailgunProvider({
					apiKey: config.apiKey,
					domain: config.domain,
					endpoint:
						config.region === "eu"
							? "https://api.eu.mailgun.net"
							: "https://api.mailgun.net",
					retries: 0,
					timeout: 10_000,
				}),
			);
		case "smtp":
			if (!config.smtpHost || !config.smtpPort || !config.smtpUser)
				throw new Error("SMTP configuration is incomplete");
			return createMail(
				smtpProvider({
					host: config.smtpHost,
					port: config.smtpPort,
					secure: config.smtpPort === 465,
					user: config.smtpUser,
					password: config.apiKey,
					rejectUnauthorized: true,
					pool: true,
					maxConnections: 2,
					retries: 0,
					timeout: 10_000,
				}),
			);
		case "cloudflare_email":
			throw new Error("Cloudflare Email uses the SendEmail binding");
	}
}

function parseEmailAddress(value: string): VisulimaEmailAddress {
	const displayAddress = /^(.*?)\s*<([^<>]+)>$/.exec(value.trim());
	if (!displayAddress) return { email: value.trim() };
	const name = displayAddress[1]?.trim().replace(/^"|"$/g, "");
	return {
		email: displayAddress[2]?.trim() ?? "",
		...(name ? { name } : {}),
	};
}

function parseCloudflareEmailAddress(
	value: string,
): string | { email: string; name: string } {
	const parsed = parseEmailAddress(value);
	return parsed.name
		? { email: parsed.email, name: parsed.name }
		: parsed.email;
}
