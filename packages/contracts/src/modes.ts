export const MODE_PROFILE_IDS = ["default", "ultrawork", "search", "analyze"] as const;

export type ModeProfileId = (typeof MODE_PROFILE_IDS)[number];

export const MODE_EDITING_POLICIES = ["allowed", "reviewed", "forbidden"] as const;

export type ModeEditingPolicy = (typeof MODE_EDITING_POLICIES)[number];

export const MODE_SEARCH_DEPTHS = ["balanced", "deep"] as const;

export type ModeSearchDepth = (typeof MODE_SEARCH_DEPTHS)[number];

export const MODE_BACKGROUND_TASK_POLICIES = ["allowed", "preferred", "forbidden"] as const;

export type ModeBackgroundTaskPolicy = (typeof MODE_BACKGROUND_TASK_POLICIES)[number];

export const MODE_EXPLANATION_STYLES = ["concise", "balanced", "detailed"] as const;

export type ModeExplanationStyle = (typeof MODE_EXPLANATION_STYLES)[number];

export type ModeProfile = {
  readonly id: ModeProfileId;
  readonly label: string;
  readonly editing: ModeEditingPolicy;
  readonly searchDepth: ModeSearchDepth;
  readonly backgroundTasks: ModeBackgroundTaskPolicy;
  readonly explanationStyle: ModeExplanationStyle;
};

export const MODE_PROFILES = {
  default: {
    id: "default",
    label: "Default",
    editing: "allowed",
    searchDepth: "balanced",
    backgroundTasks: "allowed",
    explanationStyle: "balanced",
  },
  ultrawork: {
    id: "ultrawork",
    label: "Ultra Work",
    editing: "allowed",
    searchDepth: "deep",
    backgroundTasks: "preferred",
    explanationStyle: "concise",
  },
  search: {
    id: "search",
    label: "Search",
    editing: "forbidden",
    searchDepth: "deep",
    backgroundTasks: "preferred",
    explanationStyle: "concise",
  },
  analyze: {
    id: "analyze",
    label: "Analyze",
    editing: "reviewed",
    searchDepth: "balanced",
    backgroundTasks: "allowed",
    explanationStyle: "detailed",
  },
} as const satisfies Readonly<Record<ModeProfileId, ModeProfile>>;
