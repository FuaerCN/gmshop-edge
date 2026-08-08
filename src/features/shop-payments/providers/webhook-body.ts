import {
	BodyLimitExceededError,
	readBoundedRequestText,
} from "#/lib/bounded-stream";
import { DomainError } from "#/lib/domain-error";

const maximumPaymentWebhookBytes = 65_536;

export async function readPaymentWebhookText(request: Request) {
	try {
		return await readBoundedRequestText(request, maximumPaymentWebhookBytes);
	} catch (error) {
		if (error instanceof BodyLimitExceededError)
			throw new DomainError(
				"payment_webhook_too_large",
				413,
				"Payment webhook body is too large",
			);
		throw error;
	}
}
