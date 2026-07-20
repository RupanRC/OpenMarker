import { cropBox } from '../shared/coords';
import { saveScreenshot } from '../store/db';
import { saveAnnotation } from '../store/annotations';
import type { Annotation, Shape } from '../shared/types';

interface CaptureRequest { type: 'bm-capture'; annotation: Annotation; }

chrome.runtime.onMessage.addListener((msg: CaptureRequest, _sender, sendResponse) => {
  if (msg?.type !== 'bm-capture') return false;
  handleCapture(msg.annotation)
    .then((screenshot) => sendResponse({ ok: true, screenshot }))
    .catch(async (err) => {
      msg.annotation.screenshotId = null;
      await saveAnnotation(msg.annotation);
      sendResponse({ ok: true, screenshot: false, error: String(err) });
    });
  return true;
});

async function handleCapture(a: Annotation): Promise<boolean> {
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const box = cropBox(
    { x: 0, y: 0, w: a.viewport.w, h: a.viewport.h },
    a.viewport.dpr, bmp.width, bmp.height,
  );
  const canvas = new OffscreenCanvas(box.w, box.h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  burnOverlay(ctx, a);
  const out = await canvas.convertToBlob({ type: 'image/png' });
  await saveScreenshot(a.screenshotId!, out);
  await saveAnnotation(a);
  return true;
}

/** Burn the numbered marker and shapes onto the cropped viewport shot. */
function burnOverlay(ctx: OffscreenCanvasRenderingContext2D, a: Annotation): void {
  const dpr = a.viewport.dpr;
  const mx = a.markerPos.x * dpr;
  const my = a.markerPos.y * dpr;
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.arc(mx, my, 11 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${13 * dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(a.n), mx, my);
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 2 * dpr;
  for (const s of a.shapes) drawShape(ctx, s, dpr);
}

function drawShape(ctx: OffscreenCanvasRenderingContext2D, s: Shape, dpr: number): void {
  const p = s.points.map((v) => v * dpr);
  if (s.type === 'rect' && p.length >= 4) {
    ctx.strokeRect(p[0], p[1], p[2] - p[0], p[3] - p[1]);
  } else if (s.type === 'arrow' && p.length >= 4) {
    const [x1, y1, x2, y2] = p;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 10 * dpr;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - 0.5), y2 - head * Math.sin(angle - 0.5));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle + 0.5), y2 - head * Math.sin(angle + 0.5));
    ctx.stroke();
  } else if (s.type === 'freehand' && p.length >= 4) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  }
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});
