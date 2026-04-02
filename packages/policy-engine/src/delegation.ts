import type { PolicyDecision, PolicyDecisionEffect, PolicyRequest } from "./types.js";

const EFFECT_RANK: Readonly<Record<PolicyDecisionEffect, number>> = {
  allow: 0,
  prompt: 1,
  deny: 2,
};

function escalateEffect(effect: PolicyDecisionEffect): PolicyDecisionEffect {
  switch (effect) {
    case "allow":
      return "prompt";
    case "prompt":
      return "deny";
    case "deny":
    default:
      return "deny";
  }
}

export function getPolicyEffectRank(effect: PolicyDecisionEffect): number {
  return EFFECT_RANK[effect];
}

export function applyDelegationDecision(
  request: PolicyRequest,
  currentDecision: PolicyDecision,
): PolicyDecision {
  if (request.actor !== "subagent") {
    return currentDecision;
  }

  const allowedIntents = request.delegation?.allowedIntents ?? [];

  if (allowedIntents.includes(request.intent)) {
    return currentDecision;
  }

  const effect = escalateEffect(currentDecision.effect);

  return {
    effect,
    source: "delegation",
    reason: `Subagent authority is reduced by default for ${request.intent}.`,
    matchedRule: `${currentDecision.matchedRule}.delegation`,
  };
}
