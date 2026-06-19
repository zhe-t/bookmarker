import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadEnriched } from "../lib/bookmarks.js";
import { Palette } from "../newtab/Palette.jsx";
import "../styles.css";
import "../enhancements.css";

const resolveTheme = (t) =>
  t === "auto" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;

function Popup() {
  const [live, setLive] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [theme, setTheme] = useState(() => resolveTheme(localStorage.getItem("bops-theme") || "dark"));

  const refresh = () =>
    loadEnriched().then(({ all, suggestions, meta }) => {
      const list = all.filter((b) => !b.trashed && !b.archived);
      const order = new Map((meta.pinned || []).map((id, i) => [String(id), i]));
      setLive(list);
      setPinned(list.filter((b) => b.pinned).sort((a, b) => (order.get(String(a.id)) ?? 1e9) - (order.get(String(b.id)) ?? 1e9)));
      setSuggestions(suggestions || []);
    });

  useEffect(() => { refresh(); }, []);

  const toggleTheme = () =>
    setTheme((t) => { const next = t === "dark" ? "light" : "dark"; localStorage.setItem("bops-theme", next); return next; });

  const openDash = () => chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") }, () => window.close());
  const open = (b) => chrome.tabs.create({ url: b.url }, () => window.close());

  // Add a suggested page as a bookmark, then drop it from the list (no reload,
  // so the popup stays open and responsive).
  const addSuggestion = async (s) => {
    try { await chrome.bookmarks.create({ title: s.title || s.domain, url: s.url }); } catch { /* ignore */ }
    setSuggestions((cur) => cur.filter((x) => x.url !== s.url));
  };

  const actions = [
    { label: "Open dashboard", hint: "⌘⇧B", run: openDash },
    {
      label: "New bookmark from current tab",
      run: async () => {
        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (t?.url) await chrome.bookmarks.create({ title: t.title || t.url, url: t.url });
        window.close();
      },
    },
  ];

  return (
    <div data-theme={theme} style={{ background: "var(--panel)", color: "var(--text)", minHeight: 200 }}>
      <Palette
        live={live}
        actions={actions}
        pinned={pinned}
        suggestions={suggestions}
        onOpenBookmark={open}
        onAddSuggestion={addSuggestion}
        theme={theme}
        onToggleTheme={toggleTheme}
        maxHeight={500}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Popup />);
