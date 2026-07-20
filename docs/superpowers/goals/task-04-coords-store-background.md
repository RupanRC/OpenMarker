# Goal: Task 4 — DPR coordinate math + IndexedDB/store + service-worker capture

**Wave:** 2 (parallel with tasks: 2, 3, 5, 6)
**Depends on:** Task 1 (scaffold); types from Task 2 (with the import exception noted below)
**Plan section:** `docs/superpowers/plans/2026-07-20-browser-markup-plan.md` → "### Task 4: DPR coordinate math + IndexedDB/store + service-worker capture" — implement those steps in order, checking off the `- [ ]` boxes as you complete them.

## Context
- Project root: `C:\RC\Projects\Browser-Markup` (Windows; Bash tool is Git Bash — Unix syntax, forward slashes).
- The plan is authoritative and contains ALL code you need — do not redesign. Spec (background reading only): `docs/superpowers/specs/2026-07-20-browser-markup-design.md`.
- Git: work on branch `main`, remote `origin` = https://github.com/RupanRC/OpenMarker.git. Commit AND push when your task's final step says to.

## Files you own (create/modify ONLY these)
- Create: `src/shared/coords.ts`, `tests/coords.test.ts`, `src/store/db.ts`, `src/store/annotations.ts`, `tests/annotations.test.ts`
- Modify: `src/background/index.ts` (replace Task 1 ping handler with full version below)

## Interfaces you consume
- Consumes: types from `src/shared/types.ts` (Task 2). **Exception to the wave-2 no-shared-import rule:** background and store modules are ESM (service worker is `"type": "module"`), so importing `types.ts` is safe here — type imports are erased at build time and never create chunks.
- Do NOT import `coords.ts` or `store/*` from any content-script file.

## Interfaces you produce (later tasks depend on these names — do not rename or change signatures)
- `toDeviceRect(rect: BoundingRect, dpr: number): BoundingRect`
- `cropBox(rect: BoundingRect, dpr: number, imgW: number, imgH: number): BoundingRect`
- `saveScreenshot(id: string, blob: Blob): Promise<void>`, `getScreenshot(id): Promise<Blob | null>`, `deleteScreenshot(id): Promise<void>`
- `getAllAnnotations(): Promise<Annotation[]>`, `saveAnnotation(a): Promise<void>`, `deleteAnnotation(id): Promise<void>`, `reorderAnnotations(ids: string[]): Promise<void>`
- Background message `bm-capture` handler consumed by Task 7 (see the plan task's Step 5 for request shape).

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
