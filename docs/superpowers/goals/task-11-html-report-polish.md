# Goal: Task 11 — HTML report export + polish (shortcuts, pin re-attach)

**Wave:** 5 (parallel with tasks: none — solo)
**Depends on:** Task 4 (`getScreenshot`/`getAllAnnotations`, `saveAnnotation`), Task 6 (`generateReportHtml`), Task 9 (dashboard button ids), Tasks 7/8 (content overlay this task extends)
**Plan section:** `docs/superpowers/plans/2026-07-20-browser-markup-plan.md` → "### Task 11: HTML report export + polish (shortcuts, pin re-attach)" — implement those steps in order, checking off the `- [ ]` boxes as you complete them.

## Context
- Project root: `C:\RC\Projects\Browser-Markup` (Windows; Bash tool is Git Bash — Unix syntax, forward slashes).
- The plan is authoritative and contains ALL code you need — do not redesign. Spec (background reading only): `docs/superpowers/specs/2026-07-20-browser-markup-design.md`.
- Git: work on branch `main`, remote `origin` = https://github.com/RupanRC/OpenMarker.git. Commit AND push when your task's final step says to.

## Files you own (create/modify ONLY these)
- Create: `src/dashboard/export-html.ts`, `src/content/reattach.ts`
- Modify: `src/dashboard/dashboard.ts` (wire `bm-export-html`), `src/content/index.ts` (keyboard shortcuts + re-attach call), `src/background/index.ts` (add `bm-list-for-url` handler)

## Interfaces you consume
- Consumes: `generateReportHtml` (Task 6), `getScreenshot`/`getAllAnnotations` (Task 4), `saveAnnotation` (Task 4), dashboard button ids (Task 9).

## Interfaces you produce (later tasks depend on these names — do not rename or change signatures)
- `exportHtmlReport(): Promise<void>`;
- background message `{type:'bm-list-for-url', url}` → `{annotations: Annotation[]}`;
- content-side re-attach that renders ghost markers for stored pins on page load and flags `"element moved"` when the selector no longer matches (sets `commentEdited` suffix, keeps coordinates fallback).

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
