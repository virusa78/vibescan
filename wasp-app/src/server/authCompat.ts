import type { Request, Response } from "express";
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from "./http/requestGuards";
import { sendOperationError } from "./http/httpErrors";

function getBackendBaseUrl(request: Request): string {
  if (process.env.WASP_SERVER_URL) {
    return process.env.WASP_SERVER_URL.replace(/\/$/, "");
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(",")[0] ?? request.protocol;
  const host = request.get("host");

  if (host) {
    return `${protocol}://${host}`.replace(/\/$/, "");
  }

  return `http://127.0.0.1:${process.env.PORT || "3555"}`;
}

async function proxyAuthRequest(
  request: Request,
  response: Response,
  targetPath: "/auth/signup" | "/auth/login",
) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    await enforceRateLimit({
      key: getRateLimitKey(`auth-${targetPath.split('/').pop()}`, request.ip || request.get('x-forwarded-for') || 'anonymous'),
      limit: 10,
      windowSeconds: 60,
    });

    const upstream = await fetch(`${getBackendBaseUrl(request)}${targetPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await upstream.text();
    response.status(upstream.status).type("application/json").send(payload);
  } catch (error) {
    sendOperationError("auth-compat", error, response);
  }
}

export async function emailSignupCompatApi(request: Request, response: Response, _context: any) {
  await proxyAuthRequest(request, response, "/auth/signup");
}

export async function emailLoginCompatApi(request: Request, response: Response, _context: any) {
  await proxyAuthRequest(request, response, "/auth/login");
}
