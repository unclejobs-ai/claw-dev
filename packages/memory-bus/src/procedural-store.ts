/**
 * Procedural memory — filesystem .unclecode/sop/<peer>/<slug>.md.
 * SOPs are agent-readable how-to knowledge that survives across runs and
 * should be promoted from successful reflections (Walnut pattern).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { Peer } from "@unclecode/contracts";

import { encodePeer } from "./peer-registry.js";

export type SopEntry = {
  readonly peer: Peer;
  readonly slug: string;
  readonly content: string;
  readonly path: string;
};

function sanitizeSlug(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

function sopDirForPeer(workspaceRoot: string, peer: Peer): string {
  const peerKey = sanitizeSlug(encodePeer(peer));
  return join(workspaceRoot, ".unclecode", "sop", peerKey);
}

export function writeSop(input: { workspaceRoot: string; peer: Peer; slug: string; content: string }): SopEntry {
  const dir = sopDirForPeer(input.workspaceRoot, input.peer);
  mkdirSync(dir, { recursive: true });
  const slug = sanitizeSlug(input.slug);
  const path = join(dir, `${slug}.md`);
  writeFileSync(path, input.content);
  return { peer: input.peer, slug, content: input.content, path };
}

export function readSop(input: { workspaceRoot: string; peer: Peer; slug: string }): SopEntry | undefined {
  const dir = sopDirForPeer(input.workspaceRoot, input.peer);
  const slug = sanitizeSlug(input.slug);
  const path = join(dir, `${slug}.md`);
  if (!existsSync(path)) return undefined;
  return { peer: input.peer, slug, content: readFileSync(path, "utf8"), path };
}

export function listSops(input: { workspaceRoot: string; peer: Peer }): ReadonlyArray<SopEntry> {
  const dir = sopDirForPeer(input.workspaceRoot, input.peer);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => {
      const path = join(dir, entry);
      return {
        peer: input.peer,
        slug: entry.replace(/\.md$/, ""),
        content: readFileSync(path, "utf8"),
        path,
      };
    });
}
