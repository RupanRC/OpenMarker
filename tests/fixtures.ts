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
