const escapeIdent = (s: string): string =>
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(s)
    : s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

/** Stable CSS selector path for an element: nearest id ancestor, then tag[:nth-of-type] segments. */
export function cssSelector(el: Element): string {
  if (el.id) return `#${escapeIdent(el.id)}`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.tagName !== 'HTML') {
    if (node.id) {
      parts.unshift(`#${escapeIdent(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (c) => c.tagName === node!.tagName,
      );
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}
