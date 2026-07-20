/** Word-style comment popover anchored at viewport position (x, y).
 *  onSave receives the comment text; onCancel fires on Escape/Cancel. */
export function openCommentPopover(
  shadow: ShadowRoot,
  pos: { x: number; y: number },
  onSave: (comment: string) => void,
  onCancel: () => void,
): void {
  const wrap = document.createElement('div');
  wrap.setAttribute(
    'style',
    `position:fixed;left:${Math.min(pos.x + 16, window.innerWidth - 320)}px;` +
      `top:${Math.min(pos.y, window.innerHeight - 180)}px;z-index:2147483647;` +
      'background:#fff;color:#1f2933;border:1px solid #d0d5dd;border-radius:8px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.18);padding:12px;width:300px;font:13px system-ui,sans-serif;',
  );
  wrap.innerHTML = `
    <textarea rows="3" placeholder="What's wrong here?"
      style="width:100%;box-sizing:border-box;font:inherit;resize:vertical;"></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
      <button data-act="cancel" type="button">Cancel</button>
      <button data-act="save" type="button" style="background:#e11d48;color:#fff;border:0;border-radius:4px;padding:4px 12px;">Save pin</button>
    </div>`;
  const ta = wrap.querySelector('textarea')!;
  const close = () => wrap.remove();
  wrap.querySelector('[data-act="cancel"]')!.addEventListener('click', () => { close(); onCancel(); });
  wrap.querySelector('[data-act="save"]')!.addEventListener('click', () => { const v = ta.value; close(); onSave(v); });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); onCancel(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { const v = ta.value; close(); onSave(v); }
    e.stopPropagation();
  });
  shadow.appendChild(wrap);
  ta.focus();
}
