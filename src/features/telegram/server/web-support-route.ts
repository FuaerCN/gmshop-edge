import { ZodError, type ZodType } from "zod";
import { isSameOriginRequest } from "#/server/api-boundaries";
import { WebSupportError } from "./web-support";

export async function readWebSupportBody<T>(
	request: Request,
	schema: ZodType<T>,
) {
	if (!isSameOriginRequest(request))
		throw new WebSupportError("forbidden_origin", 403);
	if (!request.headers.get("content-type")?.startsWith("application/json"))
		throw new WebSupportError("unsupported_media_type", 415);
	if (Number(request.headers.get("content-length") ?? 0) > 16_384)
		throw new WebSupportError("request_too_large", 413);
	const value = await request.text();
	if (new TextEncoder().encode(value).byteLength > 16_384)
		throw new WebSupportError("request_too_large", 413);
	return schema.parse(JSON.parse(value));
}

export function webSupportResponse(error: unknown) {
	if (error instanceof WebSupportError)
		return Response.json({ code: error.code }, { status: error.status });
	if (error instanceof ZodError || error instanceof SyntaxError)
		return Response.json({ code: "invalid_request" }, { status: 400 });
	throw error;
}
