/**
 * Candidate generator — given a list of localized regions, produce N
 * patch candidates by querying the model. The model client is injected,
 * keeping this module unit-testable with a deterministic stub.
 *
 * Each candidate is a unified diff. Validation (compile + tests) happens in
 * patch-validator.ts; this module is purely "generate".
 */

import type { LocalizationCandidate } from "./localize-hierarchical.js";

export type PatchCandidate = {
  readonly id: string;
  readonly diff: string;
  readonly rationale: string;
};

export interface PatchProposalClient {
  propose(input: {
    readonly issue: string;
    readonly region: LocalizationCandidate;
    readonly nCandidates: number;
  }): Promise<ReadonlyArray<PatchCandidate>>;
}

export type GenerateInput = {
  readonly issue: string;
  readonly regions: ReadonlyArray<LocalizationCandidate>;
  readonly perRegion?: number;
  readonly maxTotal?: number;
};

export async function generateCandidates(
  input: GenerateInput,
  client: PatchProposalClient,
): Promise<ReadonlyArray<PatchCandidate>> {
  const perRegion = input.perRegion ?? 3;
  const maxTotal = input.maxTotal ?? 8;
  const candidates: PatchCandidate[] = [];
  for (const region of input.regions) {
    if (candidates.length >= maxTotal) break;
    const proposed = await client.propose({
      issue: input.issue,
      region,
      nCandidates: perRegion,
    });
    for (const candidate of proposed) {
      candidates.push(candidate);
      if (candidates.length >= maxTotal) break;
    }
  }
  return candidates;
}
