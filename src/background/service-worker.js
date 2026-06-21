// MV3 service worker. Handles the keyboard command for the dashboard and a
// best-effort dead-link scan requested by the dashboard.

import { META_KEY as KEY } from "../lib/store.js";

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-dashboard") {
    chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
  }
});

// First install: show the new tab so the user sees the dashboard.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
});

// Best-effort reachability scan. NOTE: with no-cors we get opaque responses,
// so we can only reliably detect total failures (DNS / connection refused),
// not HTTP 404s. This is an inherent browser limitation, surfaced honestly.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "scan") {
    (async () => {
      const dead = await scan(Array.isArray(msg.urls) ? msg.urls : []).catch(() => []);
      try {
        const r = await chrome.storage.local.get(KEY);
        const meta = r[KEY] || {};
        meta.dead = dead;
        await chrome.storage.local.set({ [KEY]: meta });
      } catch { /* quota or other storage error — still respond */ }
      sendResponse({ dead });
    })();
    return true; // async
  }
});

export function isScannable(url) {
  try { return /^https?:$/i.test(new URL(url).protocol); } catch { return false; }
}

export async function scan(urls, { fetchFn = fetch, batch = 12, timeoutMs = 6000 } = {}) {
  urls = [...new Set(urls)].slice(0, 5000); // dedupe + cap: avoid unbounded fetch storms
  const dead = [];
  for (let i = 0; i < urls.length; i += batch) {
    const slice = urls.slice(i, i + batch);
    await Promise.allSettled(
      slice.map(async (url) => {
        if (!isScannable(url)) return; // skip file:/chrome:/javascript:/data: etc.
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), timeoutMs);
          try {
            await fetchFn(url, { method: "HEAD", mode: "no-cors", signal: ctrl.signal });
          } finally {
            clearTimeout(to);
          }
        } catch {
          dead.push(url); // network-level failure → treat as unreachable
        }
      })
    );
  }
  return dead;
}
