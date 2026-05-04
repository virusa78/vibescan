import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from "./http/requestGuards";
import { sendOperationError } from "./http/httpErrors";
import { getBackendBaseUrl } from "./config/runtime.js";
function resolveBackendBaseUrl(request) {
    const configuredBaseUrl = getBackendBaseUrl();
    const forwardedProto = request.headers["x-forwarded-proto"];
    const protocol = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto?.split(",")[0] ?? request.protocol;
    const host = request.get("host");
    if (host && configuredBaseUrl === "http://127.0.0.1:3555") {
        return `${protocol}://${host}`.replace(/\/$/, "");
    }
    return configuredBaseUrl;
}
async function proxyAuthRequest(request, response, targetPath) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
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
    }
    catch (error) {
        sendOperationError("auth-compat", error, response);
    }
}
export async function emailSignupCompatApi(request, response, _context) {
    await proxyAuthRequest(request, response, "/auth/signup");
}
export async function emailLoginCompatApi(request, response, _context) {
    await proxyAuthRequest(request, response, "/auth/login");
}
//# sourceMappingURL=authCompat.js.map