# Goal: Task 1 — Scaffold — MV3 extension builds and loads

**Wave:** 1 (parallel with tasks: none — solo)
**Depends on:** none
**Plan section:** `docs/superpowers/plans/2026-07-20-browser-markup-plan.md` → "### Task 1: Scaffold — MV3 extension builds and loads" — implement those steps in order, checking off the `- [ ]` boxes as you complete them.

## Context
- Project root: `C:\RC\Projects\Browser-Markup` (Windows; Bash tool is Git Bash — Unix syntax, forward slashes).
- The plan is authoritative and contains ALL code you need — do not redesign. Spec (background reading only): `docs/superpowers/specs/2026-07-20-browser-markup-design.md`.
- Git: work on branch `main`, remote `origin` = https://github.com/RupanRC/OpenMarker.git. Commit AND push when your task's final step says to.

## Files you own (create/modify ONLY these)
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `dashboard.html`, `public/manifest.json`, `public/hook.js`, `src/content/index.ts`, `src/background/index.ts`, `src/dashboard/dashboard.ts`

## Interfaces you consume
- Consumes: nothing.

## Interfaces you produce (later tasks depend on these names — do not rename or change signatures)
- Buildable repo; `dist/{content.js,background.js,dashboard.html,manifest.json,hook.js}`; git repo with remote `origin = https://github.com/RupanRC/OpenMarker.git`; `npm test` (vitest) and `npm run build` scripts all later tasks use.

## Hard rules
- Do NOT create or edit any file outside your "Files you own" list. Other subagents own the rest, possibly running in parallel with you.
- Global Constraints from the plan header apply (MV3, no chrome.debugger, ring buffer cap 50, HTML cap 4096 + …[truncated], content.js must stay import-free, etc.).
- If a file you must modify was changed from what the plan shows, adapt minimally and note it in your report.

## Done criteria (all must pass before you commit)
- `npm test` — all tests green
- `npm run build` — clean build
- `npx tsc --noEmit` — no type errors
- `dist/` contains content.js, background.js, dashboard.html, manifest.json, hook.js; git repo initialized with remote origin
- Commit with the exact message in your plan task's final step, then `git push -u origin main`.

## Report back
When done, report: tests passing count, build status, commit SHA, any deviations from the plan.
