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
