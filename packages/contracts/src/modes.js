export const MODE_PROFILE_IDS = ["default", "ultrawork", "search", "analyze"];
export const MODE_EDITING_POLICIES = ["allowed", "reviewed", "forbidden"];
export const MODE_SEARCH_DEPTHS = ["balanced", "deep"];
export const MODE_BACKGROUND_TASK_POLICIES = ["allowed", "preferred", "forbidden"];
export const MODE_EXPLANATION_STYLES = ["concise", "balanced", "detailed"];
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
};
//# sourceMappingURL=modes.js.map