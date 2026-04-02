import type { OpenAIAuthStatus } from "./types.js";
export declare function resolveOpenAIAuthStatus(options?: {
    readonly env?: NodeJS.ProcessEnv;
}): Promise<OpenAIAuthStatus>;
export declare function formatOpenAIAuthStatus(status: OpenAIAuthStatus): string;
//# sourceMappingURL=openai-status.d.ts.map