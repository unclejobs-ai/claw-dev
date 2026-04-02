import type { PolicyDecision, PolicyRequest } from "./types.js";

function toOverrideRule(request: PolicyRequest): string {
  return `override.${request.intent}`;
}

export function applyOverrideDecision(
  request: PolicyRequest,
  currentDecision: PolicyDecision,
): PolicyDecision {
  const sessionEffect = request.overrides?.session?.[request.intent];

  if (sessionEffect !== undefined) {
    return {
      effect: sessionEffect,
      source: "sessionOverride",
      reason: `Session override forced ${sessionEffect} for ${request.intent}.`,
      matchedRule: toOverrideRule(request),
    };
  }

  const userEffect = request.overrides?.user?.[request.intent];

  if (userEffect !== undefined) {
    return {
      effect: userEffect,
      source: "userOverride",
      reason: `User override forced ${userEffect} for ${request.intent}.`,
      matchedRule: toOverrideRule(request),
    };
  }

  return currentDecision;
}
