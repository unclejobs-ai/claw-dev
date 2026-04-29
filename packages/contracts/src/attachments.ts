/**
 * Attachment payloads handed across the work-shell composer surface.
 * Promoted from packages/orchestrator/src/clipboard-image.ts so providers,
 * the TUI composer, and any future bridge can share a single shape.
 */

export type ClipboardImageAttachment = {
  readonly type: "image";
  readonly mimeType: string;
  readonly dataUrl: string;
  /**
   * Display-only identifier for the source of the bytes (e.g. "(clipboard)").
   * Consumers MUST NOT treat this as a filesystem path — temp files used to
   * materialise the PNG bytes are removed before the attachment is returned,
   * and Linux never produces a stable path. Read bytes from `dataUrl`.
   */
  readonly path: string;
  readonly displayName: string;
};

export type ClipboardImageError = {
  readonly status: "no-image" | "unsupported" | "failed";
  readonly reason: string;
};

export type ClipboardImageResult =
  | { readonly status: "ok"; readonly attachment: ClipboardImageAttachment }
  | ClipboardImageError;
