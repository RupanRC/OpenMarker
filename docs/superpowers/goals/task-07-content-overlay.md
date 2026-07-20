# Goal: Task 7 — Content overlay — pin, comment popover, metadata capture

**Wave:** 3 (parallel with tasks: 9)
**Depends on:** Task 2 (`cssSelector`, `Annotation` types), Task 3 (`requestConsoleSnapshot`), Task 4 (`bm-capture` background message)
**Plan section:** `docs/superpowers/plans/2026-07-20-browser-markup-plan.md` → "### Task 7: Content overlay — pin, comment popover, metadata capture" — implement those steps in order, checking off the `- [ ]` boxes as you complete them.

## Context
- Project root: `C:\RC\Projects\Browser-Markup` (Windows; Bash tool is Git Bash — Unix syntax, forward slashes).
- The plan is authoritative and contains ALL code you need — do not redesign. Spec (background reading only): `docs/superpowers/specs/2026-07-20-browser-markup-design.md`.
- Git: work on branch `main`, remote `origin` = https://github.com/RupanRC/OpenMarker.git. Commit AND push when your task's final step says to.

## Files you own (create/modify ONLY these)
- Create: `src/content/picker.ts`, `src/content/popover.ts`, `src/content/capture.ts`
- Modify: `src/content/index.ts` (full rewrite below)

## Interfaces you consume
- Consumes: `cssSelector` (Task 2), `requestConsoleSnapshot` (Task 3), `bm-capture` background message (Task 4), `Annotation` types (Task 2).
- These are content-entry imports only: `selector.ts` and `console-bridge.ts` are imported **only** by the content entry, so Rollup inlines them — the import-free rule holds.

## Interfaces you produce (later tasks depend on these names — do not rename or change signatures)
- Working capture flow; `captureElement(el, comment, consoleErrors, n): Annotation` (also used by Task 8);
- `startPicker(shadow, onPick: (el: Element) => void): () => void` returning a cancel function (Task 8 reuses the shadow-root pattern).
- No new unit tests (DOM-heavy UI; manual verification per spec). Existing suites must stay green and `dist/content.js` must stay import-free.

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
