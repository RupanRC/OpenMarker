/** Hover-highlight + click-to-pick. Lives inside the given shadow root.
 *  Returns a cancel function that removes listeners and the highlight box. */
export function startPicker(shadow: ShadowRoot, onPick: (el: Element) => void): () => void {
  const box = document.createElement('div');
  box.setAttribute(
    'style',
    'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #e11d48;' +
      'background:rgba(225,29,72,0.08);display:none;',
  );
  shadow.appendChild(box);

  const onMove = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id === 'browser-markup-host' || el.closest('#browser-markup-host')) return;
    const r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  };
  const onClick = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('#browser-markup-host')) return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
    onPick(el);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cancel();
  };
  function cancel() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    box.remove();
  }
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  return cancel;
}
