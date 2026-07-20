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
