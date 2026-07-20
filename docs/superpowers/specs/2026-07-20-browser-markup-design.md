# Browser-Markup — Design

**Date:** 2026-07-20
**Status:** Approved (brainstorming session, 2026-07-20)
**Supersedes:** Section 2 of `PLAN.md` (research in section 1 of `PLAN.md` still stands)

## Purpose

A Chrome/Edge extension (Manifest V3) for manual UI-bug QA: a human pins
comments on elements of a live page, the extension captures screenshots and
machine-readable context, and the dashboard exports a bundle optimized for
handing to an LLM — plus a self-contained HTML report for humans.

The primary consumer of the export is an LLM that will locate and fix the
bugs in a codebase. This drives the two key decisions: capture structured
context (selector, DOM snippet, computed styles, console errors) alongside
each screenshot, and make `report.md` + JSON the primary export rather than
styled HTML.

## Architecture

```
┌─ Content script (isolated world, per page) ──────────────┐
│  Shadow-DOM annotation overlay                            │
│  • Pin mode: hover highlight → click to pin numbered marker│
│  • Comment popover next to marker (Word-style)            │
│  • Draw tools: rectangle / arrow / freehand               │
│  • Captures: selector, element text + outerHTML,          │
│    computed-style subset, bounding rect, URL, timestamp   │
└──────────────┬────────────────────────────────────────────┘
               │ window.postMessage bridge
┌──────────────▼────────────────────────────────────────────┐
│  MAIN-world hook script (world: "MAIN" content script)    │
│  • Wraps console.error/warn, window.onerror,              │
│    unhandledrejection → rolling ring buffer (50 entries)  │
└──────────────┬────────────────────────────────────────────┘
               │ chrome.runtime messages
┌──────────────▼────────────────────────────────────────────┐
│  Service worker                                           │
│  • Screenshot: chrome.tabs.captureVisibleTab              │
│  • Crop/coordinate math (devicePixelRatio)                │
└──────────────┬────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────┐
│  Storage: IndexedDB (screenshot blobs) +                  │
│  chrome.storage.local (annotation metadata)               │
└──────────────┬────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────┐
│  Dashboard page (dashboard.html)                          │
│  • Sessions grouped by URL/date; edit/delete/reorder      │
│  • "Export for LLM" → folder via File System Access API   │
│  • "Export HTML report" → single self-contained file      │
└───────────────────────────────────────────────────────────┘
```

### Units

- **Overlay (content script)** — annotation UI and element capture. One
  purpose: turn user intent (pin, comment, shape) into annotation records.
- **Console hook (MAIN world)** — one purpose: maintain the ring buffer and
  answer "give me the current snapshot". No UI, no storage.
- **Service worker** — one purpose: privileged browser APIs (screenshots).
- **Store** — thin modules over IndexedDB / chrome.storage.local; the only
  code that touches persistence.
- **Dashboard** — review/edit UI; reads/writes through the store.
- **Exporters** — pure functions `annotation[] → report.md string`,
  `annotation[] → bundle.json`, `annotation[] + blobs → HTML string`.
  No DOM, no Chrome APIs — unit-testable.

## Console capture

A MAIN-world content script (MV3 `world: "MAIN"` in the manifest) wraps
`console.error`, `console.warn`, `window.onerror`, and
`unhandledrejection`, appending `{level, message, stack?, timestamp}` to a
ring buffer capped at 50 entries. The isolated-world content script reads a
snapshot via `window.postMessage` at pin time and attaches it to the
annotation.

Chosen over `chrome.debugger` because it needs no extra permission, shows
no "debugger attached" infobar, and doesn't contend for the one-debugger-
per-tab slot. Known limitation: errors fired before the content script
loads are missed — acceptable for a manual QA workflow; the report notes
the capture window per bug.

## Data model (per annotation)

```json
{
  "id": "uuid",
  "url": "https://example.com/page",
  "pageTitle": "...",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "selector": "main > div.card:nth-child(3) > h2",
  "elementText": "Pricing",
  "elementHTML": "<h2 class=\"...\">...</h2>   (trimmed, capped ~4 KB)",
  "computedStyles": { "display": "...", "position": "...",
                      "margin": "...", "padding": "...",
                      "font": "...", "color": "..." },
  "boundingRect": { "x": 120, "y": 340, "w": 200, "h": 48 },
  "viewport": { "w": 1440, "h": 900, "dpr": 2 },
  "shapes": [ { "type": "rect|arrow|freehand", "points": [...] } ],
  "comment": "short note at capture time",
  "commentEdited": "elaborated text from the dashboard",
  "consoleErrors": [ { "level": "error", "message": "...",
                       "stack": "...", "timestamp": "..." } ],
  "screenshotId": "ref-to-IndexedDB-blob",
  "markerPos": { "x": 220, "y": 364 },
  "status": "open"
}
```

## Export formats

### Primary: LLM bundle ("Export for LLM")

A folder written via the File System Access API directory picker (zero
dependencies; Chrome/Edge only, which is the target anyway):

```
bug-report-2026-07-20/
  report.md        ← fixed preamble + one section per bug
  bundle.json      ← all annotations, machine-readable
  shots/01.png …   ← full-viewport screenshot, marker + shapes burned in
```

`report.md` opens with a fixed preamble telling the LLM its job ("You are
fixing UI bugs in a web app; each section below is one bug with page
context; locate and fix each in the codebase"). Each bug section contains:
the comment (edited text preferred, original kept), URL + page title,
selector, element text + HTML snippet, computed-style subset, console
errors, viewport/DPR, and the relative path to its screenshot.

### Secondary: HTML report

Single self-contained `.html` file — screenshots base64-inlined, marker
pins positioned over each screenshot, sidebar with comments + metadata and
anchor links that scroll to the corresponding marker. For humans; same
data as the bundle.

## Error handling

- **Selector no longer matches on revisit** → fall back to coordinates for
  marker placement; flag the annotation as "element moved".
- **Screenshot capture fails** (protected page, e.g. chrome://) → save the
  annotation without a screenshot; the report notes its absence.
- **Element HTML over cap** → truncate with an explicit `…[truncated]`
  marker so the LLM isn't misled by a silent cut.
- **Directory picker unavailable/denied** → fall back to downloading the
  files individually via the downloads API.

## Testing

Vitest unit tests for the pure logic:

- Selector generation (stable, escapes, nth-child handling)
- Console ring buffer (cap, ordering, snapshot)
- `report.md` / `bundle.json` generation from fixture annotations
- Screenshot crop + marker coordinate math (DPR scaling)

Content-script UI and capture flows are verified manually via
load-unpacked — automating extension UI is out of scope.

## Phases

1. **Scaffold** — MV3 manifest, Vite + TypeScript build, content-script
   injection, shadow-DOM toolbar shell.
2. **Pin + comment** — element picker (hover highlight, click to pin),
   selector generation, comment popover, metadata capture (incl. element
   HTML + computed styles).
3. **Console hook** — MAIN-world script, ring buffer, snapshot at pin time.
4. **Screenshot** — service-worker capture, crop to viewport, store blob.
5. **Draw tools** — rect/arrow/freehand canvas layer, saved as shapes.
6. **Dashboard** — session list, edit/delete/reorder, per-URL grouping.
7. **LLM bundle export** — `report.md`, `bundle.json`, annotated shots.
8. **HTML report + polish** — self-contained HTML, keyboard shortcuts,
   pin re-attach on revisit, JSON fallback download.

## Risks

- `captureVisibleTab` captures only the visible viewport → full-page
  stitching is a later-phase option.
- Strict CSP pages can block injected styles → shadow DOM mitigates.
- Heavy SPAs mutate the DOM → selector + coordinate fallback.
- Console hook misses pre-injection errors → noted per bug in the report.
