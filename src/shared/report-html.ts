import type { Annotation } from './types';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** Marker position as percentages of the viewport-sized screenshot. */
export function pinPosition(a: Annotation): { left: string; top: string } {
  return {
    left: `${((a.markerPos.x / a.viewport.w) * 100).toFixed(3)}%`,
    top: `${((a.markerPos.y / a.viewport.h) * 100).toFixed(3)}%`,
  };
}

export function generateReportHtml(annotations: Annotation[], shots: Map<string, string>): string {
  const items = annotations.map(renderSidebarItem).join('\n');
  const sections = annotations.map((a) => renderSection(a, shots)).join('\n');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>UI Bug Report</title>
<style>
  body { margin: 0; display: flex; font: 14px system-ui, sans-serif; color: #1f2933; }
  nav { width: 260px; flex: none; padding: 16px; border-right: 1px solid #e4e7eb;
        position: sticky; top: 0; height: 100vh; overflow: auto; box-sizing: border-box; }
  nav a { display: block; padding: 6px 0; color: #0b5fff; text-decoration: none; }
  main { padding: 24px; max-width: 980px; }
  .bug { margin-bottom: 48px; }
  .shot { position: relative; display: inline-block; border: 1px solid #e4e7eb; }
  .shot img { display: block; max-width: 900px; width: 100%; }
  .pin { position: absolute; width: 24px; height: 24px; margin: -12px 0 0 -12px;
         border-radius: 50%; background: #e11d48; color: #fff; font-weight: 700;
         display: flex; align-items: center; justify-content: center; font-size: 13px; }
  dl { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; }
  dt { font-weight: 600; } dd { margin: 0; }
  pre { background: #f5f7fa; padding: 12px; overflow: auto; }
</style>
</head>
<body>
<nav>
  <h2>UI Bug Report</h2>
  <p>${annotations.length} bug(s) — generated ${escapeHtml(new Date().toISOString())}</p>
  ${items}
</nav>
<main>
${sections}
</main>
</body>
</html>`;
}

function renderSidebarItem(a: Annotation): string {
  const label = escapeHtml((a.commentEdited.trim() || a.comment || '(no comment)').split('\n')[0]);
  return `<a href="#bug-${escapeHtml(a.id)}">#${a.n} ${label}</a>`;
}

function renderSection(a: Annotation, shots: Map<string, string>): string {
  const comment = a.commentEdited.trim() || a.comment;
  const dataUrl = a.screenshotId ? shots.get(a.screenshotId) : undefined;
  const pin = pinPosition(a);
  const shot = dataUrl
    ? `<div class="shot"><img src="${dataUrl}" alt="screenshot"><div class="pin" style="left:${pin.left};top:${pin.top}">${a.n}</div></div>`
    : '<p><em>Screenshot not captured (protected page or capture failure).</em></p>';
  const errors = a.consoleErrors.length
    ? `<pre>${escapeHtml(a.consoleErrors.map((e) => `[${e.level}] ${e.message}${e.stack ? '\n' + e.stack : ''}`).join('\n\n'))}</pre>`
    : '<p>(none captured)</p>';
  return `<section class="bug" id="bug-${escapeHtml(a.id)}">
  <h2>Bug ${a.n}: ${escapeHtml(comment.split('\n')[0] || '(no comment)')}</h2>
  <p>${escapeHtml(comment)}</p>
  ${shot}
  <dl>
    <dt>URL</dt><dd>${escapeHtml(a.url)}</dd>
    <dt>Page title</dt><dd>${escapeHtml(a.pageTitle)}</dd>
    <dt>Captured</dt><dd>${escapeHtml(a.createdAt)}</dd>
    <dt>Selector</dt><dd><code>${escapeHtml(a.selector)}</code></dd>
    <dt>Viewport</dt><dd>${a.viewport.w}x${a.viewport.h} @${a.viewport.dpr}x</dd>
  </dl>
  <h3>Element HTML</h3>
  <pre>${escapeHtml(a.elementHTML)}</pre>
  <h3>Console errors</h3>
  ${errors}
</section>`;
}
