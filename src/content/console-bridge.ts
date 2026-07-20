export interface ConsoleEntryLike {
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  timestamp: string;
}

/** Ask the MAIN-world hook for its current ring-buffer snapshot. Resolves [] on timeout. */
export function requestConsoleSnapshot(timeoutMs = 200): Promise<ConsoleEntryLike[]> {
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === window && e.data?.type === 'BM_CONSOLE_SNAPSHOT_RESPONSE') {
        window.removeEventListener('message', onMsg);
        resolve(e.data.entries as ConsoleEntryLike[]);
      }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ type: 'BM_CONSOLE_SNAPSHOT_REQUEST' }, '*');
    setTimeout(() => {
      window.removeEventListener('message', onMsg);
      resolve([]);
    }, timeoutMs);
  });
}
