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
