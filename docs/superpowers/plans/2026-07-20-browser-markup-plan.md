# Browser-Markup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution mode: SWARM (preselected by the user).** Tasks are executed by
> fresh subagents, one per task, dispatched in dependency waves via AgentSwarm.
> Each task has a self-contained goal file in `docs/superpowers/goals/` that
> its subagent reads first ("autoload"). See "Swarm Execution Model" below.

**Goal:** Build a Chrome/Edge MV3 extension that pins comments on live page
elements, captures screenshots + machine-readable context (selector, element
HTML, computed styles, console errors), and exports an LLM-optimized bundle
(`report.md` + `bundle.json` + annotated screenshots) plus a self-contained
HTML report.

**Architecture:** Content script (shadow-DOM overlay, pin/draw UI) + MAIN-world
console hook (ring buffer via `window.postMessage` bridge) + module service
worker (screenshot capture/crop via OffscreenCanvas, all persistence) +
dashboard extension page (review/edit/export). Exporters and selectors are
pure, DOM-free functions unit-tested with Vitest.

**Tech Stack:** TypeScript, Vite 5 (no plugins), Vitest 2 + jsdom, Manifest V3.
Storage: IndexedDB (screenshot blobs, extension origin, accessed from service
worker and dashboard) + `chrome.storage.local` (annotation metadata).

**Spec:** `docs/superpowers/specs/2026-07-20-browser-markup-design.md` (approved).
This plan implements all 8 spec phases across 11 tasks.

## Global Constraints

- Manifest V3, Chrome/Edge only.
- No `chrome.debugger`; console capture via MAIN-world `world: "MAIN"` content script only.
- Ring buffer cap: **50** entries; entry shape `{level, message, stack?, timestamp}`.
- Element HTML cap: **4096** chars, truncated with explicit `…[truncated]` marker.
- Console bridge message types: `BM_CONSOLE_SNAPSHOT_REQUEST` / `BM_CONSOLE_SNAPSHOT_RESPONSE`.
- Background capture message type: `bm-capture`.
- No runtime dependencies; devDependencies only: `typescript`, `vite`, `vitest`, `jsdom`, `@types/chrome`.
- **Content-script entries must bundle to import-free classic scripts** (MV3
  content scripts cannot be ESM). Shared code is inlined by Rollup; after every
  build verify `dist/content.js` contains no top-level `import`/`export`
  statements. Never import a module into both a content-script entry and
  another entry (that would force a shared chunk and break the content script).
- `dist/background.js` is loaded as `"type": "module"` — ESM imports allowed there.
- Screenshot capture failure (protected pages) must not lose the annotation:
  save it with `screenshotId: null`.
- All file writes owned by exactly one task per wave (see Swarm Execution
  Model). A subagent must not edit files outside its task's "Files" list.
- Data model matches the spec exactly, plus one additive field `n: number`
  (per-page pin sequence number, burned into markers and used for `shots/0N.png`).

## Repository layout (target)

```
package.json  tsconfig.json  vite.config.ts  dashboard.html  .gitignore
public/
  manifest.json            # copied verbatim to dist/
  hook.js                  # MAIN-world console hook (static, plain JS, no imports)
src/
  shared/types.ts          # Annotation, ConsoleEntry, Shape, BoundingRect, Viewport
  shared/selector.ts       # cssSelector(el): stable CSS selector path
  shared/ring-buffer.ts    # RingBuffer<T> (unit-tested twin of hook.js logic)
  shared/coords.ts         # toDeviceRect, cropBox (DPR math)
  shared/report-md.ts      # generateReportMd, shotPath
  shared/report-html.ts    # generateReportHtml, escapeHtml, pinPosition
  content/index.ts         # overlay shell, toolbar, mode wiring, shortcuts
  content/picker.ts        # hover highlight + click-to-pick element
  content/popover.ts       # comment popover
  content/capture.ts       # captureElement(): metadata -> Annotation
  content/console-bridge.ts# requestConsoleSnapshot()
  content/draw.ts          # rect/arrow/freehand canvas layer
  content/reattach.ts      # re-render stored pins on revisit
  background/index.ts      # bm-capture handler, crop+burn, action click
  store/db.ts              # IndexedDB screenshot blobs
  store/annotations.ts     # chrome.storage.local CRUD
  dashboard/dashboard.ts   # session list, edit/delete/reorder, export buttons
  dashboard/export-llm.ts  # LLM bundle via File System Access API + fallback
  dashboard/export-html.ts # single-file HTML report download
tests/
  fixtures.ts              # makeAnnotation(overrides)
  selector.test.ts  ring-buffer.test.ts  coords.test.ts
  annotations.test.ts  report-md.test.ts  report-html.test.ts
```

## Swarm Execution Model

- **Goal files:** one per task at `docs/superpowers/goals/task-NN-<name>.md`.
  Each restates: task scope, exact files owned, interfaces consumed/produced,
  done-criteria commands, and the wave it belongs to. The swarm prompt tells
  each subagent to read its goal file + this plan's matching task section.
- **Waves (sequential between waves, parallel within):**

| Wave | Tasks | Why parallel-safe |
|------|-------|-------------------|
| 1 | T1 scaffold | solo — creates repo, package.json, installs deps, git init + push |
| 2 | T2 selector+types, T3 ring-buffer+hook, T4 coords+store+background, T5 report-md, T6 report-html | disjoint file sets; only T2 touches package.json (adds jsdom) |
| 3 | T7 content overlay, T9 dashboard | content/* vs dashboard/* — disjoint |
| 4 | T8 draw tools, T10 LLM export | content/draw.ts+index.ts vs dashboard/export-llm.ts+dashboard.ts — disjoint |
| 5 | T11 HTML report + polish | solo — touches content + dashboard + background |

- Each subagent: implements only its task, runs `npm test` and `npm run build`,
  commits with the task's commit message, and pushes. Wave N+1 starts only
  after every wave-N agent reports green.
- Integration conflicts are pre-empted by the "Interfaces" blocks: later tasks
  consume exact signatures produced earlier.

---

### Task 1: Scaffold — MV3 extension builds and loads

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `dashboard.html`, `public/manifest.json`, `public/hook.js`, `src/content/index.ts`, `src/background/index.ts`, `src/dashboard/dashboard.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: buildable repo; `dist/{content.js,background.js,dashboard.html,manifest.json,hook.js}`; git repo with remote `origin = https://github.com/RupanRC/OpenMarker.git`; `npm test` (vitest) and `npm run build` scripts all later tasks use.

- [x] **Step 1: Init git + write `package.json`**

```bash
git init -b main
git remote add origin https://github.com/RupanRC/OpenMarker.git
```

```json
{
  "name": "browser-markup",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.287",
    "typescript": "^5.5.4",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

`.gitignore`:

```
node_modules/
dist/
```

- [x] **Step 2: Write `tsconfig.json` and `vite.config.ts`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["chrome"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Content scripts must stay import-free classic scripts (MV3).
// Each entry here must not share modules with another entry, so Rollup
// inlines everything and emits one self-contained file per entry.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
```

- [x] **Step 3: Write `public/manifest.json` and placeholder `public/hook.js`**

```json
{
  "manifest_version": 3,
  "name": "Browser-Markup",
  "version": "0.1.0",
  "description": "Pin comments on live pages, capture context, export LLM-ready bug reports.",
  "permissions": ["storage", "downloads", "activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [
    { "matches": ["<all_urls>"], "js": ["content.js"], "run_at": "document_idle" },
    { "matches": ["<all_urls>"], "js": ["hook.js"], "run_at": "document_start", "world": "MAIN" }
  ],
  "action": { "default_title": "Browser-Markup" }
}
```

```js
// Browser-Markup console hook (MAIN world) — placeholder, implemented in Task 3.
```

- [x] **Step 4: Write shadow-DOM toolbar shell `src/content/index.ts`**

```ts
const host = document.createElement('div');
host.id = 'browser-markup-host';
const shadow = host.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    .bm-toolbar { position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      background: #1e1e2e; color: #fff; padding: 8px 12px; border-radius: 8px;
      font: 13px system-ui, sans-serif; display: flex; gap: 8px; align-items: center; }
    .bm-toolbar button { cursor: pointer; }
  </style>
  <div class="bm-toolbar">
    <span>Browser-Markup</span>
    <button id="bm-pin" type="button">Pin</button>
  </div>`;
document.documentElement.appendChild(host);
```

- [x] **Step 5: Write `src/background/index.ts` ping handler**

```ts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ping') sendResponse({ type: 'pong' });
  return false;
});
```

- [x] **Step 6: Write `dashboard.html` and `src/dashboard/dashboard.ts`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Browser-Markup Dashboard</title>
  </head>
  <body>
    <h1>Browser-Markup</h1>
    <div id="app"></div>
    <script type="module" src="/src/dashboard/dashboard.ts"></script>
  </body>
</html>
```

```ts
document.getElementById('app')!.textContent = 'No annotations yet.';
```

- [x] **Step 7: Install, build, verify**

Run: `npm install && npm run build`
Expected: `dist/` contains `content.js`, `background.js`, `dashboard.html`, `manifest.json`, `hook.js`.

Run: `grep -E '^(import|export) ' dist/content.js || echo CONTENT_OK`
Expected: `CONTENT_OK` (content script is import-free).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual smoke check** — DEFERRED TO USER (no browser automation in the executor environment)

`chrome://extensions` → Developer mode → Load unpacked → select `dist/` →
open any https page → toolbar appears top-right; clicking the extension
action icon does nothing yet (no error in console).

- [x] **Step 9: Commit and push**

```bash
git add -A
git commit -m "feat: MV3 scaffold with Vite+TS build, shadow-DOM toolbar shell"
git push -u origin main
```

---

### Task 2: Shared types + CSS selector generation

**Files:**
- Create: `src/shared/types.ts`, `src/shared/selector.ts`, `tests/fixtures.ts`, `tests/selector.test.ts`
- Modify: `package.json` (add `"jsdom": "^25.0.0"` to devDependencies, then `npm install`)

**Interfaces:**
- Consumes: Task 1 scaffold.
- Produces: `Annotation`, `ConsoleEntry`, `Shape`, `BoundingRect`, `Viewport` types;
  `cssSelector(el: Element): string`; `makeAnnotation(overrides?: Partial<Annotation>): Annotation`
  test fixture. Consumed by Tasks 3, 4, 5, 6, 7, 9.

- [ ] **Step 1: Write the failing selector test**

`tests/selector.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { cssSelector } from '../src/shared/selector';

describe('cssSelector', () => {
  it('returns #id for an element with an id', () => {
    document.body.innerHTML = '<div><span id="price">x</span></div>';
    expect(cssSelector(document.getElementById('price')!)).toBe('#price');
  });

  it('builds a path with nth-of-type for same-tag siblings', () => {
    document.body.innerHTML = '<main><div>a</div><div><span>b</span></div></main>';
    const span = document.querySelector('span')!;
    expect(cssSelector(span)).toBe('body > main > div:nth-of-type(2) > span');
  });

  it('stops at the nearest ancestor with an id', () => {
    document.body.innerHTML = '<div id="card"><p><em>x</em></p></div>';
    expect(cssSelector(document.querySelector('em')!)).toBe('#card > p > em');
  });

  it('escapes special characters in ids', () => {
    document.body.innerHTML = '<div id="a:b.c"><span>x</span></div>';
    expect(cssSelector(document.querySelector('span')!)).toBe('#a\\:b\\.c > span');
  });
});
```

Run: `npm test` — Expected: FAIL (`Cannot find module '../src/shared/selector'`).
(jsdom must already be installed: `npm install` after the package.json edit.)

- [ ] **Step 2: Write `src/shared/types.ts`**

```ts
export interface ConsoleEntry {
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  timestamp: string;
}

export interface Shape {
  type: 'rect' | 'arrow' | 'freehand';
  /** Flat coordinate pairs in viewport CSS px: [x1, y1, x2, y2, ...]. */
  points: number[];
}

export interface BoundingRect { x: number; y: number; w: number; h: number; }
export interface Viewport { w: number; h: number; dpr: number; }

export interface Annotation {
  id: string;
  url: string;
  pageTitle: string;
  createdAt: string;
  updatedAt: string;
  selector: string;
  elementText: string;
  elementHTML: string;
  computedStyles: Record<string, string>;
  boundingRect: BoundingRect;
  viewport: Viewport;
  shapes: Shape[];
  comment: string;
  commentEdited: string;
  consoleErrors: ConsoleEntry[];
  screenshotId: string | null;
  markerPos: { x: number; y: number };
  status: 'open' | 'resolved';
  /** Per-page pin sequence number, 1-based; used for marker label and shots/0N.png. */
  n: number;
}
```

- [ ] **Step 3: Implement `src/shared/selector.ts`**

```ts
const escapeIdent = (s: string): string =>
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(s)
    : s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

/** Stable CSS selector path for an element: nearest id ancestor, then tag[:nth-of-type] segments. */
export function cssSelector(el: Element): string {
  if (el.id) return `#${escapeIdent(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.tagName !== 'HTML') {
    if (node.id) {
      parts.unshift(`#${escapeIdent(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (c) => c.tagName === node!.tagName,
      );
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}
```

- [ ] **Step 4: Write `tests/fixtures.ts`**

```ts
import type { Annotation } from '../src/shared/types';

export function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    url: 'https://example.com/pricing',
    pageTitle: 'Pricing',
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
    selector: '#price',
    elementText: 'Pricing',
    elementHTML: '<h2 id="price">Pricing</h2>',
    computedStyles: {
      display: 'block', position: 'static', margin: '0px',
      padding: '8px', font: '16px system-ui', color: 'rgb(0, 0, 0)',
    },
    boundingRect: { x: 120, y: 340, w: 200, h: 48 },
    viewport: { w: 1440, h: 900, dpr: 2 },
    shapes: [],
    comment: 'Button overlaps text',
    commentEdited: '',
    consoleErrors: [
      { level: 'error', message: 'TypeError: x is null', stack: 'at app.js:1', timestamp: '2026-07-20T09:59:00.000Z' },
    ],
    screenshotId: 'shot-1',
    markerPos: { x: 220, y: 364 },
    status: 'open',
    n: 1,
    ...overrides,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test` — Expected: PASS (4 selector tests).

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat: shared annotation types + cssSelector with tests"
git push
```

---

### Task 3: Console ring buffer + MAIN-world hook + snapshot bridge

**Files:**
- Create: `src/shared/ring-buffer.ts`, `tests/ring-buffer.test.ts`, `src/content/console-bridge.ts`
- Modify: `public/hook.js` (replace placeholder)

**Interfaces:**
- Consumes: `ConsoleEntry` from `src/shared/types.ts` (Task 2) — but wave-2 runs
  in parallel: **this task must NOT import types.ts** (it is content-side code;
  the bridge declares its own structural type to stay independent). hook.js is
  plain JS with zero imports.
- Produces: `RingBuffer<T>` (`push`, `snapshot`); working MAIN-world hook;
  `requestConsoleSnapshot(timeoutMs?: number): Promise<ConsoleEntryLike[]>` for Task 7.

- [ ] **Step 1: Write the failing ring-buffer test**

`tests/ring-buffer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../src/shared/ring-buffer';

describe('RingBuffer', () => {
  it('keeps insertion order in snapshot', () => {
    const b = new RingBuffer<number>(3);
    b.push(1); b.push(2);
    expect(b.snapshot()).toEqual([1, 2]);
  });

  it('evicts oldest entries beyond capacity', () => {
    const b = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => b.push(n));
    expect(b.snapshot()).toEqual([3, 4, 5]);
  });

  it('snapshot returns a copy, not the live array', () => {
    const b = new RingBuffer<number>(2);
    b.push(1);
    const s = b.snapshot();
    s.push(99);
    expect(b.snapshot()).toEqual([1]);
  });
});
```

Run: `npm test` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/shared/ring-buffer.ts`**

```ts
export class RingBuffer<T> {
  private items: T[] = [];
  constructor(private readonly capacity: number) {}
  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }
  snapshot(): T[] {
    return [...this.items];
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npm test` — Expected: PASS.

- [ ] **Step 4: Implement `public/hook.js` (plain JS, no imports, cap 50)**

```js
// Browser-Markup console hook — runs in the MAIN world at document_start.
// Keeps a rolling ring buffer (50) of console.error/warn, window errors and
// unhandled rejections; answers snapshot requests over window.postMessage.
(() => {
  const CAP = 50;
  const buf = [];
  const push = (level, message, stack) => {
    buf.push({
      level,
      message: String(message),
      stack: stack ? String(stack) : undefined,
      timestamp: new Date().toISOString(),
    });
    if (buf.length > CAP) buf.shift();
  };
  const fmt = (args) =>
    args
      .map((a) => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(' ');
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args) => { push('error', fmt(args), new Error().stack); origError(...args); };
  console.warn = (...args) => { push('warn', fmt(args), undefined); origWarn(...args); };
  window.addEventListener('error', (e) =>
    push('error', e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', (e) =>
    push('error', 'unhandledrejection: ' + ((e.reason && e.reason.message) || e.reason),
      e.reason && e.reason.stack));
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.type === 'BM_CONSOLE_SNAPSHOT_REQUEST') {
      window.postMessage({ type: 'BM_CONSOLE_SNAPSHOT_RESPONSE', entries: buf.slice() }, '*');
    }
  });
})();
```

- [ ] **Step 5: Write `src/content/console-bridge.ts`**

```ts
export interface ConsoleEntryLike {
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  timestamp: string;
}

/** Ask the MAIN-world hook for its current ring-buffer snapshot. Resolves [] on timeout. */
export function requestConsoleSnapshot(timeoutMs = 200): Promise<ConsoleEntryLike[]> {
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === window && e.data?.type === 'BM_CONSOLE_SNAPSHOT_RESPONSE') {
        window.removeEventListener('message', onMsg);
        resolve(e.data.entries as ConsoleEntryLike[]);
      }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ type: 'BM_CONSOLE_SNAPSHOT_REQUEST' }, '*');
    setTimeout(() => {
      window.removeEventListener('message', onMsg);
      resolve([]);
    }, timeoutMs);
  });
}
```

- [ ] **Step 6: Verify build stays import-free; manual check**

Run: `npm run build && (grep -E '^(import|export) ' dist/content.js || echo CONTENT_OK)` — Expected: `CONTENT_OK`.
Manual: load unpacked, open a page, run `console.error('boom')` in DevTools,
then in the page context post `BM_CONSOLE_SNAPSHOT_REQUEST` and observe a
response containing the entry.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat: console ring buffer, MAIN-world hook, snapshot bridge"
git push
```

---

### Task 4: DPR coordinate math + IndexedDB/store + service-worker capture

**Files:**
- Create: `src/shared/coords.ts`, `tests/coords.test.ts`, `src/store/db.ts`, `src/store/annotations.ts`, `tests/annotations.test.ts`
- Modify: `src/background/index.ts` (replace Task 1 ping handler with full version below)

**Interfaces:**
- Consumes: types from `src/shared/types.ts` (Task 2). **Exception to the
  wave-2 no-shared-import rule:** background and store modules are ESM
  (service worker is `"type": "module"`), so importing `types.ts` is safe
  here — type imports are erased at build time and never create chunks.
  Do NOT import `coords.ts` or `store/*` from any content-script file.
- Produces:
  - `toDeviceRect(rect: BoundingRect, dpr: number): BoundingRect`
  - `cropBox(rect: BoundingRect, dpr: number, imgW: number, imgH: number): BoundingRect`
  - `saveScreenshot(id: string, blob: Blob): Promise<void>`, `getScreenshot(id): Promise<Blob | null>`, `deleteScreenshot(id): Promise<void>`
  - `getAllAnnotations(): Promise<Annotation[]>`, `saveAnnotation(a): Promise<void>`, `deleteAnnotation(id): Promise<void>`, `reorderAnnotations(ids: string[]): Promise<void>`
  - Background message `bm-capture` handler consumed by Task 7 (see Step 5 for request shape).

- [ ] **Step 1: Write the failing coords test**

`tests/coords.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toDeviceRect, cropBox } from '../src/shared/coords';

describe('toDeviceRect', () => {
  it('scales by dpr with rounding', () => {
    expect(toDeviceRect({ x: 10.4, y: 20.6, w: 100, h: 50 }, 2))
      .toEqual({ x: 21, y: 41, w: 200, h: 100 });
  });
});

describe('cropBox', () => {
  it('converts a CSS-px rect to device px inside the image', () => {
    expect(cropBox({ x: 0, y: 0, w: 1440, h: 900 }, 2, 2880, 1800))
      .toEqual({ x: 0, y: 0, w: 2880, h: 1800 });
  });

  it('clamps to image bounds', () => {
    expect(cropBox({ x: -50, y: 800, w: 2000, h: 500 }, 1, 1440, 900))
      .toEqual({ x: 0, y: 800, w: 1440, h: 100 });
  });
});
```

Run: `npm test` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/shared/coords.ts`**

```ts
import type { BoundingRect } from './types';

/** CSS pixels -> device pixels, rounded. */
export function toDeviceRect(rect: BoundingRect, dpr: number): BoundingRect {
  return {
    x: Math.round(rect.x * dpr),
    y: Math.round(rect.y * dpr),
    w: Math.round(rect.w * dpr),
    h: Math.round(rect.h * dpr),
  };
}

/** Device-px crop box for `rect` (CSS px), clamped to an imgW x imgH image. */
export function cropBox(rect: BoundingRect, dpr: number, imgW: number, imgH: number): BoundingRect {
  const dev = toDeviceRect(rect, dpr);
  const x = Math.max(0, Math.min(dev.x, imgW));
  const y = Math.max(0, Math.min(dev.y, imgH));
  return {
    x,
    y,
    w: Math.max(0, Math.min(dev.w, imgW - x)),
    h: Math.max(0, Math.min(dev.h, imgH - y)),
  };
}
```

- [ ] **Step 3: Write the failing annotations-store test**

`tests/annotations.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeAnnotation } from './fixtures';

let backing: Record<string, unknown>;

beforeEach(() => {
  backing = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: backing[key] }),
        set: async (obj: Record<string, unknown>) => { Object.assign(backing, obj); },
      },
    },
  };
});

describe('annotations store', () => {
  it('saves and lists annotations', async () => {
    const { saveAnnotation, getAllAnnotations } = await import('../src/store/annotations');
    await saveAnnotation(makeAnnotation({ id: 'a1' }));
    await saveAnnotation(makeAnnotation({ id: 'a2', n: 2 }));
    expect((await getAllAnnotations()).map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('updates an existing annotation by id', async () => {
    const { saveAnnotation, getAllAnnotations } = await import('../src/store/annotations');
    await saveAnnotation(makeAnnotation({ id: 'a1' }));
    await saveAnnotation(makeAnnotation({ id: 'a1', commentEdited: 'edited' }));
    const all = await getAllAnnotations();
    expect(all).toHaveLength(1);
    expect(all[0].commentEdited).toBe('edited');
  });

  it('deletes by id', async () => {
    const { saveAnnotation, deleteAnnotation, getAllAnnotations } = await import('../src/store/annotations');
    await saveAnnotation(makeAnnotation({ id: 'a1' }));
    await deleteAnnotation('a1');
    expect(await getAllAnnotations()).toEqual([]);
  });

  it('reorders by id list, dropping unknown ids', async () => {
    const { saveAnnotation, reorderAnnotations, getAllAnnotations } = await import('../src/store/annotations');
    await saveAnnotation(makeAnnotation({ id: 'a1' }));
    await saveAnnotation(makeAnnotation({ id: 'a2', n: 2 }));
    await reorderAnnotations(['a2', 'ghost', 'a1']);
    expect((await getAllAnnotations()).map((a) => a.id)).toEqual(['a2', 'a1']);
  });
});
```

Run: `npm test` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/store/annotations.ts` and `src/store/db.ts`**

`src/store/annotations.ts`:

```ts
import type { Annotation } from '../shared/types';

const KEY = 'annotations';

export async function getAllAnnotations(): Promise<Annotation[]> {
  const res = await chrome.storage.local.get(KEY);
  return (res[KEY] as Annotation[] | undefined) ?? [];
}

export async function saveAnnotation(a: Annotation): Promise<void> {
  const all = await getAllAnnotations();
  const i = all.findIndex((x) => x.id === a.id);
  if (i >= 0) all[i] = a; else all.push(a);
  await chrome.storage.local.set({ [KEY]: all });
}

export async function deleteAnnotation(id: string): Promise<void> {
  const all = await getAllAnnotations();
  await chrome.storage.local.set({ [KEY]: all.filter((x) => x.id !== id) });
}

export async function reorderAnnotations(ids: string[]): Promise<void> {
  const all = await getAllAnnotations();
  const byId = new Map(all.map((a) => [a.id, a]));
  const next = ids.map((id) => byId.get(id)).filter((a): a is Annotation => !!a);
  await chrome.storage.local.set({ [KEY]: next });
}
```

`src/store/db.ts`:

```ts
const DB_NAME = 'browser-markup';
const STORE = 'screenshots';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveScreenshot(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getScreenshot(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteScreenshot(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 5: Implement full `src/background/index.ts` (bm-capture)**

Request shape the content script sends (Task 7 consumes this):

```ts
// { type: 'bm-capture', annotation: Annotation }
// annotation.screenshotId is a fresh uuid; markerPos/boundingRect/viewport are
// viewport-relative CSS px at capture time. Response: { ok: true, screenshot: boolean }
```

```ts
import { cropBox } from '../shared/coords';
import { saveScreenshot } from '../store/db';
import { saveAnnotation } from '../store/annotations';
import type { Annotation, Shape } from '../shared/types';

interface CaptureRequest { type: 'bm-capture'; annotation: Annotation; }

chrome.runtime.onMessage.addListener((msg: CaptureRequest, _sender, sendResponse) => {
  if (msg?.type !== 'bm-capture') return false;
  handleCapture(msg.annotation)
    .then((screenshot) => sendResponse({ ok: true, screenshot }))
    .catch(async (err) => {
      msg.annotation.screenshotId = null;
      await saveAnnotation(msg.annotation);
      sendResponse({ ok: true, screenshot: false, error: String(err) });
    });
  return true;
});

async function handleCapture(a: Annotation): Promise<boolean> {
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const box = cropBox(
    { x: 0, y: 0, w: a.viewport.w, h: a.viewport.h },
    a.viewport.dpr, bmp.width, bmp.height,
  );
  const canvas = new OffscreenCanvas(box.w, box.h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  burnOverlay(ctx, a);
  const out = await canvas.convertToBlob({ type: 'image/png' });
  await saveScreenshot(a.screenshotId!, out);
  await saveAnnotation(a);
  return true;
}

/** Burn the numbered marker and shapes onto the cropped viewport shot. */
function burnOverlay(ctx: OffscreenCanvasRenderingContext2D, a: Annotation): void {
  const dpr = a.viewport.dpr;
  const mx = a.markerPos.x * dpr;
  const my = a.markerPos.y * dpr;
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.arc(mx, my, 11 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${13 * dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(a.n), mx, my);
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 2 * dpr;
  for (const s of a.shapes) drawShape(ctx, s, dpr);
}

function drawShape(ctx: OffscreenCanvasRenderingContext2D, s: Shape, dpr: number): void {
  const p = s.points.map((v) => v * dpr);
  if (s.type === 'rect' && p.length >= 4) {
    ctx.strokeRect(p[0], p[1], p[2] - p[0], p[3] - p[1]);
  } else if (s.type === 'arrow' && p.length >= 4) {
    const [x1, y1, x2, y2] = p;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 10 * dpr;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - 0.5), y2 - head * Math.sin(angle - 0.5));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle + 0.5), y2 - head * Math.sin(angle + 0.5));
    ctx.stroke();
  } else if (s.type === 'freehand' && p.length >= 4) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  }
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});
```

- [ ] **Step 6: Run tests and build**

Run: `npm test` — Expected: PASS (coords 2 + annotations 4 + earlier suites).
Run: `npm run build && npx tsc --noEmit` — Expected: clean.
Manual: pin flow not wired yet; verify no service-worker errors on install.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat: DPR crop math, IndexedDB screenshot store, annotation store, bm-capture service worker"
git push
```

---

### Task 5: LLM report.md generator

**Files:**
- Create: `src/shared/report-md.ts`, `tests/report-md.test.ts`

**Interfaces:**
- Consumes: `Annotation` (Task 2), `makeAnnotation` fixture (Task 2). Wave-2
  parallel note: this is dashboard-side code — importing `types.ts` is safe
  (type-only import, erased; and report-md is imported only by the dashboard
  entry, never by the content entry).
- Produces: `generateReportMd(annotations: Annotation[]): string`,
  `shotPath(a: Annotation): string | null` (`shots/0N.png` from `a.n`).

- [ ] **Step 1: Write the failing test**

`tests/report-md.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateReportMd, shotPath } from '../src/shared/report-md';
import { makeAnnotation } from './fixtures';

describe('generateReportMd', () => {
  it('opens with the LLM preamble', () => {
    const md = generateReportMd([makeAnnotation()]);
    expect(md).toContain('You are fixing UI bugs in a web app');
    expect(md.startsWith('# UI Bug Report')).toBe(true);
  });

  it('prefers the edited comment over the original', () => {
    const md = generateReportMd([makeAnnotation({ commentEdited: 'Use flexbox here' })]);
    expect(md).toContain('**Comment:** Use flexbox here');
    expect(md).toContain('**Original comment:** Button overlaps text');
  });

  it('includes selector, URL, styles, console errors and shot path', () => {
    const md = generateReportMd([makeAnnotation()]);
    expect(md).toContain('`#price`');
    expect(md).toContain('https://example.com/pricing');
    expect(md).toContain('- display: block');
    expect(md).toContain('[error] TypeError: x is null');
    expect(md).toContain('shots/01.png');
  });

  it('notes a missing screenshot instead of a path', () => {
    const md = generateReportMd([makeAnnotation({ screenshotId: null })]);
    expect(md).toContain('not captured');
    expect(md).not.toContain('shots/01.png');
  });

  it('shows (none captured) when there are no console errors', () => {
    const md = generateReportMd([makeAnnotation({ consoleErrors: [] })]);
    expect(md).toContain('- (none captured)');
  });

  it('keeps the explicit truncation marker in element HTML', () => {
    const md = generateReportMd([makeAnnotation({ elementHTML: '<div>…[truncated]' })]);
    expect(md).toContain('…[truncated]');
  });
});

describe('shotPath', () => {
  it('zero-pads the pin number', () => {
    expect(shotPath(makeAnnotation({ n: 3 }))).toBe('shots/03.png');
    expect(shotPath(makeAnnotation({ screenshotId: null }))).toBeNull();
  });
});
```

Run: `npm test` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/shared/report-md.ts`**

```ts
import type { Annotation } from './types';

const PREAMBLE = `# UI Bug Report

You are fixing UI bugs in a web app. Each section below is one bug captured by
a human reviewer on a live page, with page context: URL, CSS selector, element
text/HTML, computed styles, console errors near capture time, and a screenshot
with a numbered marker on the affected element. Locate each bug in the
codebase and fix it. Screenshot paths are relative to this file.
`;

export function shotPath(a: Annotation): string | null {
  return a.screenshotId ? `shots/${String(a.n).padStart(2, '0')}.png` : null;
}

export function generateReportMd(annotations: Annotation[]): string {
  const parts = [PREAMBLE];
  annotations.forEach((a) => parts.push(renderBug(a)));
  return parts.join('\n');
}

function renderBug(a: Annotation): string {
  const shot = shotPath(a);
  const comment = a.commentEdited.trim() || a.comment;
  const title = comment.split('\n')[0].trim() || '(no comment)';
  const styles = Object.entries(a.computedStyles)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const errors = a.consoleErrors.length
    ? a.consoleErrors
        .map((e) => `- [${e.level}] ${e.message}${e.stack ? `\n  ${e.stack.split('\n').join('\n  ')}` : ''}`)
        .join('\n')
    : '- (none captured)';
  const original = a.commentEdited.trim() && a.comment
    ? `**Original comment:** ${a.comment}\n`
    : '';
  return `## Bug ${a.n}: ${title}

**Comment:** ${comment || '(none)'}
${original}**URL:** ${a.url}
**Page title:** ${a.pageTitle}
**Captured:** ${a.createdAt}
**Selector:** \`${a.selector}\`
**Element text:** ${a.elementText || '(empty)'}

**Element HTML:**
\`\`\`html
${a.elementHTML}
\`\`\`

**Computed styles:**
${styles}

**Viewport:** ${a.viewport.w}x${a.viewport.h} @${a.viewport.dpr}x
**Bounding rect (CSS px):** x=${a.boundingRect.x} y=${a.boundingRect.y} w=${a.boundingRect.w} h=${a.boundingRect.h}

**Console errors:**
${errors}

**Screenshot:** ${shot ?? 'not captured (protected page or capture failure)'}
`;
}
```

- [ ] **Step 3: Run tests**

Run: `npm test` — Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: LLM report.md generator with tests"
git push
```

---

### Task 6: Self-contained HTML report generator

**Files:**
- Create: `src/shared/report-html.ts`, `tests/report-html.test.ts`

**Interfaces:**
- Consumes: `Annotation` (Task 2), `makeAnnotation` (Task 2). Same wave-2
  import rule as Task 5 (dashboard-side only).
- Produces: `escapeHtml(s: string): string`,
  `pinPosition(a: Annotation): { left: string; top: string }` (percent strings,
  3 decimals), `generateReportHtml(annotations: Annotation[], shots: Map<string, string>): string`
  (shots maps `screenshotId` -> data URL). Consumed by Task 11.

- [ ] **Step 1: Write the failing test**

`tests/report-html.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { escapeHtml, pinPosition, generateReportHtml } from '../src/shared/report-html';
import { makeAnnotation } from './fixtures';

describe('escapeHtml', () => {
  it('escapes markup-significant characters', () => {
    expect(escapeHtml('<script>"x"&\'')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;');
  });
});

describe('pinPosition', () => {
  it('converts marker px to viewport percentages with 3 decimals', () => {
    expect(pinPosition(makeAnnotation())) // 220/1440, 364/900
      .toEqual({ left: '15.278%', top: '40.444%' });
  });
});

describe('generateReportHtml', () => {
  const shots = new Map([['shot-1', 'data:image/png;base64,AAAA']]);

  it('inlines the screenshot and positions the pin over it', () => {
    const html = generateReportHtml([makeAnnotation()], shots);
    expect(html).toContain('data:image/png;base64,AAAA');
    expect(html).toContain('left:15.278%');
    expect(html).toContain('>1</div>'); // pin label = a.n
  });

  it('escapes comments and element HTML', () => {
    const html = generateReportHtml(
      [makeAnnotation({ commentEdited: '<b>bold</b>', elementHTML: '<img src=x>' })],
      shots,
    );
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
  });

  it('has anchor links from the sidebar to each bug section', () => {
    const html = generateReportHtml([makeAnnotation({ id: 'bug-9' })], shots);
    expect(html).toContain('href="#bug-bug-9"');
    expect(html).toContain('id="bug-bug-9"');
  });

  it('notes missing screenshots', () => {
    const html = generateReportHtml([makeAnnotation({ screenshotId: null })], new Map());
    expect(html).toContain('Screenshot not captured');
  });
});
```

Run: `npm test` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/shared/report-html.ts`**

```ts
import type { Annotation } from './types';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** Marker position as percentages of the viewport-sized screenshot. */
export function pinPosition(a: Annotation): { left: string; top: string } {
  return {
    left: `${((a.markerPos.x / a.viewport.w) * 100).toFixed(3)}%`,
    top: `${((a.markerPos.y / a.viewport.h) * 100).toFixed(3)}%`,
  };
}

export function generateReportHtml(annotations: Annotation[], shots: Map<string, string>): string {
  const items = annotations.map(renderSidebarItem).join('\n');
  const sections = annotations.map((a) => renderSection(a, shots)).join('\n');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>UI Bug Report</title>
<style>
  body { margin: 0; display: flex; font: 14px system-ui, sans-serif; color: #1f2933; }
  nav { width: 260px; flex: none; padding: 16px; border-right: 1px solid #e4e7eb;
        position: sticky; top: 0; height: 100vh; overflow: auto; box-sizing: border-box; }
  nav a { display: block; padding: 6px 0; color: #0b5fff; text-decoration: none; }
  main { padding: 24px; max-width: 980px; }
  .bug { margin-bottom: 48px; }
  .shot { position: relative; display: inline-block; border: 1px solid #e4e7eb; }
  .shot img { display: block; max-width: 900px; width: 100%; }
  .pin { position: absolute; width: 24px; height: 24px; margin: -12px 0 0 -12px;
         border-radius: 50%; background: #e11d48; color: #fff; font-weight: 700;
         display: flex; align-items: center; justify-content: center; font-size: 13px; }
  dl { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; }
  dt { font-weight: 600; } dd { margin: 0; }
  pre { background: #f5f7fa; padding: 12px; overflow: auto; }
</style>
</head>
<body>
<nav>
  <h2>UI Bug Report</h2>
  <p>${annotations.length} bug(s) — generated ${escapeHtml(new Date().toISOString())}</p>
  ${items}
</nav>
<main>
${sections}
</main>
</body>
</html>`;
}

function renderSidebarItem(a: Annotation): string {
  const label = escapeHtml((a.commentEdited.trim() || a.comment || '(no comment)').split('\n')[0]);
  return `<a href="#bug-${escapeHtml(a.id)}">#${a.n} ${label}</a>`;
}

function renderSection(a: Annotation, shots: Map<string, string>): string {
  const comment = a.commentEdited.trim() || a.comment;
  const dataUrl = a.screenshotId ? shots.get(a.screenshotId) : undefined;
  const pin = pinPosition(a);
  const shot = dataUrl
    ? `<div class="shot"><img src="${dataUrl}" alt="screenshot"><div class="pin" style="left:${pin.left};top:${pin.top}">${a.n}</div></div>`
    : '<p><em>Screenshot not captured (protected page or capture failure).</em></p>';
  const errors = a.consoleErrors.length
    ? `<pre>${escapeHtml(a.consoleErrors.map((e) => `[${e.level}] ${e.message}${e.stack ? '\n' + e.stack : ''}`).join('\n\n'))}</pre>`
    : '<p>(none captured)</p>';
  return `<section class="bug" id="bug-${escapeHtml(a.id)}">
  <h2>Bug ${a.n}: ${escapeHtml(comment.split('\n')[0] || '(no comment)')}</h2>
  <p>${escapeHtml(comment)}</p>
  ${shot}
  <dl>
    <dt>URL</dt><dd>${escapeHtml(a.url)}</dd>
    <dt>Page title</dt><dd>${escapeHtml(a.pageTitle)}</dd>
    <dt>Captured</dt><dd>${escapeHtml(a.createdAt)}</dd>
    <dt>Selector</dt><dd><code>${escapeHtml(a.selector)}</code></dd>
    <dt>Viewport</dt><dd>${a.viewport.w}x${a.viewport.h} @${a.viewport.dpr}x</dd>
  </dl>
  <h3>Element HTML</h3>
  <pre>${escapeHtml(a.elementHTML)}</pre>
  <h3>Console errors</h3>
  ${errors}
</section>`;
}
```

- [ ] **Step 3: Run tests**

Run: `npm test` — Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: self-contained HTML report generator with tests"
git push
```

---

### Task 7: Content overlay — pin, comment popover, metadata capture

**Files:**
- Create: `src/content/picker.ts`, `src/content/popover.ts`, `src/content/capture.ts`
- Modify: `src/content/index.ts` (full rewrite below)

**Interfaces:**
- Consumes: `cssSelector` (Task 2), `requestConsoleSnapshot` (Task 3),
  `bm-capture` background message (Task 4), `Annotation` types (Task 2).
  These are content-entry imports only: `selector.ts` and `console-bridge.ts`
  are imported **only** by the content entry, so Rollup inlines them — the
  import-free rule holds.
- Produces: working capture flow; `captureElement(el, comment, consoleErrors, n): Annotation`
  (also used by Task 8); `startPicker(shadow, onPick: (el: Element) => void): () => void`
  returning a cancel function (Task 8 reuses the shadow-root pattern).
- No new unit tests (DOM-heavy UI; manual verification per spec). Existing
  suites must stay green and `dist/content.js` must stay import-free.

- [ ] **Step 1: Write `src/content/capture.ts`**

```ts
import type { Annotation, ConsoleEntry } from '../shared/types';
import { cssSelector } from '../shared/selector';

const HTML_CAP = 4096;
const STYLE_KEYS = ['display', 'position', 'margin', 'padding', 'font', 'color'] as const;

/** Build an Annotation for a picked element. `n` is the per-page pin number. */
export function captureElement(
  el: Element,
  comment: string,
  consoleErrors: ConsoleEntry[],
  n: number,
): Annotation {
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  let html = el.outerHTML;
  if (html.length > HTML_CAP) html = html.slice(0, HTML_CAP) + '…[truncated]';
  const now = new Date().toISOString();
  const computedStyles: Record<string, string> = {};
  for (const k of STYLE_KEYS) computedStyles[k] = cs.getPropertyValue(k) || (cs as any)[k] || '';
  return {
    id: crypto.randomUUID(),
    url: location.href,
    pageTitle: document.title,
    createdAt: now,
    updatedAt: now,
    selector: cssSelector(el),
    elementText: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 280),
    elementHTML: html,
    computedStyles,
    boundingRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    shapes: [],
    comment,
    commentEdited: '',
    consoleErrors,
    screenshotId: crypto.randomUUID(),
    markerPos: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    status: 'open',
    n,
  };
}
```

- [ ] **Step 2: Write `src/content/picker.ts`**

```ts
/** Hover-highlight + click-to-pick. Lives inside the given shadow root.
 *  Returns a cancel function that removes listeners and the highlight box. */
export function startPicker(shadow: ShadowRoot, onPick: (el: Element) => void): () => void {
  const box = document.createElement('div');
  box.setAttribute(
    'style',
    'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #e11d48;' +
      'background:rgba(225,29,72,0.08);display:none;',
  );
  shadow.appendChild(box);

  const onMove = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id === 'browser-markup-host' || el.closest('#browser-markup-host')) return;
    const r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  };
  const onClick = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('#browser-markup-host')) return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
    onPick(el);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cancel();
  };
  function cancel() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    box.remove();
  }
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  return cancel;
}
```

- [ ] **Step 3: Write `src/content/popover.ts`**

```ts
/** Word-style comment popover anchored at viewport position (x, y).
 *  onSave receives the comment text; onCancel fires on Escape/Cancel. */
export function openCommentPopover(
  shadow: ShadowRoot,
  pos: { x: number; y: number },
  onSave: (comment: string) => void,
  onCancel: () => void,
): void {
  const wrap = document.createElement('div');
  wrap.setAttribute(
    'style',
    `position:fixed;left:${Math.min(pos.x + 16, window.innerWidth - 320)}px;` +
      `top:${Math.min(pos.y, window.innerHeight - 180)}px;z-index:2147483647;` +
      'background:#fff;color:#1f2933;border:1px solid #d0d5dd;border-radius:8px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.18);padding:12px;width:300px;font:13px system-ui,sans-serif;',
  );
  wrap.innerHTML = `
    <textarea rows="3" placeholder="What's wrong here?"
      style="width:100%;box-sizing:border-box;font:inherit;resize:vertical;"></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
      <button data-act="cancel" type="button">Cancel</button>
      <button data-act="save" type="button" style="background:#e11d48;color:#fff;border:0;border-radius:4px;padding:4px 12px;">Save pin</button>
    </div>`;
  const ta = wrap.querySelector('textarea')!;
  const close = () => wrap.remove();
  wrap.querySelector('[data-act="cancel"]')!.addEventListener('click', () => { close(); onCancel(); });
  wrap.querySelector('[data-act="save"]')!.addEventListener('click', () => { const v = ta.value; close(); onSave(v); });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); onCancel(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { const v = ta.value; close(); onSave(v); }
    e.stopPropagation();
  });
  shadow.appendChild(wrap);
  ta.focus();
}
```

- [ ] **Step 4: Rewrite `src/content/index.ts` — wire the flow**

```ts
import { startPicker } from './picker';
import { openCommentPopover } from './popover';
import { captureElement } from './capture';
import { requestConsoleSnapshot } from './console-bridge';

const host = document.createElement('div');
host.id = 'browser-markup-host';
const shadow = host.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    .bm-toolbar { position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      background: #1e1e2e; color: #fff; padding: 8px 12px; border-radius: 8px;
      font: 13px system-ui, sans-serif; display: flex; gap: 8px; align-items: center; }
    .bm-toolbar button { cursor: pointer; }
    .bm-marker { position: fixed; z-index: 2147483645; width: 24px; height: 24px;
      margin: -12px 0 0 -12px; border-radius: 50%; background: #e11d48; color: #fff;
      font: bold 13px/24px system-ui; text-align: center; pointer-events: none; }
  </style>
  <div class="bm-toolbar">
    <span>Browser-Markup</span>
    <button id="bm-pin" type="button">Pin</button>
  </div>`;
document.documentElement.appendChild(host);

let pinCount = 0;
let picking: (() => void) | null = null;

function dropMarker(n: number, pos: { x: number; y: number }): void {
  const m = document.createElement('div');
  m.className = 'bm-marker';
  m.textContent = String(n);
  m.style.left = `${pos.x}px`;
  m.style.top = `${pos.y}px`;
  shadow.appendChild(m);
}

function startPinFlow(): void {
  if (picking) return;
  picking = startPicker(shadow, (el) => {
    picking = null;
    const rect = el.getBoundingClientRect();
    const pos = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    openCommentPopover(
      shadow,
      pos,
      async (comment) => {
        const consoleErrors = await requestConsoleSnapshot();
        const annotation = captureElement(el, comment, consoleErrors as any, ++pinCount);
        await chrome.runtime.sendMessage({ type: 'bm-capture', annotation });
        dropMarker(annotation.n, pos);
      },
      () => {},
    );
  });
}

shadow.getElementById('bm-pin')!.addEventListener('click', startPinFlow);
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run build && npx tsc --noEmit` — Expected: green.
Run: `grep -E '^(import|export) ' dist/content.js || echo CONTENT_OK` — Expected: `CONTENT_OK`.
Manual: load unpacked → Pin → hover highlights → click element → popover →
Save pin → red numbered marker stays on page; DevTools extension
service-worker log shows no errors.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat: pin flow — picker, comment popover, metadata capture, marker"
git push
```

---

### Task 8: Draw tools — rect / arrow / freehand

**Files:**
- Create: `src/content/draw.ts`
- Modify: `src/content/index.ts` (add Draw button + integrate shapes before send)

**Interfaces:**
- Consumes: Task 7 overlay (`shadow` root pattern, `captureElement`).
- Produces: `startDrawSession(shadow: ShadowRoot): Promise<Shape[]>` — resolves
  with drawn shapes (viewport CSS px) when the user clicks "Done" in the draw
  toolbar, `[]` on cancel. Task 8 changes the pin flow: after picking an
  element the popover gains a "Draw" step; shapes are attached to
  `annotation.shapes` before `bm-capture`.

- [ ] **Step 1: Write `src/content/draw.ts`**

```ts
import type { Shape } from '../shared/types';

type Tool = 'rect' | 'arrow' | 'freehand';

/** Full-viewport drawing layer inside the shadow root.
 *  Resolves collected shapes on Done, [] on cancel. */
export function startDrawSession(shadow: ShadowRoot): Promise<Shape[]> {
  return new Promise((resolve) => {
    const shapes: Shape[] = [];
    let tool: Tool = 'rect';
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.setAttribute(
      'style',
      'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;',
    );
    const bar = document.createElement('div');
    bar.setAttribute(
      'style',
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
        'background:#1e1e2e;color:#fff;padding:8px 12px;border-radius:8px;' +
        'font:13px system-ui,sans-serif;display:flex;gap:8px;',
    );
    bar.innerHTML = `
      <button data-tool="rect" type="button">Rect</button>
      <button data-tool="arrow" type="button">Arrow</button>
      <button data-tool="freehand" type="button">Freehand</button>
      <button data-act="done" type="button">Done</button>
      <button data-act="cancel" type="button">Cancel</button>`;
    bar.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).dataset;
      if (t.tool) tool = t.tool as Tool;
      if (t.act === 'done') finish(shapes);
      if (t.act === 'cancel') finish([]);
    });
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2;

    let drawing = false;
    let startX = 0;
    let startY = 0;
    let current: number[] = [];

    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of shapes) paint(s);
      if (drawing && current.length >= 4) paint({ type: tool, points: current });
    };
    const paint = (s: Shape) => {
      const p = s.points;
      ctx.beginPath();
      if (s.type === 'rect') {
        ctx.strokeRect(p[0], p[1], p[2] - p[0], p[3] - p[1]);
      } else if (s.type === 'arrow') {
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[2], p[3]);
        ctx.stroke();
        const a = Math.atan2(p[3] - p[1], p[2] - p[0]);
        ctx.moveTo(p[2], p[3]);
        ctx.lineTo(p[2] - 10 * Math.cos(a - 0.5), p[3] - 10 * Math.sin(a - 0.5));
        ctx.moveTo(p[2], p[3]);
        ctx.lineTo(p[2] - 10 * Math.cos(a + 0.5), p[3] - 10 * Math.sin(a + 0.5));
        ctx.stroke();
      } else {
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.stroke();
      }
    };
    const onDown = (e: PointerEvent) => {
      drawing = true;
      startX = e.clientX;
      startY = e.clientY;
      current = [startX, startY];
    };
    const onMove = (e: PointerEvent) => {
      if (!drawing) return;
      if (tool === 'freehand') current.push(e.clientX, e.clientY);
      else current = [startX, startY, e.clientX, e.clientY];
      redraw();
    };
    const onUp = () => {
      if (!drawing) return;
      drawing = false;
      if (current.length >= 4) shapes.push({ type: tool, points: current });
      current = [];
      redraw();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish([]);
    };
    function finish(result: Shape[]) {
      canvas.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('keydown', onKey, true);
      canvas.remove();
      bar.remove();
      resolve(result);
    }
    canvas.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('keydown', onKey, true);
    shadow.appendChild(canvas);
    shadow.appendChild(bar);
  });
}
```

- [ ] **Step 2: Integrate into `src/content/index.ts`**

Add to the toolbar HTML (next to the Pin button):

```html
<button id="bm-draw" type="button">Draw</button>
```

Add state and wire the button so drawing happens between pick and save:

```ts
import { startDrawSession } from './draw';

let pendingShapes: import('../shared/types').Shape[] = [];

shadow.getElementById('bm-draw')!.addEventListener('click', async () => {
  pendingShapes = await startDrawSession(shadow);
});
```

And in the popover `onSave` callback, attach shapes before sending:

```ts
annotation.shapes = pendingShapes;
pendingShapes = [];
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run build && npx tsc --noEmit` — Expected: green.
Run: `grep -E '^(import|export) ' dist/content.js || echo CONTENT_OK` — Expected: `CONTENT_OK`.
Manual: Draw → drag rect/arrow/freehand → Done → Pin an element → Save →
marker appears; shapes will be burned into the screenshot by the service worker.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: draw tools (rect/arrow/freehand) attached to pins"
git push
```

---

### Task 9: Dashboard — session list, edit, delete, reorder

**Files:**
- Modify: `dashboard.html` (styles + structure), `src/dashboard/dashboard.ts` (full rewrite)

**Interfaces:**
- Consumes: `getAllAnnotations`, `saveAnnotation`, `deleteAnnotation`,
  `reorderAnnotations` (Task 4); `getScreenshot`, `deleteScreenshot` (Task 4);
  `Annotation` (Task 2).
- Produces: dashboard UI grouped by URL; per-annotation edit (`commentEdited`,
  updates `updatedAt`), delete (annotation + screenshot blob), reorder
  (up/down within group); export buttons with element ids `bm-export-llm` and
  `bm-export-html` that Tasks 10/11 wire up (this task renders them disabled).

- [ ] **Step 1: Rewrite `dashboard.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Browser-Markup Dashboard</title>
    <style>
      body { font: 14px system-ui, sans-serif; margin: 0; color: #1f2933; }
      header { display: flex; align-items: center; gap: 12px; padding: 16px 24px;
               border-bottom: 1px solid #e4e7eb; position: sticky; top: 0; background: #fff; }
      header h1 { font-size: 18px; margin: 0; flex: 1; }
      header button { padding: 6px 14px; cursor: pointer; }
      main { padding: 24px; max-width: 900px; }
      h2.group { font-size: 14px; color: #52606d; margin: 24px 0 8px; word-break: break-all; }
      .card { border: 1px solid #e4e7eb; border-radius: 8px; padding: 12px;
              margin-bottom: 12px; display: flex; gap: 12px; }
      .card img { width: 160px; border: 1px solid #e4e7eb; border-radius: 4px; align-self: flex-start; }
      .card .body { flex: 1; }
      .card textarea { width: 100%; box-sizing: border-box; font: inherit; margin-top: 6px; }
      .card .meta { color: #7b8794; font-size: 12px; margin-top: 4px; }
      .card .actions { display: flex; flex-direction: column; gap: 4px; }
      .num { display: inline-block; min-width: 22px; height: 22px; border-radius: 50%;
             background: #e11d48; color: #fff; text-align: center; font-weight: 700;
             font-size: 12px; line-height: 22px; margin-right: 6px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Browser-Markup</h1>
      <button id="bm-export-llm" type="button" disabled>Export for LLM</button>
      <button id="bm-export-html" type="button" disabled>Export HTML report</button>
    </header>
    <main id="app"></main>
    <script type="module" src="/src/dashboard/dashboard.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Rewrite `src/dashboard/dashboard.ts`**

```ts
import type { Annotation } from '../shared/types';
import {
  getAllAnnotations,
  saveAnnotation,
  deleteAnnotation,
  reorderAnnotations,
} from '../store/annotations';
import { getScreenshot, deleteScreenshot } from '../store/db';

async function render(): Promise<void> {
  const all = await getAllAnnotations();
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  if (!all.length) {
    app.textContent = 'No annotations yet.';
    return;
  }
  const groups = new Map<string, Annotation[]>();
  for (const a of all) {
    const list = groups.get(a.url) ?? [];
    list.push(a);
    groups.set(a.url, list);
  }
  for (const [url, items] of groups) {
    const h = document.createElement('h2');
    h.className = 'group';
    h.textContent = url;
    app.appendChild(h);
    items.forEach((a, i) => app.appendChild(renderCard(a, i, items, all)));
  }
}

function renderCard(a: Annotation, i: number, items: Annotation[], all: Annotation[]): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  const body = document.createElement('div');
  body.className = 'body';
  body.innerHTML = `
    <div><span class="num">${a.n}</span><strong></strong></div>
    <textarea rows="2" placeholder="Elaborate this comment for the report…"></textarea>
    <div class="meta">${a.selector} · ${a.createdAt} · ${a.status}</div>`;
  body.querySelector('strong')!.textContent = a.comment || '(no comment)';
  const ta = body.querySelector('textarea')!;
  ta.value = a.commentEdited;
  ta.addEventListener('change', async () => {
    a.commentEdited = ta.value;
    a.updatedAt = new Date().toISOString();
    await saveAnnotation(a);
  });

  const actions = document.createElement('div');
  actions.className = 'actions';
  const mkBtn = (label: string, fn: () => void | Promise<void>, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener('click', fn);
    actions.appendChild(b);
  };
  mkBtn('↑', async () => { await move(all, items, i, -1); }, i === 0);
  mkBtn('↓', async () => { await move(all, items, i, +1); }, i === items.length - 1);
  mkBtn(a.status === 'open' ? 'Resolve' : 'Reopen', async () => {
    a.status = a.status === 'open' ? 'resolved' : 'open';
    a.updatedAt = new Date().toISOString();
    await saveAnnotation(a);
    await render();
  });
  mkBtn('Delete', async () => {
    if (a.screenshotId) await deleteScreenshot(a.screenshotId);
    await deleteAnnotation(a.id);
    await render();
  });

  card.appendChild(body);
  card.appendChild(actions);
  if (a.screenshotId) {
    getScreenshot(a.screenshotId).then((blob) => {
      if (!blob) return;
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      card.insertBefore(img, body);
    });
  }
  return card;
}

async function move(all: Annotation[], items: Annotation[], i: number, delta: number): Promise<void> {
  const j = i + delta;
  if (j < 0 || j >= items.length) return;
  const ids = all.map((a) => a.id);
  const ai = ids.indexOf(items[i].id);
  const aj = ids.indexOf(items[j].id);
  [ids[ai], ids[aj]] = [ids[aj], ids[ai]];
  await reorderAnnotations(ids);
  await render();
}

render();
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run build && npx tsc --noEmit` — Expected: green.
Manual: capture 2 pins on a page → click extension icon → dashboard lists the
URL group with cards + thumbnails → edit elaboration (persists across reload)
→ reorder, resolve, delete all work; export buttons visible but disabled.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: dashboard — grouped list, edit, delete, reorder, resolve"
git push
```

---

### Task 10: LLM bundle export

**Files:**
- Create: `src/dashboard/export-llm.ts`
- Modify: `src/dashboard/dashboard.ts` (wire `bm-export-llm` button, enable it)

**Interfaces:**
- Consumes: `generateReportMd`, `shotPath` (Task 5); `getAllAnnotations`
  (Task 4); `getScreenshot` (Task 4); `Annotation` (Task 2).
- Produces: `exportLlmBundle(): Promise<void>` — writes
  `report.md`, `bundle.json`, `shots/0N.png` via the File System Access API
  directory picker; falls back to individual downloads when the picker is
  unavailable or denied.

- [ ] **Step 1: Write `src/dashboard/export-llm.ts`**

```ts
import type { Annotation } from '../shared/types';
import { generateReportMd, shotPath } from '../shared/report-md';
import { getAllAnnotations } from '../store/annotations';
import { getScreenshot } from '../store/db';

interface DirHandle {
  getDirectoryHandle(name: string, opts: { create: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, opts: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
  }>;
}

async function writeText(dir: DirHandle, name: string, text: string): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

async function writeBlob(dir: DirHandle, name: string, blob: Blob): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export async function exportLlmBundle(): Promise<void> {
  const annotations = await getAllAnnotations();
  if (!annotations.length) return;
  const report = generateReportMd(annotations);
  const bundle = JSON.stringify(
    { generatedAt: new Date().toISOString(), annotations },
    null,
    2,
  );
  const shots: Array<{ name: string; blob: Blob }> = [];
  for (const a of annotations) {
    const path = shotPath(a);
    if (!path || !a.screenshotId) continue;
    const blob = await getScreenshot(a.screenshotId);
    if (blob) shots.push({ name: path.split('/')[1], blob });
  }

  const picker = (window as any).showDirectoryPicker as
    | ((opts: { mode: string }) => Promise<DirHandle>)
    | undefined;
  let dir: DirHandle | null = null;
  if (picker) {
    try {
      dir = await picker({ mode: 'readwrite' });
    } catch {
      dir = null; // user denied/cancelled -> downloads fallback
    }
  }

  if (dir) {
    await writeText(dir, 'report.md', report);
    await writeText(dir, 'bundle.json', bundle);
    const shotsDir = await dir.getDirectoryHandle('shots', { create: true });
    for (const s of shots) await writeBlob(shotsDir, s.name, s.blob);
  } else {
    download('report.md', new Blob([report], { type: 'text/markdown' }));
    download('bundle.json', new Blob([bundle], { type: 'application/json' }));
    for (const s of shots) download(s.name, s.blob);
  }
}
```

- [ ] **Step 2: Wire the button in `src/dashboard/dashboard.ts`**

Add the import and, at the end of `render()` (after the empty-state check), enable + wire:

```ts
import { exportLlmBundle } from './export-llm';

// inside render(), after the `if (!all.length)` early return:
const llmBtn = document.getElementById('bm-export-llm') as HTMLButtonElement;
llmBtn.disabled = false;
llmBtn.onclick = () => exportLlmBundle();
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run build && npx tsc --noEmit` — Expected: green.
Manual: dashboard → Export for LLM → pick a folder → it contains
`report.md`, `bundle.json`, `shots/01.png…`; report.md shows comments,
selectors, console errors and correct shot paths. Cancel the picker →
files download individually instead.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: LLM bundle export (report.md + bundle.json + shots) with downloads fallback"
git push
```

---

### Task 11: HTML report export + polish (shortcuts, pin re-attach)

**Files:**
- Create: `src/dashboard/export-html.ts`, `src/content/reattach.ts`
- Modify: `src/dashboard/dashboard.ts` (wire `bm-export-html`), `src/content/index.ts` (keyboard shortcuts + re-attach call), `src/background/index.ts` (add `bm-list-for-url` handler)

**Interfaces:**
- Consumes: `generateReportHtml` (Task 6), `getScreenshot`/`getAllAnnotations`
  (Task 4), `saveAnnotation` (Task 4), dashboard button ids (Task 9).
- Produces: `exportHtmlReport(): Promise<void>`; background message
  `{type:'bm-list-for-url', url}` → `{annotations: Annotation[]}`; content-side
  re-attach that renders ghost markers for stored pins on page load and flags
  `"element moved"` when the selector no longer matches (sets
  `commentEdited` suffix, keeps coordinates fallback).

- [ ] **Step 1: Write `src/dashboard/export-html.ts`**

```ts
import { generateReportHtml } from '../shared/report-html';
import { getAllAnnotations } from '../store/annotations';
import { getScreenshot } from '../store/db';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function exportHtmlReport(): Promise<void> {
  const annotations = await getAllAnnotations();
  if (!annotations.length) return;
  const shots = new Map<string, string>();
  for (const a of annotations) {
    if (!a.screenshotId) continue;
    const blob = await getScreenshot(a.screenshotId);
    if (blob) shots.set(a.screenshotId, await blobToDataUrl(blob));
  }
  const html = generateReportHtml(annotations, shots);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = 'ui-bug-report.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
```

- [ ] **Step 2: Wire `bm-export-html` in `dashboard.ts`** (same pattern as Task 10)

```ts
import { exportHtmlReport } from './export-html';

// inside render(), after the empty-state early return:
const htmlBtn = document.getElementById('bm-export-html') as HTMLButtonElement;
htmlBtn.disabled = false;
htmlBtn.onclick = () => exportHtmlReport();
```

- [ ] **Step 3: Add `bm-list-for-url` to `src/background/index.ts`**

Inside the existing `onMessage` listener, before the `return false` fallthrough:

```ts
if (msg?.type === 'bm-list-for-url') {
  getAllAnnotations()
    .then((all) => sendResponse({ annotations: all.filter((x) => x.url === msg.url) }))
    .catch(() => sendResponse({ annotations: [] }));
  return true;
}
```

(add `getAllAnnotations` to the `../store/annotations` import.)

- [ ] **Step 4: Write `src/content/reattach.ts`**

```ts
import type { Annotation } from '../shared/types';

/** Re-render stored pins for this URL as ghost markers.
 *  Selector hit -> marker at the element's current position.
 *  Miss -> coordinates fallback + flag the annotation as "element moved". */
export async function reattachPins(shadow: ShadowRoot): Promise<void> {
  const res = await chrome.runtime.sendMessage({ type: 'bm-list-for-url', url: location.href });
  const annotations: Annotation[] = res?.annotations ?? [];
  for (const a of annotations) {
    const el = document.querySelector(a.selector);
    let pos = a.markerPos;
    if (el) {
      const r = el.getBoundingClientRect();
      pos = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    } else {
      await chrome.runtime.sendMessage({ type: 'bm-flag-moved', id: a.id });
    }
    const m = document.createElement('div');
    m.className = 'bm-marker';
    m.textContent = String(a.n);
    m.style.left = `${pos.x}px`;
    m.style.top = `${pos.y}px`;
    if (!el) m.style.background = '#f59e0b'; // amber = moved
    shadow.appendChild(m);
  }
}
```

- [ ] **Step 5: Add the `bm-flag-moved` handler to `src/background/index.ts`**

Re-saving via `bm-capture` would overwrite the stored screenshot reference, so
moved-flagging gets its own lightweight message (no new screenshot):

```ts
if (msg?.type === 'bm-flag-moved') {
  getAllAnnotations()
    .then(async (all) => {
      const a = all.find((x) => x.id === msg.id);
      if (a && !a.commentEdited.includes('[element moved]')) {
        a.commentEdited = `${a.commentEdited} [element moved]`.trim();
        a.updatedAt = new Date().toISOString();
        await saveAnnotation(a);
      }
    })
    .then(() => sendResponse({ ok: true }));
  return true;
}
```

- [ ] **Step 6: Wire shortcuts + re-attach in `src/content/index.ts`**

```ts
import { reattachPins } from './reattach';

// after toolbar setup:
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); startPinFlow(); }
}, true);

reattachPins(shadow);
```

(`Esc` already cancels picker/draw/popover via their own listeners.)

- [ ] **Step 7: Verify**

Run: `npm test && npm run build && npx tsc --noEmit` — Expected: green (full suite).
Run: `grep -E '^(import|export) ' dist/content.js || echo CONTENT_OK` — Expected: `CONTENT_OK`.
Manual:
1. Pin 2 bugs on a page, one with a drawing; Export HTML report → single file
   with inlined shots, pins over markers, working sidebar anchors.
2. Reload the page → ghost markers reappear at the pinned elements.
3. Test on a page where the element is gone → amber marker + `[element moved]`
   appended in the dashboard.
4. Alt+P starts pin mode.

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "feat: HTML report export, keyboard shortcuts, pin re-attach with moved-element fallback"
git push
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| Architecture units (overlay, hook, SW, store, dashboard, exporters) | T1, T3, T4, T7, T9, T5/T6 |
| Console capture (MAIN world, ring buffer 50, postMessage snapshot, no debugger) | T3 |
| Data model (all fields incl. elementHTML cap 4096 + `…[truncated]`, computedStyles subset) | T2, T7 |
| LLM bundle export (report.md preamble + sections, bundle.json, shots/0N.png, FS Access API) | T5, T10 |
| HTML report (self-contained, pins over shots, sidebar anchors) | T6, T11 |
| Error handling: selector fallback / element moved | T11 |
| Error handling: screenshot capture failure → save without shot | T4 (`catch` → `screenshotId = null`) |
| Error handling: directory picker denied → downloads fallback | T10 |
| Testing: selector, ring buffer, report.md, crop/DPR math (Vitest) | T2, T3, T4, T5 (+T6, store) |
| Phase 1–8 order | T1→T2/T3/T4→T7→T8→T9→T10→T11 |

**2. Placeholder scan:** all code steps carry complete code; manual-verification
steps are explicit actions with expected results, not "handle later" notes.

**3. Type consistency:** `Annotation.n`, `shotPath` (`shots/0N.png`),
`pinPosition` (3-decimal percents), message types `bm-capture` /
`bm-list-for-url` / `bm-flag-moved`, bridge types
`BM_CONSOLE_SNAPSHOT_REQUEST/RESPONSE`, and store function names are used
identically across tasks. `ConsoleEntryLike` (T3) is structurally identical to
`ConsoleEntry` (T2); T7 bridges them with an `as any` cast to keep wave-2 files
independent — acceptable, both shapes are fixed by Global Constraints.
