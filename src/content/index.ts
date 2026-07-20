const host = document.createElement('div');
host.id = 'browser-markup-host';
const shadow = host.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    .bm-toolbar { position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      background: #1e1e2e; color: #fff; padding: 8px 12px; border-radius: 8px;
      font: 13px system-ui, sans-serif; display: flex; gap: 8px; align-items: center; }
    .bm-toolbar button { cursor: pointer; }
  </style>
  <div class="bm-toolbar">
    <span>Browser-Markup</span>
    <button id="bm-pin" type="button">Pin</button>
  </div>`;
document.documentElement.appendChild(host);
