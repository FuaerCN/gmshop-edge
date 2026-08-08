import { ZodError, type ZodType } from "zod";
import {
	BodyLimitExceededError,
	readBoundedRequestText,
} from "#/lib/bounded-stream";
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
	let value: string;
	try {
		value = await readBoundedRequestText(request, 16_384);
	} catch (error) {
		if (!(error instanceof BodyLimitExceededError)) throw error;
		throw new WebSupportError("request_too_large", 413);
	}
	return schema.parse(JSON.parse(value));
}

export function webSupportResponse(error: unknown) {
	if (error instanceof WebSupportError)
		return Response.json({ code: error.code }, { status: error.status });
	if (error instanceof ZodError || error instanceof SyntaxError)
		return Response.json({ code: "invalid_request" }, { status: 400 });
	throw error;
}
