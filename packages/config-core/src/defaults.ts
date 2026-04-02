import { MODE_PROFILES } from "@unclecode/contracts";
import type { ModeProfile, ModeProfileId } from "@unclecode/contracts";

import type {
  ConfigSourceDefinition,
  UncleCodeConfigLayer,
  UncleCodePromptSection,
} from "./types.js";

export const CONFIG_SOURCE_ORDER = [
  { id: "built-in-defaults", label: "built-in defaults" },
  { id: "built-in-mode-profile", label: "built-in mode profile" },
  { id: "plugin-overlay", label: "plugin overlay" },
  { id: "project-config", label: "project config" },
  { id: "user-config", label: "user config" },
  { id: "environment", label: "environment" },
  { id: "cli-flags", label: "cli flags" },
  { id: "session-overrides", label: "session overrides" },
] as const satisfies readonly ConfigSourceDefinition[];

export const CONFIG_CORE_DEFAULT_MODE_PROFILE = MODE_PROFILES.default.id;
export const CONFIG_CORE_DEFAULT_MODEL = "claude-sonnet-4-20250514";

export const CONFIG_CORE_DEFAULTS: UncleCodeConfigLayer = {
  mode: CONFIG_CORE_DEFAULT_MODE_PROFILE,
  model: CONFIG_CORE_DEFAULT_MODEL,
  prompt: {
    sections: {
      identity: {
        title: "Identity",
        body: "You are UncleCode. Complete the assigned task and stay inside the requested scope.",
      },
      execution: {
        title: "Execution",
        body: "Prefer concrete evidence, preserve source precedence, and explain where final values came from.",
      },
    },
  },
};

function buildActiveModeSection(profile: ModeProfile): UncleCodePromptSection {
  return {
    title: "Active Mode",
    body: [
      `${profile.label} mode is active.`,
      `editing: ${profile.editing}`,
      `search depth: ${profile.searchDepth}`,
      `background tasks: ${profile.backgroundTasks}`,
      `explanation style: ${profile.explanationStyle}`,
    ].join("\n"),
  };
}

export function getModeProfile(modeId: ModeProfileId): ModeProfile {
  return MODE_PROFILES[modeId];
}

export function buildModeProfileOverlay(modeId: ModeProfileId): UncleCodeConfigLayer {
  const profile = getModeProfile(modeId);

  return {
    behavior: {
      editing: profile.editing,
      searchDepth: profile.searchDepth,
      backgroundTasks: profile.backgroundTasks,
      explanationStyle: profile.explanationStyle,
    },
    prompt: {
      sections: {
        "active-mode": buildActiveModeSection(profile),
      },
    },
  };
}
