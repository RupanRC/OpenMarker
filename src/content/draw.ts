import type { Shape } from '../shared/types';

type Tool = 'rect' | 'arrow' | 'freehand';

/** Full-viewport drawing layer inside the shadow root.
 *  Resolves collected shapes on Done, [] on cancel. */
export function startDrawSession(shadow: ShadowRoot): Promise<Shape[]> {
  return new Promise((resolve) => {
    const shapes: Shape[] = [];
    let tool: Tool = 'rect';
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.setAttribute(
      'style',
      'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;',
    );
    const bar = document.createElement('div');
    bar.setAttribute(
      'style',
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
        'background:#1e1e2e;color:#fff;padding:8px 12px;border-radius:8px;' +
        'font:13px system-ui,sans-serif;display:flex;gap:8px;',
    );
    bar.innerHTML = `
      <button data-tool="rect" type="button">Rect</button>
      <button data-tool="arrow" type="button">Arrow</button>
      <button data-tool="freehand" type="button">Freehand</button>
      <button data-act="done" type="button">Done</button>
      <button data-act="cancel" type="button">Cancel</button>`;
    bar.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).dataset;
      if (t.tool) tool = t.tool as Tool;
      if (t.act === 'done') finish(shapes);
      if (t.act === 'cancel') finish([]);
    });
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2;

    let drawing = false;
    let startX = 0;
    let startY = 0;
    let current: number[] = [];

    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of shapes) paint(s);
      if (drawing && current.length >= 4) paint({ type: tool, points: current });
    };
    const paint = (s: Shape) => {
      const p = s.points;
      ctx.beginPath();
      if (s.type === 'rect') {
        ctx.strokeRect(p[0], p[1], p[2] - p[0], p[3] - p[1]);
      } else if (s.type === 'arrow') {
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[2], p[3]);
        ctx.stroke();
        const a = Math.atan2(p[3] - p[1], p[2] - p[0]);
        ctx.moveTo(p[2], p[3]);
        ctx.lineTo(p[2] - 10 * Math.cos(a - 0.5), p[3] - 10 * Math.sin(a - 0.5));
        ctx.moveTo(p[2], p[3]);
        ctx.lineTo(p[2] - 10 * Math.cos(a + 0.5), p[3] - 10 * Math.sin(a + 0.5));
        ctx.stroke();
      } else {
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.stroke();
      }
    };
    const onDown = (e: PointerEvent) => {
      drawing = true;
      startX = e.clientX;
      startY = e.clientY;
      current = [startX, startY];
    };
    const onMove = (e: PointerEvent) => {
      if (!drawing) return;
      if (tool === 'freehand') current.push(e.clientX, e.clientY);
      else current = [startX, startY, e.clientX, e.clientY];
      redraw();
    };
    const onUp = () => {
      if (!drawing) return;
      drawing = false;
      if (current.length >= 4) shapes.push({ type: tool, points: current });
      current = [];
      redraw();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish([]);
    };
    function finish(result: Shape[]) {
      canvas.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('keydown', onKey, true);
      canvas.remove();
      bar.remove();
      resolve(result);
    }
    canvas.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('keydown', onKey, true);
    shadow.appendChild(canvas);
    shadow.appendChild(bar);
  });
}
