/**
 * Peer registry — Honcho-style entity model. Every observation, query, and
 * memory write addresses a Peer. Encoding is reversible, so the registry can
 * round-trip a peer through stable string IDs (filesystem, env, log lines).
 */

import type { Peer, PeerKind, PersonaId } from "@unclecode/contracts";

const ENCODER_BY_KIND: Record<PeerKind, (peer: Peer) => string> = {
  user: (peer) => `user:${peer.kind === "user" ? peer.id : ""}`,
  agent: (peer) => `agent:${peer.kind === "agent" ? peer.persona : ""}`,
  team: (peer) => `team:${peer.kind === "team" ? peer.runId : ""}`,
  run: (peer) => `run:${peer.kind === "run" ? peer.runId : ""}`,
};

export function encodePeer(peer: Peer): string {
  return ENCODER_BY_KIND[peer.kind](peer);
}

export function decodePeer(text: string): Peer {
  const colonIndex = text.indexOf(":");
  if (colonIndex < 0) {
    throw new Error(`Invalid peer encoding (missing colon): ${text}`);
  }
  const kind = text.slice(0, colonIndex) as PeerKind;
  const value = text.slice(colonIndex + 1);
  switch (kind) {
    case "user":
      return { kind: "user", id: value };
    case "agent":
      return { kind: "agent", persona: value as PersonaId };
    case "team":
      return { kind: "team", runId: value };
    case "run":
      return { kind: "run", runId: value };
    default:
      throw new Error(`Unknown peer kind: ${kind}`);
  }
}

export function peersEqual(a: Peer, b: Peer): boolean {
  return encodePeer(a) === encodePeer(b);
}
