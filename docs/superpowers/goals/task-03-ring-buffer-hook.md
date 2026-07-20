# Goal: Task 3 — Console ring buffer + MAIN-world hook + snapshot bridge

**Wave:** 2 (parallel with tasks: 2, 4, 5, 6)
**Depends on:** Task 1 (scaffold); `ConsoleEntry` shape from Task 2 — but see the wave-2 no-import rule below
**Plan section:** `docs/superpowers/plans/2026-07-20-browser-markup-plan.md` → "### Task 3: Console ring buffer + MAIN-world hook + snapshot bridge" — implement those steps in order, checking off the `- [ ]` boxes as you complete them.

## Context
- Project root: `C:\RC\Projects\Browser-Markup` (Windows; Bash tool is Git Bash — Unix syntax, forward slashes).
- The plan is authoritative and contains ALL code you need — do not redesign. Spec (background reading only): `docs/superpowers/specs/2026-07-20-browser-markup-design.md`.
- Git: work on branch `main`, remote `origin` = https://github.com/RupanRC/OpenMarker.git. Commit AND push when your task's final step says to.

## Files you own (create/modify ONLY these)
- Create: `src/shared/ring-buffer.ts`, `tests/ring-buffer.test.ts`, `src/content/console-bridge.ts`
- Modify: `public/hook.js` (replace placeholder)

## Interfaces you consume
- Consumes: `ConsoleEntry` from `src/shared/types.ts` (Task 2) — but wave-2 runs in parallel: **this task must NOT import types.ts** (it is content-side code; the bridge declares its own structural type to stay independent). hook.js is plain JS with zero imports.

## Interfaces you produce (later tasks depend on these names — do not rename or change signatures)
- `RingBuffer<T>` (`push`, `snapshot`);
- working MAIN-world hook;
- `requestConsoleSnapshot(timeoutMs?: number): Promise<ConsoleEntryLike[]>` for Task 7.

## Hard rules
- Do NOT create or edit any file outside your "Files you own" list. Other subagents own the rest, possibly running in parallel with you.
- Global Constraints from the plan header apply (MV3, no chrome.debugger, ring buffer cap 50, HTML cap 4096 + …[truncated], content.js must stay import-free, etc.).
- If a file you must modify was changed from what the plan shows, adapt minimally and note it in your report.

## Done criteria (all must pass before you commit)
- `npm test` — all tests green
- `npm run build` — clean build
- `npx tsc --noEmit` — no type errors
- `grep -E '^(import|export) ' dist/content.js || echo CONTENT_OK` prints `CONTENT_OK`
- Commit with the exact message in your plan task's final step, then `git push`.

## Report back
When done, report: tests passing count, build status, commit SHA, any deviations from the plan.
