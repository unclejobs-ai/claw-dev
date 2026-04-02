import { resolveOpenAIAuth } from "./openai-auth.js";
export async function resolveOpenAIAuthStatus(options = {}) {
    const env = options.env ?? process.env;
    const auth = await resolveOpenAIAuth({ env });
    return {
        providerId: "openai",
        activeSource: auth.source === "env-openai-api-key"
            ? "api-key-env"
            : auth.source === "unclecode-auth-file"
                ? "oauth-file"
                : "none",
        authType: auth.authType,
        organizationId: String(env.OPENAI_ORG_ID ?? "").trim() || null,
        projectId: String(env.OPENAI_PROJECT_ID ?? "").trim() || null,
        expiresAt: null,
        isExpired: auth.status === "expired",
    };
}
export function formatOpenAIAuthStatus(status) {
    return [
        `provider: ${status.providerId}`,
        `source: ${status.activeSource}`,
        `auth: ${status.authType}`,
        `organization: ${status.organizationId ?? "none"}`,
        `project: ${status.projectId ?? "none"}`,
        `expiresAt: ${status.expiresAt ?? "none"}`,
        `expired: ${status.isExpired ? "yes" : "no"}`,
    ].join("\n");
}
//# sourceMappingURL=openai-status.js.map