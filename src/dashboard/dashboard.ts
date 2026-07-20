import type { Annotation } from '../shared/types';
import {
  getAllAnnotations,
  saveAnnotation,
  deleteAnnotation,
  reorderAnnotations,
} from '../store/annotations';
import { getScreenshot, deleteScreenshot } from '../store/db';
import { exportLlmBundle } from './export-llm';

async function render(): Promise<void> {
  const all = await getAllAnnotations();
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  if (!all.length) {
    app.textContent = 'No annotations yet.';
    return;
  }
  const groups = new Map<string, Annotation[]>();
  for (const a of all) {
    const list = groups.get(a.url) ?? [];
    list.push(a);
    groups.set(a.url, list);
  }
  for (const [url, items] of groups) {
    const h = document.createElement('h2');
    h.className = 'group';
    h.textContent = url;
    app.appendChild(h);
    items.forEach((a, i) => app.appendChild(renderCard(a, i, items, all)));
  }
  const llmBtn = document.getElementById('bm-export-llm') as HTMLButtonElement;
  llmBtn.disabled = false;
  llmBtn.onclick = () => exportLlmBundle();
}

function renderCard(a: Annotation, i: number, items: Annotation[], all: Annotation[]): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card';
  const body = document.createElement('div');
  body.className = 'body';
  body.innerHTML = `
    <div><span class="num">${a.n}</span><strong></strong></div>
    <textarea rows="2" placeholder="Elaborate this comment for the report…"></textarea>
    <div class="meta">${a.selector} · ${a.createdAt} · ${a.status}</div>`;
  body.querySelector('strong')!.textContent = a.comment || '(no comment)';
  const ta = body.querySelector('textarea')!;
  ta.value = a.commentEdited;
  ta.addEventListener('change', async () => {
    a.commentEdited = ta.value;
    a.updatedAt = new Date().toISOString();
    await saveAnnotation(a);
  });

  const actions = document.createElement('div');
  actions.className = 'actions';
  const mkBtn = (label: string, fn: () => void | Promise<void>, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener('click', fn);
    actions.appendChild(b);
  };
  mkBtn('↑', async () => { await move(all, items, i, -1); }, i === 0);
  mkBtn('↓', async () => { await move(all, items, i, +1); }, i === items.length - 1);
  mkBtn(a.status === 'open' ? 'Resolve' : 'Reopen', async () => {
    a.status = a.status === 'open' ? 'resolved' : 'open';
    a.updatedAt = new Date().toISOString();
    await saveAnnotation(a);
    await render();
  });
  mkBtn('Delete', async () => {
    if (a.screenshotId) await deleteScreenshot(a.screenshotId);
    await deleteAnnotation(a.id);
    await render();
  });

  card.appendChild(body);
  card.appendChild(actions);
  if (a.screenshotId) {
    getScreenshot(a.screenshotId).then((blob) => {
      if (!blob) return;
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      card.insertBefore(img, body);
    });
  }
  return card;
}

async function move(all: Annotation[], items: Annotation[], i: number, delta: number): Promise<void> {
  const j = i + delta;
  if (j < 0 || j >= items.length) return;
  const ids = all.map((a) => a.id);
  const ai = ids.indexOf(items[i].id);
  const aj = ids.indexOf(items[j].id);
  [ids[ai], ids[aj]] = [ids[aj], ids[ai]];
  await reorderAnnotations(ids);
  await render();
}

render();
