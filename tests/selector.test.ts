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
