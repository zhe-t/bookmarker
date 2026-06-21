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
    scan(msg.urls || []).then((dead) => {
      chrome.storage.local.get(KEY).then((r) => {
        const meta = r[KEY] || {};
        meta.dead = dead;
        chrome.storage.local.set({ [KEY]: meta });
      });
      sendResponse({ dead });
    }).catch(() => sendResponse({ dead: [] }));
    return true; // async
  }
});

async function scan(urls) {
  const dead = [];
  const batch = 12;
  for (let i = 0; i < urls.length; i += batch) {
    const slice = urls.slice(i, i + batch);
    await Promise.allSettled(
      slice.map(async (url) => {
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 6000);
          await fetch(url, { method: "HEAD", mode: "no-cors", signal: ctrl.signal });
          clearTimeout(to);
        } catch {
          dead.push(url); // network-level failure → treat as unreachable
        }
      })
    );
  }
  return dead;
}
