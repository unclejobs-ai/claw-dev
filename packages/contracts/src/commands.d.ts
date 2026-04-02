import type { ModeProfileId } from "./modes.js";
export declare const COMMAND_TYPES: readonly ["prompt", "local", "local-jsx"];
export type CommandType = (typeof COMMAND_TYPES)[number];
export declare const COMMAND_SOURCES: readonly ["builtin", "mcp", "plugin", "bundled", "skills", "managed"];
export type CommandSource = (typeof COMMAND_SOURCES)[number];
export declare const COMMAND_AVAILABILITY: readonly ["claude-ai", "console"];
export type CommandAvailability = (typeof COMMAND_AVAILABILITY)[number];
export type CommandMetadata = {
    readonly name: string;
    readonly description: string;
    readonly type: CommandType;
    readonly source: CommandSource;
    readonly aliases?: readonly string[];
    readonly argumentHint?: string;
    readonly whenToUse?: string;
    readonly version?: string;
    readonly availability?: readonly CommandAvailability[];
    readonly userInvocable?: boolean;
    readonly disableModelInvocation?: boolean;
    readonly immediate?: boolean;
    readonly isSensitive?: boolean;
};
export declare const SKILL_SOURCES: readonly ["skills", "bundled", "plugin", "mcp"];
export type SkillSource = (typeof SKILL_SOURCES)[number];
export type SkillMetadata = {
    readonly name: string;
    readonly description: string;
    readonly source: SkillSource;
    readonly version?: string;
    readonly commandType?: Extract<CommandType, "prompt">;
    readonly modeProfile?: ModeProfileId;
    readonly paths?: readonly string[];
};
//# sourceMappingURL=commands.d.ts.map