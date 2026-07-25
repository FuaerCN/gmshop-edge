import { getAuth } from "#/features/auth/server/auth";
import { DomainError } from "#/lib/domain-error";

export async function verifySensitiveAdminAction(
	request: Request,
	_userId: string,
	proof: { password: string },
) {
	const auth = await getAuth(request);
	try {
		const response = await auth.api.verifyPassword({
			headers: request.headers,
			body: { password: proof.password },
			asResponse: true,
		});
		if (!response.ok) throw new Error("Password verification failed");
	} catch {
		throw new DomainError(
			"reauthentication_failed",
			401,
			"Enter your current password. Accounts without a local password must set one first.",
		);
	}
}
