/**
 * Worker stdout contract — the legacy 4-line envelope TeamRunner expects
 * regardless of which lane adapter produced the submission.
 *
 *   WORKER_ID=<id>
 *   PERSONA=<persona>
 *   SUBMISSION:<text up to cap chars, "…" suffix on overflow>
 *   <submit-marker>
 *
 * Adapters return free-form submission text; the worker subprocess passes
 * it through this formatter so the runner sees the same shape it always
 * has, no matter the underlying runtime (SDK / Cursor / Codex / etc.).
 */

export type WorkerEnvelopeArgs = {
  readonly workerId: string;
  readonly persona: string;
  readonly submission: string;
  readonly submitMarker: string;
  readonly submissionCap?: number;
};

const DEFAULT_SUBMISSION_CAP = 4096;

function truncate(text: string, cap: number): string {
  return text.length <= cap ? text : `${text.slice(0, cap)}…`;
}

export function formatWorkerEnvelope(args: WorkerEnvelopeArgs): string {
  const cap = args.submissionCap ?? DEFAULT_SUBMISSION_CAP;
  return [
    `WORKER_ID=${args.workerId}`,
    `PERSONA=${args.persona}`,
    `SUBMISSION:${truncate(args.submission, cap)}`,
    args.submitMarker,
  ].join("\n");
}
