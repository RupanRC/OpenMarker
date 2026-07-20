// Browser-Markup console hook — runs in the MAIN world at document_start.
// Keeps a rolling ring buffer (50) of console.error/warn, window errors and
// unhandled rejections; answers snapshot requests over window.postMessage.
(() => {
  const CAP = 50;
  const buf = [];
  const push = (level, message, stack) => {
    buf.push({
      level,
      message: String(message),
      stack: stack ? String(stack) : undefined,
      timestamp: new Date().toISOString(),
    });
    if (buf.length > CAP) buf.shift();
  };
  const fmt = (args) =>
    args
      .map((a) => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      })
      .join(' ');
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args) => { push('error', fmt(args), new Error().stack); origError(...args); };
  console.warn = (...args) => { push('warn', fmt(args), undefined); origWarn(...args); };
  window.addEventListener('error', (e) =>
    push('error', e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', (e) =>
    push('error', 'unhandledrejection: ' + ((e.reason && e.reason.message) || e.reason),
      e.reason && e.reason.stack));
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.type === 'BM_CONSOLE_SNAPSHOT_REQUEST') {
      window.postMessage({ type: 'BM_CONSOLE_SNAPSHOT_RESPONSE', entries: buf.slice() }, '*');
    }
  });
})();
