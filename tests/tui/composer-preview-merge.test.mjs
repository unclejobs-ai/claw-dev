import test from "node:test";
import assert from "node:assert/strict";

import { dedupAttachmentsByDataUrl } from "@unclecode/tui";

/**
 * Regression — useWorkShellComposerPreview must merge clipboard-pasted
 * attachments with text-derived attachments WITHOUT losing one when the
 * other refreshes. Memo §4 step 2 / Q1+Q2 from
 * docs/plans/team-20260429-113220-image-attachment-flow.md.
 *
 * The hook itself uses React state and would need an Ink/React harness to
 * exercise end-to-end. The pure dedup helper that backs the merge is the
 * critical invariant — we import it directly so a future drift in the
 * production helper is caught here, not only at integration time.
 */

const A = { type: "image", mimeType: "image/png", dataUrl: "data:image/png;base64,A==", path: "(clipboard)", displayName: "a.png" };
const B = { type: "image", mimeType: "image/png", dataUrl: "data:image/png;base64,B==", path: "(clipboard)", displayName: "b.png" };
const A_DUP = { ...A, displayName: "a-renamed.png" };

test("dedup preserves first occurrence and drops byte-equal duplicates", () => {
  const merged = dedupAttachmentsByDataUrl([A, B, A_DUP]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.displayName, "a.png", "first occurrence keeps its display name even if a later copy renames");
  assert.equal(merged[1]?.dataUrl, "data:image/png;base64,B==");
});

test("dedup is order-stable when there are no duplicates", () => {
  const merged = dedupAttachmentsByDataUrl([A, B]);
  assert.deepEqual(merged.map((m) => m.dataUrl), [A.dataUrl, B.dataUrl]);
});

test("dedup handles an empty list", () => {
  assert.deepEqual(dedupAttachmentsByDataUrl([]), []);
});

test("dedup preserves text-derived attachments before pending clipboard ones", () => {
  // Production order: spread([...preview.attachments, ...pending]). Text-derived
  // come first; clipboard pasted are appended. The merge order matters because
  // the user's prompt may reference a filename that resolves to a text-derived
  // attachment that should appear first in the eventual provider payload.
  const textDerived = [A];
  const pending = [B, A_DUP];
  const merged = dedupAttachmentsByDataUrl([...textDerived, ...pending]);
  assert.deepEqual(
    merged.map((m) => m.dataUrl),
    [A.dataUrl, B.dataUrl],
    "text-derived attachments come before clipboard ones; clipboard duplicates of text-derived are dropped",
  );
});
