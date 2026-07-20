# Goal: Task 2 — Shared types + CSS selector generation

**Wave:** 2 (parallel with tasks: 3, 4, 5, 6)
**Depends on:** Task 1 (scaffold)
**Plan section:** `docs/superpowers/plans/2026-07-20-browser-markup-plan.md` → "### Task 2: Shared types + CSS selector generation" — implement those steps in order, checking off the `- [ ]` boxes as you complete them.

## Context
- Project root: `C:\RC\Projects\Browser-Markup` (Windows; Bash tool is Git Bash — Unix syntax, forward slashes).
- The plan is authoritative and contains ALL code you need — do not redesign. Spec (background reading only): `docs/superpowers/specs/2026-07-20-browser-markup-design.md`.
- Git: work on branch `main`, remote `origin` = https://github.com/RupanRC/OpenMarker.git. Commit AND push when your task's final step says to.

## Files you own (create/modify ONLY these)
- Create: `src/shared/types.ts`, `src/shared/selector.ts`, `tests/fixtures.ts`, `tests/selector.test.ts`
- Modify: `package.json` (add `"jsdom": "^25.0.0"` to devDependencies, then `npm install`)

## Interfaces you consume
- Consumes: Task 1 scaffold.

## Interfaces you produce (later tasks depend on these names — do not rename or change signatures)
- `Annotation`, `ConsoleEntry`, `Shape`, `BoundingRect`, `Viewport` types;
- `cssSelector(el: Element): string`;
- `makeAnnotation(overrides?: Partial<Annotation>): Annotation` test fixture. Consumed by Tasks 3, 4, 5, 6, 7, 9.

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
