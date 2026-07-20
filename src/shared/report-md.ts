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
