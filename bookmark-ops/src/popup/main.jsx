import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadEnriched } from "../lib/bookmarks.js";
import { Palette } from "../newtab/Palette.jsx";
import "../styles.css";
import "../enhancements.css";

function Popup() {
  const [live, setLive] = useState([]);
  const theme = localStorage.getItem("bops-theme") || "dark";

  useEffect(() => { loadEnriched().then(({ all }) => setLive(all.filter((b) => !b.trashed && !b.archived))); }, []);

  const openDash = () => chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") }, () => window.close());
  const open = (b) => chrome.tabs.create({ url: b.url }, () => window.close());

  const actions = [
    { label: "Open dashboard", hint: "⌘⇧B", run: openDash },
    { label: "New bookmark from current tab", run: async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); if (t?.url) { await chrome.bookmarks.create({ title: t.title || t.url, url: t.url }); } window.close(); } },
  ];

  return (
    <div data-theme={theme} style={{ background: "var(--panel)", color: "var(--text)", minHeight: 200 }}>
      <Palette live={live} actions={actions} onOpenBookmark={open} maxHeight={500} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Popup />);
