import type { Request, Response } from "express";
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from "./http/requestGuards";
import { sendOperationError } from "./http/httpErrors";
import { getBackendBaseUrl } from "./config/runtime.js";

export function resolveBackendBaseUrl(_request: Request): string {
  return getBackendBaseUrl();
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

    const upstream = await fetch(`${resolveBackendBaseUrl(request)}${targetPath}`, {
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

export async function emailSignupCompatApi(request: Request, response: Response, _context: unknown) {
  await proxyAuthRequest(request, response, "/auth/signup");
}

export async function emailLoginCompatApi(request: Request, response: Response, _context: unknown) {
  await proxyAuthRequest(request, response, "/auth/login");
}
