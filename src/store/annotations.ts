import type { Annotation } from '../shared/types';

const KEY = 'annotations';

export async function getAllAnnotations(): Promise<Annotation[]> {
  const res = await chrome.storage.local.get(KEY);
  return (res[KEY] as Annotation[] | undefined) ?? [];
}

export async function saveAnnotation(a: Annotation): Promise<void> {
  const all = await getAllAnnotations();
  const i = all.findIndex((x) => x.id === a.id);
  if (i >= 0) all[i] = a; else all.push(a);
  await chrome.storage.local.set({ [KEY]: all });
}

export async function deleteAnnotation(id: string): Promise<void> {
  const all = await getAllAnnotations();
  await chrome.storage.local.set({ [KEY]: all.filter((x) => x.id !== id) });
}

export async function reorderAnnotations(ids: string[]): Promise<void> {
  const all = await getAllAnnotations();
  const byId = new Map(all.map((a) => [a.id, a]));
  const next = ids.map((id) => byId.get(id)).filter((a): a is Annotation => !!a);
  await chrome.storage.local.set({ [KEY]: next });
}
