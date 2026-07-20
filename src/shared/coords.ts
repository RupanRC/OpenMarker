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
