import { MCP_TRANSPORTS } from "@unclecode/contracts";
import type { McpTransport } from "@unclecode/contracts";

export interface McpHostDescriptor {
  readonly serverName: string;
  readonly transport: Extract<McpTransport, "stdio" | "http">;
}

export const MCP_HOST_SUPPORTED_TRANSPORTS = MCP_TRANSPORTS;
