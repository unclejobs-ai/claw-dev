import { assembleContextPacket } from "./context-packet.js";
import type { ResearchBundle, ResearchBundleOptions } from "./types.js";

export async function prepareResearchBundle(
  options: ResearchBundleOptions,
): Promise<ResearchBundle> {
  return {
    packet: await assembleContextPacket({
      rootDir: options.rootDir,
      mode: "search",
      ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
      trigger: "research",
    }),
    relatedMemories: options.relatedMemories ?? [],
    hypotheses: options.hypotheses ?? [],
    artifactsDir: options.artifactsDir,
  };
}
