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
