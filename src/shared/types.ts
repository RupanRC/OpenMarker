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
