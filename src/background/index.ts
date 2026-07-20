chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ping') sendResponse({ type: 'pong' });
  return false;
});
