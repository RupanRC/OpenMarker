import { generateReportHtml } from '../shared/report-html';
import { getAllAnnotations } from '../store/annotations';
import { getScreenshot } from '../store/db';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function exportHtmlReport(): Promise<void> {
  const annotations = await getAllAnnotations();
  if (!annotations.length) return;
  const shots = new Map<string, string>();
  for (const a of annotations) {
    if (!a.screenshotId) continue;
    const blob = await getScreenshot(a.screenshotId);
    if (blob) shots.set(a.screenshotId, await blobToDataUrl(blob));
  }
  const html = generateReportHtml(annotations, shots);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = 'ui-bug-report.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
