import { describe, it, expect, beforeEach } from 'vitest';
import { makeAnnotation } from './fixtures';

let backing: Record<string, unknown>;

beforeEach(() => {
  backing = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: backing[key] }),
        set: async (obj: Record<string, unknown>) => { Object.assign(backing, obj); },
      },
    },
  };
});

describe('annotations store', () => {
  it('saves and lists annotations', async () => {
    const { saveAnnotation, getAllAnnotations } = await import('../src/store/annotations');
    await saveAnnotation(makeAnnotation({ id: 'a1' }));
    await saveAnnotation(makeAnnotation({ id: 'a2', n: 2 }));
    expect((await getAllAnnotations()).map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('updates an existing annotation by id', async () => {
    const { saveAnnotation, getAllAnnotations } = await import('../src/store/annotations');
    await saveAnnotation(makeAnnotation({ id: 'a1' }));
    await saveAnnotation(makeAnnotation({ id: 'a1', commentEdited: 'edited' }));
    const all = await getAllAnnotations();
    expect(all).toHaveLength(1);
    expect(all[0].commentEdited).toBe('edited');
  });

  it('deletes by id', async () => {
    const { saveAnnotation, deleteAnnotation, getAllAnnotations } = await import('../src/store/annotations');
    await saveAnnotation(makeAnnotation({ id: 'a1' }));
    await deleteAnnotation('a1');
    expect(await getAllAnnotations()).toEqual([]);
  });

  it('reorders by id list, dropping unknown ids', async () => {
    const { saveAnnotation, reorderAnnotations, getAllAnnotations } = await import('../src/store/annotations');
    await saveAnnotation(makeAnnotation({ id: 'a1' }));
    await saveAnnotation(makeAnnotation({ id: 'a2', n: 2 }));
    await reorderAnnotations(['a2', 'ghost', 'a1']);
    expect((await getAllAnnotations()).map((a) => a.id)).toEqual(['a2', 'a1']);
  });
});
