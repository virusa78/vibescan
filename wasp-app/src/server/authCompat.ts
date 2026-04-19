import type { Request, Response } from "express";

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
    let body = {};
    if (request.body) {
      try {
        body = typeof request.body === "string"
          ? JSON.parse(request.body)
          : request.body;
      } catch (parseError) {
        // Return 400 for invalid JSON
        return response.status(400).json({
          error: "validation_error",
          message: "Invalid JSON in request body",
        });
      }
    }

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
    response.status(500).json({
      error: "internal_error",
      message: error instanceof Error ? error.message : "Auth compatibility proxy failed",
    });
  }
}

export async function emailSignupCompatApi(request: Request, response: Response, _context: any) {
  await proxyAuthRequest(request, response, "/auth/signup");
}

export async function emailLoginCompatApi(request: Request, response: Response, _context: any) {
  await proxyAuthRequest(request, response, "/auth/login");
}
