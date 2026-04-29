#!/usr/bin/env bash
# Fan out team-run lanes in parallel, capture outputs to canonical paths.
# Usage: bash scripts/team-run.sh <RUN_ID> <ownership_json_path>
# Deps:  hermes, codex (PATH), timeout (GNU coreutils)
set -euo pipefail

# Hermes oneshot does not auto-load ~/.hermes/.env; it only reads from
# process env. Pull KEY=VAL lines (skipping comments and bare 'export'
# prefixes) into this process so the GLM/Kimi/etc lanes work without a
# shell-rc export. Failure is non-fatal — lanes that need a missing key
# will be marked BLOCKED downstream rather than aborting the whole run.
HERMES_ENV="$HOME/.hermes/.env"
if [[ -f "$HERMES_ENV" ]]; then
  while IFS='=' read -r key val; do
    case "$key" in
      ''|\#*) continue ;;
      *[!A-Z0-9_]*) continue ;;
    esac
    [[ -z "${!key:-}" ]] && export "$key=$val"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "$HERMES_ENV")
fi

RUN_ID="${1:?Usage: team-run.sh <RUN_ID> <ownership_json_path>}"
OWNERSHIP="${2:?Usage: team-run.sh <RUN_ID> <ownership_json_path>}"
RUN_ROOT="$HOME/.data/team-runs/$RUN_ID"
PROMPTS="$RUN_ROOT/shared/lane-prompts"
STATUS_LOG="$RUN_ROOT/shared/lane-status.jsonl"

[[ -f "$OWNERSHIP" ]] || { echo "ERROR: $OWNERSHIP not found" >&2; exit 1; }

pids=(); lanes=()

# Helper: spawn a lane in background. Args: lane-name  cmd [args...]
# The prompt file content is passed as the final positional argument to cmd.
spawn() {
  local lane="$1"; shift
  local pfile="$PROMPTS/$lane.txt"
  local outdir="$RUN_ROOT/$lane"; mkdir -p "$outdir"
  if [[ ! -f "$pfile" ]]; then
    echo "BLOCKED: $pfile not found" > "$outdir/output.txt"
    echo "{\"lane\":\"$lane\",\"status\":\"blocked\",\"reason\":\"prompt file not found\"}" >> "$STATUS_LOG"
    return
  fi
  local prompt; prompt="$(cat "$pfile")"
  ( timeout "${TIMEOUT_SECS:-300}" "$@" "$prompt" \
      > "$outdir/output.txt" 2>&1; echo "exit:$?" >> "$outdir/output.txt" ) &
  pids+=($!); lanes+=("$lane")
}

# --- Lane dispatch ---
spawn hermes         hermes -z
spawn hermes-coder   hermes -p coder -z

if [[ -n "${GLM_API_KEY:-}" ]]; then
  spawn hermes-glmbuilder hermes -p glmbuilder -z
else
  mkdir -p "$RUN_ROOT/hermes-glmbuilder"
  echo "BLOCKED: GLM_API_KEY not set" > "$RUN_ROOT/hermes-glmbuilder/output.txt"
  echo '{"lane":"hermes-glmbuilder","status":"blocked","reason":"GLM_API_KEY not set"}' >> "$STATUS_LOG"
fi

TIMEOUT_SECS=600 spawn codex codex exec

# --- Wait and report ---
echo "Waiting for ${#pids[@]} lane(s): ${lanes[*]:-none}"
for i in "${!pids[@]}"; do
  wait "${pids[$i]}" && st=completed || st=failed
  lane="${lanes[$i]}"
  out="$RUN_ROOT/$lane/output.txt"
  echo "{\"lane\":\"$lane\",\"status\":\"$st\"}" >> "$STATUS_LOG"
  echo "[$lane] $st — $(wc -l < "$out") lines → $out"
done

echo "Done. RUN_ID=$RUN_ID  lane-status=$STATUS_LOG"
echo "Synthesizer: read $RUN_ROOT/<lane>/output.txt, reconcile with $STATUS_LOG, update manifest."
