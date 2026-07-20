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
