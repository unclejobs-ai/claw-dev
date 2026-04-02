import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
function normalizeCredential(value) {
    const trimmed = String(value ?? "").trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed.length === 0 ||
        normalized === "changeme" ||
        normalized.startsWith("your_") ||
        normalized.startsWith("example_") ||
        normalized.includes("api_key_here") ||
        normalized.includes("token_here")) {
        return "";
    }
    return trimmed;
}
function defaultFallbackAuthPath() {
    return path.join(homedir(), ".unclecode", "credentials", "openai.json");
}
function getJwtExpiry(token) {
    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        return typeof payload.exp === "number" ? payload.exp : null;
    }
    catch {
        return null;
    }
}
function isExpired(token) {
    const exp = getJwtExpiry(token);
    if (exp === null) {
        return false;
    }
    return exp <= Math.floor(Date.now() / 1000) + 60;
}
export async function resolveOpenAIAuth(input = {}) {
    const env = input.env ?? process.env;
    const authToken = normalizeCredential(env.OPENAI_AUTH_TOKEN);
    if (authToken) {
        return {
            status: "ok",
            authType: "oauth",
            source: "env-openai-auth-token",
            bearerToken: authToken,
        };
    }
    const apiKey = normalizeCredential(env.OPENAI_API_KEY);
    if (apiKey) {
        return {
            status: "ok",
            authType: "api-key",
            source: "env-openai-api-key",
            bearerToken: apiKey,
        };
    }
    const readFallbackFile = input.readFallbackFile ?? (() => readFile(input.fallbackAuthPath ?? defaultFallbackAuthPath(), "utf8"));
    try {
        const parsed = JSON.parse(await readFallbackFile());
        const accessToken = normalizeCredential(parsed?.accessToken);
        const refreshToken = normalizeCredential(parsed?.refreshToken);
        if (!accessToken) {
            return {
                status: "missing",
                authType: "none",
                source: "none",
                reason: "auth-token-missing",
            };
        }
        if (isExpired(accessToken)) {
            return refreshToken
                ? {
                    status: "missing",
                    authType: "none",
                    source: "none",
                    reason: "auth-refresh-required",
                }
                : {
                    status: "expired",
                    authType: "oauth",
                    source: "unclecode-auth-file",
                    reason: "auth-token-expired",
                };
        }
        return {
            status: "ok",
            authType: "oauth",
            source: "unclecode-auth-file",
            bearerToken: accessToken,
        };
    }
    catch {
        return {
            status: "missing",
            authType: "none",
            source: "none",
            reason: "auth-file-missing",
        };
    }
}
//# sourceMappingURL=openai-auth.js.map