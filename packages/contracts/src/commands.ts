import type { ModeProfileId } from "./modes.js";

export const COMMAND_TYPES = ["prompt", "local", "local-jsx"] as const;

export type CommandType = (typeof COMMAND_TYPES)[number];

export const COMMAND_SOURCES = [
  "builtin",
  "mcp",
  "plugin",
  "bundled",
  "skills",
  "managed",
] as const;

export type CommandSource = (typeof COMMAND_SOURCES)[number];

export const COMMAND_AVAILABILITY = ["claude-ai", "console"] as const;

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

export const SKILL_SOURCES = ["skills", "bundled", "plugin", "mcp"] as const;

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
