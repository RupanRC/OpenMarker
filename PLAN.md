# Browser-Markup — Research & Implementation Plan

> **Note (2026-07-20):** Section 2 below is superseded by the approved
> design at `docs/superpowers/specs/2026-07-20-browser-markup-design.md`
> (LLM-bundle export as primary output, console-error capture per pin,
> revised phases). Section 1's research still stands.

## 1. Research: what already exists

The feature set (annotate a live web page, pin comments to elements, capture
screenshots, collect URL/element metadata, produce a report) is well covered by
commercial SaaS tools:

| Tool | Pins comments on elements | Auto screenshot | Captures URL/element metadata | Report output |
|---|---|---|---|---|
| BugHerd | ✅ (best-in-class pins) | ✅ | ✅ (browser, OS, URL) | Kanban board, PDF/image export — SaaS only |
| Marker.io | ✅ | ✅ | ✅ (+ console/network logs) | Pushes to Jira/Trello/etc. — SaaS only |
| Usersnap | ✅ | ✅ | ✅ | Dashboard + integrations — SaaS only |
| Markup.io / Ruttl / Feedbucket / Ybug | ✅ | ✅ | ✅ | Share links, integrations — SaaS only |
| Hypothes.is / Diigo | Text highlights + notes | ❌ | URL only | Web annotations — no screenshots |
| Zoho Annotator / Markup Hero | On screenshots, not live DOM | ✅ | ❌ | Image/cloud share |
| AgentEcho (open, PH) | ✅ | ✅ | ✅ | Markdown export for AI agents |

**Verdict:** yes, the capability exists — but every polished option is a
cloud SaaS with a subscription, and the "report" is either a share link on
their servers or a ticket pushed into Jira/Trello. No existing tool offers the
exact workflow requested here:

- Word-style margin comments anchored to page elements, **stored locally**
- An **editable review stage** — view all captured items, elaborate/edit
  comments later (not at capture time), delete/reorder
- Export of a **self-contained web report (single HTML file)** with
  screenshots + markers pointing at the annotated element, plus
  URL / selector / timestamp metadata

That gap justifies building the browser extension.

## 2. Proposed solution: Chrome/Edge extension (Manifest V3)

### Architecture

```
┌─ Content script (injected per page) ─────────────────────┐
│  Annotation overlay layer (shadow DOM to avoid CSS clashes)│
│  • Pin mode: click element → drop numbered marker          │
│  • Comment popover next to marker (Word-style)             │
│  • Draw tools: rectangle / arrow / freehand highlight      │
│  • Captures: CSS selector path, element text snippet,      │
│    bounding rect, page URL, title, timestamp               │
└──────────────┬───────────────────────────────────────────┘
               │ chrome.runtime messages
┌──────────────▼───────────────────────────────────────────┐
│  Service worker (background)                              │
│  • Screenshot: chrome.tabs.captureVisibleTab              │
│  • Coordinates pin → screenshot crop (devicePixelRatio)   │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│  Storage: IndexedDB (screenshots as blobs) +              │
│  chrome.storage.local (annotation metadata)               │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│  Dashboard page (extension page, dashboard.html)          │
│  • List all annotation sessions, grouped by URL/date      │
│  • Edit/elaborate comments, delete, reorder               │
│  • "Generate report" → single self-contained HTML file    │
│    (screenshots inlined as base64, markers positioned     │
│    over screenshot, sidebar with comments + metadata)     │
└───────────────────────────────────────────────────────────┘
```

### Data model (per annotation)

```json
{
  "id": "uuid",
  "url": "https://example.com/page",
  "pageTitle": "...",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "selector": "main > div.card:nth-child(3) > h2",
  "elementText": "Pricing",
  "boundingRect": { "x": 120, "y": 340, "w": 200, "h": 48 },
  "viewport": { "w": 1440, "h": 900, "dpr": 2 },
  "shapes": [ { "type": "rect|arrow|freehand", "points": [...] } ],
  "comment": "short note at capture time",
  "commentEdited": "elaborated text written later in dashboard",
  "screenshotId": "ref-to-IndexedDB-blob",
  "markerPos": { "x": 220, "y": 364 },
  "status": "open"
}
```

### Key design decisions

- **Shadow DOM overlay** so host page CSS can't break the annotation UI.
- **Dual anchoring**: CSS selector path (for re-locating the element on
  revisit) + absolute coordinates (for drawing the marker on the screenshot).
  If the selector no longer matches, fall back to coordinates.
- **Screenshot at capture time** via `captureVisibleTab` (no html2canvas —
  it is inaccurate on modern pages). Scroll-stitching for full-page capture
  is a later-phase option.
- **Comment flow like Word**: capture = quick note pinned in a margin-like
  popover; elaboration happens later in the dashboard, which keeps the
  original + edited text.
- **Self-contained report**: one `.html` file, screenshots base64-inlined,
  marker pins absolutely positioned over each screenshot, comment list with
  anchor links that scroll/highlight the corresponding marker. No server.

### Phases

1. **Scaffold** — MV3 manifest, Vite + TypeScript build, content script
   injection, shadow-DOM toolbar shell.
2. **Pin + comment** — element picker (hover highlight, click to pin),
   selector generation, comment popover, metadata capture.
3. **Screenshot** — service-worker capture, crop to viewport, store blob.
4. **Draw tools** — rect/arrow/freehand on a canvas layer, saved as shapes.
5. **Dashboard** — session list, edit/delete/reorder comments, per-URL
   grouping.
6. **Report generator** — template → single HTML file download.
7. **Polish** — keyboard shortcuts, re-attach pins on page revisit, export
   JSON alongside HTML.

### Main risks

- `captureVisibleTab` only captures the visible viewport → full-page
  stitching adds complexity (phase 4+).
- Pages with strict CSP can block injected styles → shadow DOM mitigates.
- Heavy SPAs change DOM → selector fallback strategy needed.
