# Modular Code Enforcement

Pre-flight rules for all code changes in this workspace.

## File size

- No single source file may exceed 500 lines of code.
- When a file exceeds this limit, split by responsibility before adding more code.

## Naming

- One exported class/component per file. The file name must match the export.
- No catch-all files: `utils.ts`, `helpers.ts`, `common.ts`, `shared.ts` are banned as owner seams.

## Ownership

- Each module has one clear responsibility. Mixing UI atoms with domain logic is a violation.
- New files must be importable from their package barrel within one release.

## Type safety

- `as any` is banned. Use `unknown` + type guards or generics.
- `// @ts-ignore` is banned. `// @ts-expect-error` with a reason is allowed temporarily.

## Error handling

- Never silently swallow errors. `catch` blocks must either re-throw, log to stderr, or return a typed error.
- `void promise` is only acceptable when the promise has its own `.catch()` handler.

## Testing

- Behavior changes require at least one test that would have caught the bug.
- Structure-only refactors require contract tests asserting the new seam boundaries.
