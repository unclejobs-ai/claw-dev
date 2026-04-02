import type { RuntimeEvent } from "@unclecode/contracts";

export function emitRuntimeEvent(
  listeners: Set<(event: RuntimeEvent) => void>,
  event: RuntimeEvent,
): void {
  for (const listener of listeners) {
    listener(event);
  }
}
