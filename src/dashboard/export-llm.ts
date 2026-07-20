import type { Annotation } from '../shared/types';
import { generateReportMd, shotPath } from '../shared/report-md';
import { getAllAnnotations } from '../store/annotations';
import { getScreenshot } from '../store/db';

interface DirHandle {
  getDirectoryHandle(name: string, opts: { create: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, opts: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
  }>;
}

async function writeText(dir: DirHandle, name: string, text: string): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

async function writeBlob(dir: DirHandle, name: string, blob: Blob): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export async function exportLlmBundle(): Promise<void> {
  const annotations = await getAllAnnotations();
  if (!annotations.length) return;
  const report = generateReportMd(annotations);
  const bundle = JSON.stringify(
    { generatedAt: new Date().toISOString(), annotations },
    null,
    2,
  );
  const shots: Array<{ name: string; blob: Blob }> = [];
  for (const a of annotations) {
    const path = shotPath(a);
    if (!path || !a.screenshotId) continue;
    const blob = await getScreenshot(a.screenshotId);
    if (blob) shots.push({ name: path.split('/')[1], blob });
  }

  const picker = (window as any).showDirectoryPicker as
    | ((opts: { mode: string }) => Promise<DirHandle>)
    | undefined;
  let dir: DirHandle | null = null;
  if (picker) {
    try {
      dir = await picker({ mode: 'readwrite' });
    } catch {
      dir = null; // user denied/cancelled -> downloads fallback
    }
  }

  if (dir) {
    await writeText(dir, 'report.md', report);
    await writeText(dir, 'bundle.json', bundle);
    const shotsDir = await dir.getDirectoryHandle('shots', { create: true });
    for (const s of shots) await writeBlob(shotsDir, s.name, s.blob);
  } else {
    download('report.md', new Blob([report], { type: 'text/markdown' }));
    download('bundle.json', new Blob([bundle], { type: 'application/json' }));
    for (const s of shots) download(s.name, s.blob);
  }
}
