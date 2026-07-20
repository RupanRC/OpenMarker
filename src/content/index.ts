import { startPicker } from './picker';
import { openCommentPopover } from './popover';
import { captureElement } from './capture';
import { requestConsoleSnapshot } from './console-bridge';
import { startDrawSession } from './draw';
import { reattachPins } from './reattach';

const host = document.createElement('div');
host.id = 'browser-markup-host';
const shadow = host.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    .bm-toolbar { position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      background: #1e1e2e; color: #fff; padding: 8px 12px; border-radius: 8px;
      font: 13px system-ui, sans-serif; display: flex; gap: 8px; align-items: center; }
    .bm-toolbar button { cursor: pointer; }
    .bm-marker { position: fixed; z-index: 2147483645; width: 24px; height: 24px;
      margin: -12px 0 0 -12px; border-radius: 50%; background: #e11d48; color: #fff;
      font: bold 13px/24px system-ui; text-align: center; pointer-events: none; }
  </style>
  <div class="bm-toolbar">
    <span>Browser-Markup</span>
    <button id="bm-pin" type="button">Pin</button>
    <button id="bm-draw" type="button">Draw</button>
  </div>`;
document.documentElement.appendChild(host);

let pinCount = 0;
let picking: (() => void) | null = null;
let pendingShapes: import('../shared/types').Shape[] = [];

function dropMarker(n: number, pos: { x: number; y: number }): void {
  const m = document.createElement('div');
  m.className = 'bm-marker';
  m.textContent = String(n);
  m.style.left = `${pos.x}px`;
  m.style.top = `${pos.y}px`;
  shadow.appendChild(m);
}

function startPinFlow(): void {
  if (picking) return;
  picking = startPicker(shadow, (el) => {
    picking = null;
    const rect = el.getBoundingClientRect();
    const pos = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    openCommentPopover(
      shadow,
      pos,
      async (comment) => {
        const consoleErrors = await requestConsoleSnapshot();
        const annotation = captureElement(el, comment, consoleErrors as any, ++pinCount);
        annotation.shapes = pendingShapes;
        pendingShapes = [];
        await chrome.runtime.sendMessage({ type: 'bm-capture', annotation });
        dropMarker(annotation.n, pos);
      },
      () => {},
    );
  });
}

shadow.getElementById('bm-pin')!.addEventListener('click', startPinFlow);
shadow.getElementById('bm-draw')!.addEventListener('click', async () => {
  pendingShapes = await startDrawSession(shadow);
});

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); startPinFlow(); }
}, true);

reattachPins(shadow);
