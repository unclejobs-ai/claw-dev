export declare const MCP_CONFIG_SCOPES: readonly ["local", "user", "project", "dynamic", "enterprise", "claudeai", "managed"];
export type McpConfigScope = (typeof MCP_CONFIG_SCOPES)[number];
export declare const MCP_TRANSPORTS: readonly ["stdio", "sse", "sse-ide", "http", "ws", "sdk", "claudeai-proxy"];
export type McpTransport = (typeof MCP_TRANSPORTS)[number];
export declare const MCP_CONNECTION_STATES: readonly ["connected", "failed", "needs-auth", "pending", "disabled"];
export type McpConnectionState = (typeof MCP_CONNECTION_STATES)[number];
export type McpOAuthConfig = {
    readonly clientId?: string;
    readonly callbackPort?: number;
    readonly authServerMetadataUrl?: string;
    readonly xaa?: boolean;
};
export type McpServerConfig = {
    readonly type: "stdio";
    readonly command: string;
    readonly args?: readonly string[];
    readonly env?: Record<string, string>;
} | {
    readonly type: "sse" | "http";
    readonly url: string;
    readonly headers?: Record<string, string>;
    readonly headersHelper?: string;
    readonly oauth?: McpOAuthConfig;
} | {
    readonly type: "sse-ide";
    readonly url: string;
    readonly ideName: string;
    readonly ideRunningInWindows?: boolean;
} | {
    readonly type: "ws";
    readonly url: string;
    readonly headers?: Record<string, string>;
    readonly headersHelper?: string;
} | {
    readonly type: "sdk";
    readonly name: string;
} | {
    readonly type: "claudeai-proxy";
    readonly url: string;
    readonly id: string;
};
export type ScopedMcpServerConfig = McpServerConfig & {
    readonly scope: McpConfigScope;
    readonly pluginSource?: string;
};
export type McpCapabilityManifest = {
    readonly name: string;
    readonly transport: McpTransport;
    readonly scope: McpConfigScope;
    readonly connectionState: McpConnectionState;
    readonly supportsTools: boolean;
    readonly supportsResources: boolean;
    readonly supportsPrompts: boolean;
    readonly supportsLogging?: boolean;
    readonly instructions?: string;
    readonly serverInfo?: {
        readonly name: string;
        readonly version: string;
    };
    readonly normalizedNames?: Record<string, string>;
};
//# sourceMappingURL=mcp.d.ts.map