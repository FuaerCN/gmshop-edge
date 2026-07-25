import { createFileRoute } from "@tanstack/react-router";
import { VerifyEmailSentPage } from "#/features/auth/pages/verify-email-sent";

export const Route = createFileRoute("/(auth)/verify-email-sent")({
	component: VerifyEmailSentPage,
});
