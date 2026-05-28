/**
 * Persona context injector for CLI / Cursor / Hermes lanes that lack a
 * native system-prompt flag. Wraps the system text in a <persona> block
 * and prepends it to the task. SDK and GLM adapters use their provider's
 * native systemPrompt slot instead and never call this.
 */

export function applySystemPrefix(systemPrompt: string | undefined, task: string): string {
  const trimmed = systemPrompt?.trim();
  if (!trimmed) return task;
  return `<persona>\n${trimmed}\n</persona>\n\n${task}`;
}
