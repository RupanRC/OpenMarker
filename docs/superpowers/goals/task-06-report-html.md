# Goal: Task 6 — Self-contained HTML report generator

**Wave:** 2 (parallel with tasks: 2, 3, 4, 5)
**Depends on:** Task 1 (scaffold); `Annotation` type + `makeAnnotation` fixture from Task 2 (same wave-2 import rule as Task 5)
**Plan section:** `docs/superpowers/plans/2026-07-20-browser-markup-plan.md` → "### Task 6: Self-contained HTML report generator" — implement those steps in order, checking off the `- [ ]` boxes as you complete them.

## Context
- Project root: `C:\RC\Projects\Browser-Markup` (Windows; Bash tool is Git Bash — Unix syntax, forward slashes).
- The plan is authoritative and contains ALL code you need — do not redesign. Spec (background reading only): `docs/superpowers/specs/2026-07-20-browser-markup-design.md`.
- Git: work on branch `main`, remote `origin` = https://github.com/RupanRC/OpenMarker.git. Commit AND push when your task's final step says to.

## Files you own (create/modify ONLY these)
- Create: `src/shared/report-html.ts`, `tests/report-html.test.ts`

## Interfaces you consume
- Consumes: `Annotation` (Task 2), `makeAnnotation` (Task 2). Same wave-2 import rule as Task 5 (dashboard-side only).

## Interfaces you produce (later tasks depend on these names — do not rename or change signatures)
- `escapeHtml(s: string): string`
- `pinPosition(a: Annotation): { left: string; top: string }` (percent strings, 3 decimals)
- `generateReportHtml(annotations: Annotation[], shots: Map<string, string>): string` (shots maps `screenshotId` -> data URL). Consumed by Task 11.

## Hard rules
- Do NOT create or edit any file outside your "Files you own" list. Other subagents own the rest, possibly running in parallel with you.
- Global Constraints from the plan header apply (MV3, no chrome.debugger, ring buffer cap 50, HTML cap 4096 + …[truncated], content.js must stay import-free, etc.).
- If a file you must modify was changed from what the plan shows, adapt minimally and note it in your report.

## Done criteria (all must pass before you commit)
- `npm test` — all tests green
- `npm run build` — clean build
- `npx tsc --noEmit` — no type errors
- Commit with the exact message in your plan task's final step, then `git push`.

## Report back
When done, report: tests passing count, build status, commit SHA, any deviations from the plan.
