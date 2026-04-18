import type { Request, Response } from "express";

function getBaseUrl(request: Request): string {
  const host = request.get("host") || `127.0.0.1:${process.env.PORT || "3001"}`;
  const protocol = request.protocol || "http";
  return `${protocol}://${host}`;
}

async function proxyAuthRequest(
  request: Request,
  response: Response,
  targetPath: "/auth/register" | "/auth/login",
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

    const upstream = await fetch(`${getBaseUrl(request)}${targetPath}`, {
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
  await proxyAuthRequest(request, response, "/auth/register");
}

export async function emailLoginCompatApi(request: Request, response: Response, _context: any) {
  await proxyAuthRequest(request, response, "/auth/login");
}
