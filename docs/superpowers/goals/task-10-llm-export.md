# Goal: Task 10 — LLM bundle export

**Wave:** 4 (parallel with tasks: 8)
**Depends on:** Task 2 (`Annotation`), Task 4 (`getAllAnnotations`, `getScreenshot`), Task 5 (`generateReportMd`, `shotPath`), Task 9 (`bm-export-llm` button id)
**Plan section:** `docs/superpowers/plans/2026-07-20-browser-markup-plan.md` → "### Task 10: LLM bundle export" — implement those steps in order, checking off the `- [ ]` boxes as you complete them.

## Context
- Project root: `C:\RC\Projects\Browser-Markup` (Windows; Bash tool is Git Bash — Unix syntax, forward slashes).
- The plan is authoritative and contains ALL code you need — do not redesign. Spec (background reading only): `docs/superpowers/specs/2026-07-20-browser-markup-design.md`.
- Git: work on branch `main`, remote `origin` = https://github.com/RupanRC/OpenMarker.git. Commit AND push when your task's final step says to.

## Files you own (create/modify ONLY these)
- Create: `src/dashboard/export-llm.ts`
- Modify: `src/dashboard/dashboard.ts` (wire `bm-export-llm` button, enable it)

## Interfaces you consume
- Consumes: `generateReportMd`, `shotPath` (Task 5);
- `getAllAnnotations` (Task 4);
- `getScreenshot` (Task 4);
- `Annotation` (Task 2).

## Interfaces you produce (later tasks depend on these names — do not rename or change signatures)
- `exportLlmBundle(): Promise<void>` — writes `report.md`, `bundle.json`, `shots/0N.png` via the File System Access API directory picker; falls back to individual downloads when the picker is unavailable or denied.

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
