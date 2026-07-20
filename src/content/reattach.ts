import type { Annotation } from '../shared/types';

/** Re-render stored pins for this URL as ghost markers.
 *  Selector hit -> marker at the element's current position.
 *  Miss -> coordinates fallback + flag the annotation as "element moved". */
export async function reattachPins(shadow: ShadowRoot): Promise<void> {
  const res = await chrome.runtime.sendMessage({ type: 'bm-list-for-url', url: location.href });
  const annotations: Annotation[] = res?.annotations ?? [];
  for (const a of annotations) {
    const el = document.querySelector(a.selector);
    let pos = a.markerPos;
    if (el) {
      const r = el.getBoundingClientRect();
      pos = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    } else {
      await chrome.runtime.sendMessage({ type: 'bm-flag-moved', id: a.id });
    }
    const m = document.createElement('div');
    m.className = 'bm-marker';
    m.textContent = String(a.n);
    m.style.left = `${pos.x}px`;
    m.style.top = `${pos.y}px`;
    if (!el) m.style.background = '#f59e0b'; // amber = moved
    shadow.appendChild(m);
  }
}
