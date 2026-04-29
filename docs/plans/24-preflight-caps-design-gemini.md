# Pre-flight Caps for Clipboard Attachments — Gemini Design Perspective

**Task:** #24 — Pre-flight caps for `pendingClipboardAttachments`
**Date:** 2026-04-29
**Author:** Gemini design review coordinator (independent of Codex parallel lane)

---

## Context anchors

- `work-shell-hooks.ts:358–368` — `pendingClipboardAttachments` is unbounded `useState<readonly Attachment[]>`. `addClipboardAttachment` only deduplicates by `dataUrl`; no size or count guard.
- `composer.tsx:186–204` — `handleComposerClipboardPaste` is the capture site. It fires `onClipboardImage` synchronously; the result lands in pane state before any policy check.
- Memo step 3: "5 images × 5 MB ceiling at the pane setter."

---

## Q1 — Is "5 × 5 MB" hardcoded or policy-driven?

**No, it should not be hardcoded.** The 5 MB figure is a heuristic based on current provider vision limits; those limits change across Anthropic, OpenAI, and Gemini. The count limit (5) maps loosely to context-window cost, which also differs by model.

**Recommended placement:** `packages/config-core/src/types.ts`, under a new `UncleCodeConfigLayer.composer` sub-key:

```ts
readonly composer?: {
  readonly maxClipboardAttachmentCount?: number;   // default 5
  readonly maxClipboardAttachmentBytes?: number;   // default 5_242_880
};
```

The `defaults.ts` sets `CONFIG_CORE_DEFAULTS.composer` to the `5 × 5 MB` numbers. User config (YAML layer) and `session-overrides` can override — the existing `ConfigSourceId` precedence chain already handles it. The cap values then flow into `work-shell-hooks.ts` via an existing config resolver call, not as magic constants.

This approach costs one new sub-key and keeps the policy auditable and overridable without a code change.

---

## Q2 — Toast vs. persistent badge for cap rejection

**Persistent badge wins.** A transient toast requires timing precision: arrive too briefly and a user composing a long message misses it; arrive too long and it clutters the output stream. The composer is already a bounded strip — a compact inline indicator (`[5/5 images]`, dimmed when under cap, bold-warning color at cap) keeps the constraint visible and scannable without demanding attention.

The badge has a second benefit: it functions as a count indicator even before the cap is hit, so users know how many slots remain. That is zero-latency ambient feedback, not an interrupt.

For hard rejection (count or bytes over cap), add one ephemeral line appended to the composer status area ("Attachment cap reached — submit or remove one") that auto-clears on the next keypress. This is not a full toast; it is a one-line annotation directly adjacent to where the user is acting.

---

## Q3 — Flat rejection vs. FIFO eviction

**Flat rejection.** FIFO eviction silently discards prior user intent. If a user pinned a specific screenshot as context for their prompt and a newer paste evicts it without warning, the model receives different input than the user intended — a correctness hazard more serious than the cap itself.

Flat rejection with the inline badge (Q2) keeps user intent intact. The user sees the cap, decides which existing attachment to remove, then pastes the new one. That is more cognitive work but preserves the invariant that the attachment list reflects deliberate user choices, not recency.

Edge case: if a future power-user mode warrants FIFO (e.g., a streaming "always take latest N frames" scenario), that should be an explicit opt-in policy value, not the default behavior.

---

## Q4 — TUI concern vs. orchestrator/provider boundary

**The cap is a TUI concern, but the bytes check should be enforced again at the provider boundary.** These are complementary, not competing:

- **TUI layer (`addClipboardAttachment` in `work-shell-hooks.ts`):** enforce count cap and a soft byte check. This is the right UX gate — the user is still at the keyboard and can react. Enforcing here prevents ballooning in-memory state before a submit.
- **Provider boundary:** enforce a hard byte limit as a defensive invariant. The provider boundary sees the final merged attachment list from `resolveComposerInput` + clipboard, so it is the authoritative last line of defense against accidentally oversized payloads escaping the process. This guard is silent (throw/log, not UI), not a UX gate.

Putting the only cap at the orchestrator/provider layer is wrong for UX: the user would compose a full prompt, hit submit, and get a rejection at turn execution time rather than at paste time. That breaks flow far more severely than an inline badge.

---

## Q5 — Scale client-side vs. flat reject for oversized images

**Flat reject.** Introducing `sharp` or `canvas` for client-side scaling adds a native binary dependency (`better-sqlite3` already caused an ABI mismatch on Node 25 in this repo — see team parallel lane). The TUI is a CLI tool, not an image editor. The cost/benefit is wrong:

- Node sharp requires native `libvips`; canvas requires `libcairo`. Both inflate install size and break on ARM/musl more often than x86 glibc.
- The failure mode for a "scale and submit" path is subtle: the model receives a lower-resolution image than the user captured, potentially losing detail they needed. Transparent degradation is a correctness trap.

**Recommended UX for rejection:** append to the one-line status area: "Image too large (8.2 MB, max 5 MB) — screenshot a smaller area or crop first." This puts resolution in the user's hands with concrete numbers, no new dependencies.

---

## Recommended layering summary

```
config-core (types.ts + defaults.ts)
    ↓ resolved cap values
work-shell-hooks.ts addClipboardAttachment
    → count check: flat reject + inline badge
    → byte check: flat reject + one-line annotation
    ↓ verified attachment list
composer.tsx (capture site — no policy logic here)
    ↓
provider boundary (packages/providers)
    → hard byte check as defensive invariant (no UI)
```

No changes to `handleComposerClipboardPaste` in `composer.tsx` — that function is correctly policy-free; it is a pure capture-and-route handler.
