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
  const shared = `Keep replies ${profile.explanationStyle} and operator-friendly.`;

  if (profile.id === "search") {
    return {
      title: "Active Mode",
      body: [
        "Search mode is active.",
        "Stay read-only and do not edit files.",
        "If the user asks for edits, answer in at most two short lines and suggest `/mode set yolo` or `/mode set default`.",
        shared,
      ].join("\n"),
    };
  }

  if (profile.id === "analyze") {
    return {
      title: "Active Mode",
      body: [
        "Analyze mode is active.",
        "Prefer diagnosis, evidence, and concrete next steps before edits.",
        "If editing is needed, say so briefly and suggest `/mode set yolo` or `/mode set default`.",
        shared,
      ].join("\n"),
    };
  }

  if (profile.id === "ultrawork") {
    return {
      title: "Active Mode",
      body: [
        "Ultra Work mode is active.",
        "Edit directly, use deeper search, and prefer background or parallel work when it helps.",
        shared,
      ].join("\n"),
    };
  }

  if (profile.id === "yolo") {
    return {
      title: "Active Mode",
      body: [
        "YOLO mode is active.",
        "Edit directly on clear requests and avoid needless confirmation on low-risk reversible steps.",
        shared,
      ].join("\n"),
    };
  }

  return {
    title: "Active Mode",
    body: [
      "Default mode is active.",
      "Edit when needed, but stay inside scope and use balanced search depth.",
      shared,
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
