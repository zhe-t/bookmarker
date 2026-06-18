import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { loadEnriched, moveTo, removeForever, exportHtml, exportJson, importHtml, importJson, updateBookmark, createBookmark, createFolder, renameFolder, deleteFolder } from "../lib/bookmarks.js";
import { patchMeta, getSyncEnabled, setSyncEnabled, pushToSync } from "../lib/store.js";
import { ago, greeting, urlKey, parseQuery, rank, computeIssues, healthScore, isStale, byAdded, byAlpha, byDomain } from "../lib/model.js";
import { Palette } from "./Palette.jsx";
import { BookmarkModal } from "./BookmarkModal.jsx";
import { ContextMenu } from "./ContextMenu.jsx";
import { FolderRail } from "./FolderRail.jsx";
import { HelpModal } from "./HelpModal.jsx";
import { GuideModal } from "./GuideModal.jsx";
import { FeedbackModal } from "./FeedbackModal.jsx";
import { SettingsModal } from "./SettingsModal.jsx";
import { StatsModal } from "./StatsModal.jsx";
import { TourModal } from "./TourModal.jsx";
import { FolderStyleModal } from "./FolderStyleModal.jsx";
import { Favicon } from "../ui/Favicon.jsx";
import { useClickAway, useScrollHint } from "../ui/hooks.js";
import * as Ic from "../ui/icons.jsx";

const SCOPES = [["all", "All"], ["recent", "Recent"], ["top", "Top"], ["added", "New"], ["later", "Read later"], ["untagged", "Untagged"]];
const DEFAULT_SCOPE = "top";
const ACCENTS = [
  { name: "lime", accent: "#c8f24f", ink: "#11140a" },
  { name: "blue", accent: "#6db1ff", ink: "#08131f" },
  { name: "violet", accent: "#b888ff", ink: "#160a24" },
  { name: "amber", accent: "#ffc24b", ink: "#1f1604" },
  { name: "rose", accent: "#ff9ecb", ink: "#250612" },
  { name: "teal", accent: "#43d9c4", ink: "#04201c" },
];
const hexToRgba = (hex, a) => { const n = hex.replace("#", ""); return `rgba(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)}, ${a})`; };
const WAYBACK = (url) => `https://web.archive.org/web/*/${url}`;
// Chrome's fixed containers are not user categories; they live in the
// folder dropdown but never as rail chips.
const CONTAINER_RE = /^(bookmarks bar|other bookmarks|mobile bookmarks)$/i;

// Render text with fuzzy-match hits marked. `hits` indices are relative to a
// combined "title domain tags" string, so domain passes offset = title.len+1.
function Hl({ text, hits, offset = 0 }) {
  if (!hits || !hits.size) return text;
  return text.split("").map((c, j) => (hits.has(offset + j) ? <mark key={j}>{c}</mark> : c));
}

export default function App() {
  const [all, setAll] = useState([]);
  const [meta, setMeta] = useState({ tags: {}, trashed: [], archived: [], dead: [], filters: [], readLater: [], notes: {}, folderStyles: {} });
  const [suggestions, setSuggestions] = useState([]);
  const [folderTree, setFolderTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("search");
  const [theme, setTheme] = useState(() => localStorage.getItem("bops-theme") || "dark");
  const [accent, setAccent] = useState(() => localStorage.getItem("bops-accent") || "lime");
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
  const [cmd, setCmd] = useState(false);
  const [q, setQ] = useState(""); const [scope, setScope] = useState(() => localStorage.getItem("bops-scope") || DEFAULT_SCOPE);
  const [folder, setFolder] = useState(null); const [folderNav, setFolderNav] = useState(""); const [tag, setTag] = useState(null);
  const [sort, setSort] = useState(() => localStorage.getItem("bops-sort") || "folder");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dragId, setDragId] = useState(null);
  const [draggingBm, setDraggingBm] = useState(false);
  const [justAdded, setJustAdded] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [tab, setTab] = useState("dead");
  const [tagInput, setTagInput] = useState("");
  const [moveOpen, setMoveOpen] = useState(false); const [newFolder, setNewFolder] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [bmModal, setBmModal] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guide, setGuide] = useState(null); // "import" | "export" walkthrough
  const [showSugg, setShowSugg] = useState(() => localStorage.getItem("bops-show-sugg") !== "0");
  const [showPinned, setShowPinned] = useState(() => localStorage.getItem("bops-show-pinned") !== "0");
  const [showLater, setShowLater] = useState(() => localStorage.getItem("bops-show-later") !== "0");
  const [density, setDensity] = useState(() => localStorage.getItem("bops-density") || "comfortable");
  const [folderMode, setFolderMode] = useState(() => localStorage.getItem("bops-folder-mode") || "drill");
  const [pinLayout, setPinLayout] = useState(() => localStorage.getItem("bops-pin-layout") || "scroll");
  const [showUrls, setShowUrls] = useState(() => localStorage.getItem("bops-show-urls") !== "0");
  const [syncOn, setSyncOn] = useState(() => getSyncEnabled());
  const [statsOpen, setStatsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [folderStyleTarget, setFolderStyleTarget] = useState(null);
  const [scan, setScan] = useState({ active: false });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);
  const menuRef = useRef(null);
  const moveRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const toastTimer = useRef(null);
  const selAnchor = useRef(null);

  const flash = useCallback((m, action = null) => {
    setToast({ msg: m, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 2600);
  }, []);
  const refresh = useCallback(async () => {
    const { all, meta, suggestions, folderTree } = await loadEnriched();
    setAll(all); setMeta(meta); setSuggestions(suggestions); setFolderTree(folderTree || []); setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { localStorage.setItem("bops-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("bops-accent", accent); }, [accent]);
  useEffect(() => { localStorage.setItem("bops-show-sugg", showSugg ? "1" : "0"); }, [showSugg]);
  useEffect(() => { localStorage.setItem("bops-show-pinned", showPinned ? "1" : "0"); }, [showPinned]);
  useEffect(() => { localStorage.setItem("bops-show-later", showLater ? "1" : "0"); }, [showLater]);
  useEffect(() => { localStorage.setItem("bops-scope", scope); }, [scope]);
  useEffect(() => { localStorage.setItem("bops-sort", sort); }, [sort]);
  useEffect(() => { localStorage.setItem("bops-density", density); }, [density]);
  useEffect(() => { localStorage.setItem("bops-folder-mode", folderMode); }, [folderMode]);
  useEffect(() => { localStorage.setItem("bops-pin-layout", pinLayout); }, [pinLayout]);
  useEffect(() => { localStorage.setItem("bops-show-urls", showUrls ? "1" : "0"); }, [showUrls]);

  // resolve "auto" theme against the OS preference
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const h = (e) => setSystemDark(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  const resolvedTheme = theme === "auto" ? (systemDark ? "dark" : "light") : theme;
  const accentVars = useMemo(() => {
    const a = ACCENTS.find((x) => x.name === accent);
    if (!a || a.name === "lime") return undefined; // lime is the CSS default per theme
    return { "--accent": a.accent, "--accent-ink": a.ink, "--accent-soft": hexToRgba(a.accent, 0.12), "--accent-line": hexToRgba(a.accent, 0.4) };
  }, [accent]);

  // first-run tour
  useEffect(() => { if (!loading && !localStorage.getItem("bops-toured")) { setTourOpen(true); localStorage.setItem("bops-toured", "1"); } }, [loading]);

  // auto-refresh on any bookmark or metadata change
  useEffect(() => {
    const r = () => refresh();
    const evs = ["onCreated", "onRemoved", "onChanged", "onMoved"];
    evs.forEach((e) => chrome.bookmarks[e]?.addListener(r));
    chrome.storage.onChanged.addListener(r);
    return () => { evs.forEach((e) => chrome.bookmarks[e]?.removeListener(r)); chrome.storage.onChanged.removeListener(r); };
  }, [refresh]);

  // keyboard: ⌘K palette, ⌘1/2 modes, ? help, layered Escape
  useEffect(() => {
    const h = (e) => {
      const m = e.metaKey || e.ctrlKey;
      if (m && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); }
      else if (m && e.key === "1") { e.preventDefault(); setMode("search"); }
      else if (m && e.key === "2") { e.preventDefault(); setMode("cleanup"); }
      else if (e.key === "?" && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { setHelpOpen(true); }
      else if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && mode === "search") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "Escape") {
        // close only the topmost layer
        if (cmd) setCmd(false);
        else if (ctx) setCtx(null);
        else if (bmModal) setBmModal(null);
        else if (guide) setGuide(null);
        else if (helpOpen) setHelpOpen(false);
        else if (feedbackOpen) setFeedbackOpen(false);
        else if (folderStyleTarget) setFolderStyleTarget(null);
        else if (statsOpen) setStatsOpen(false);
        else if (tourOpen) setTourOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (confirm) setConfirm(null);
        else if (moveOpen) setMoveOpen(false);
        else if (folderOpen) setFolderOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else if (sel.size) { setSel(new Set()); selAnchor.current = null; }
        else if (mode === "cleanup") setMode("search");
      }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [cmd, ctx, bmModal, guide, helpOpen, feedbackOpen, settingsOpen, statsOpen, tourOpen, folderStyleTarget, confirm, moveOpen, folderOpen, menuOpen, sel, mode]);

  useClickAway(menuRef, () => setMenuOpen(false), menuOpen);
  useClickAway(moveRef, () => setMoveOpen(false), moveOpen);

  const live = useMemo(() => all.filter((b) => !b.trashed && !b.archived), [all]);
  // pinned bookmarks, kept in the order they were pinned
  const pinned = useMemo(() => {
    const order = new Map((meta.pinned || []).map((id, i) => [String(id), i]));
    return live.filter((b) => b.pinned).sort((a, b) => (order.get(String(a.id)) ?? 1e9) - (order.get(String(b.id)) ?? 1e9));
  }, [live, meta.pinned]);
  const issues = useMemo(() => computeIssues(live), [live]);
  const score = useMemo(() => healthScore(live, issues), [live, issues]);
  const scoreColor = score >= 80 ? "var(--green)" : score >= 55 ? "var(--amber)" : "var(--red)";
  const folders = useMemo(() => [...new Set(live.map((b) => b.folder.split("/")[0]))].sort(), [live]);
  // top 4 real categories by bookmark count, shown as rail chips
  const folderChips = useMemo(() => {
    const counts = {};
    live.forEach((b) => { const f = b.folder.split("/")[0]; if (!CONTAINER_RE.test(f)) counts[f] = (counts[f] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]);
    if (folder && !top.includes(folder) && !CONTAINER_RE.test(folder)) top.unshift(folder);
    return top;
  }, [live, folder]);
  const issueCount = issues.dead.length + issues.dupes.length;
  const allFolders = useMemo(() => [...new Set(live.map((b) => b.folder))].sort(), [live]);
  const existingUrls = useMemo(() => new Set(all.map((b) => b.url)), [all]);
  const topTags = useMemo(() => { const c = {}; live.forEach((b) => b.tags.forEach((t) => (c[t] = (c[t] || 0) + 1))); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]); }, [live]);
  const allTags = useMemo(() => [...new Set(live.flatMap((b) => b.tags))].sort(), [live]);
  const dupGroups = useMemo(() => { const m = {}; live.forEach((b) => (m[b.url] = m[b.url] || []).push(b)); return Object.values(m).filter((g) => g.length > 1); }, [live]);

  const parsed = useMemo(() => parseQuery(q), [q]);
  const results = useMemo(() => {
    const { ops, text } = parsed; let pool = live;
    // pinned live in their own section while browsing (no query); hide them
    // from the main list so they aren't shown twice. During search they stay.
    if (!q && showPinned) pool = pool.filter((b) => !b.pinned);
    if (scope === "issues") pool = pool.filter((b) => b.dead || b.dupeOf != null);
    else if (scope === "later") pool = pool.filter((b) => b.readLater);
    const is = ops.is || (["untagged", "dead", "dupes", "stale"].includes(scope) ? scope.replace("dupes", "dupe") : null);
    if (is === "untagged") pool = pool.filter((b) => b.tags.length === 0);
    else if (is === "dead") pool = pool.filter((b) => b.dead);
    else if (is === "dupe") pool = pool.filter((b) => b.dupeOf != null);
    else if (is === "stale") pool = pool.filter(isStale);
    if (ops.site) pool = pool.filter((b) => b.domain.includes(ops.site));
    if (ops.folder) pool = pool.filter((b) => b.folder.toLowerCase().includes(ops.folder));
    if (ops.minVisits) pool = pool.filter((b) => b.visitCount >= ops.minVisits);
    const tg = ops.tag || tag; if (tg) pool = pool.filter((b) => b.tags.includes(tg));
    // path-prefix folder match enables drill-down into subfolders
    if (folder) pool = pool.filter((b) => b.folder === folder || b.folder.startsWith(folder + "/"));
    let scored = rank(pool, text);
    if (scope === "recent") scored = [...scored].sort((a, b) => (b.b.lastVisited || 0) - (a.b.lastVisited || 0));
    else if (scope === "top") scored = [...scored].sort((a, b) => b.b.visitCount - a.b.visitCount);
    else if (scope === "added") scored = [...scored].sort(byAdded);
    let out = scored.slice(0, 100);
    // secondary sort applied to the best 100 (stable: keeps rank order within groups)
    if (sort === "folder") out = [...out].sort((a, b) => a.b.folder.localeCompare(b.b.folder));
    else if (sort === "added") out = [...out].sort(byAdded);
    else if (sort === "alpha") out = [...out].sort(byAlpha);
    else if (sort === "domain") out = [...out].sort(byDomain);
    return out;
  }, [live, parsed, q, scope, folder, tag, sort, showPinned]);
  const readLaterItems = useMemo(() => {
    const order = new Map((meta.readLater || []).map((id, i) => [String(id), i]));
    return live.filter((b) => b.readLater).sort((a, b) => (order.get(String(a.id)) ?? 1e9) - (order.get(String(b.id)) ?? 1e9));
  }, [live, meta.readLater]);
  const resultIds = useMemo(() => results.map((r) => r.b.id), [results]);
  const canScroll = useScrollHint(listRef, [results.length, loading, sort, mode]);

  // keep the keyboard cursor in range as results change; scroll it into view
  useEffect(() => { setActiveIdx((i) => (i >= results.length ? results.length - 1 : i)); }, [results.length]);
  useEffect(() => {
    if (activeIdx < 0) return;
    listRef.current?.querySelector(".row--active")?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);
  // briefly highlight a freshly added bookmark once it appears in the list
  useEffect(() => {
    if (justAdded == null) return;
    if (!resultIds.map(String).includes(String(justAdded))) return;
    const el = listRef.current?.querySelector(".row--new");
    el?.scrollIntoView({ block: "nearest" });
    const t = setTimeout(() => setJustAdded(null), 1600);
    return () => clearTimeout(t);
  }, [resultIds, justAdded]);

  /* ── actions (persist → listeners refresh UI) ── */
  const open = (b, opts = {}) => { chrome.tabs.create({ url: b.url, active: !opts.background }); if (!opts.background) flash("Opened " + b.domain); };
  const addTag = (ids, t) => { if (!t) return; patchMeta((m) => { ids.forEach((id) => { m.tags[id] = [...new Set([...(m.tags[id] || []), t])]; }); }); flash(`Tagged ${ids.length} #${t}`); };
  const trashIds = (ids) => patchMeta((m) => { m.trashed = [...new Set([...m.trashed, ...ids.map(String)])]; });
  const trash = (ids) => { trashIds(ids); setSel(new Set()); flash(`Moved ${ids.length} to Trash`, { label: "Undo", run: () => restore(ids) }); };
  const askTrash = (ids) => { if (ids.length > 20) setConfirm({ msg: `Delete ${ids.length} bookmarks? They go to Trash and can be restored.`, run: () => { trash(ids); setConfirm(null); } }); else trash(ids); };
  const restore = (ids) => { patchMeta((m) => { m.trashed = m.trashed.filter((x) => !ids.map(String).includes(x)); }); flash(`Restored ${ids.length}`); };
  const emptyTrash = async () => { const ids = [...meta.trashed]; await removeForever(ids); await patchMeta((m) => { m.trashed = []; ids.forEach((id) => delete m.tags[id]); }); flash(`Emptied Trash (${ids.length})`); };
  const togglePin = (ids) => {
    const sids = ids.map(String);
    const allPinned = sids.every((id) => (meta.pinned || []).map(String).includes(id));
    patchMeta((m) => {
      const cur = (m.pinned || []).map(String);
      m.pinned = allPinned ? cur.filter((x) => !sids.includes(x)) : [...cur, ...sids.filter((id) => !cur.includes(id))];
    });
    flash(allPinned ? `Unpinned ${ids.length}` : `Pinned ${ids.length}`, { label: "Undo", run: () => togglePin(ids) });
  };
  const toggleReadLater = (ids) => {
    const sids = ids.map(String);
    const allLater = sids.every((id) => (meta.readLater || []).map(String).includes(id));
    patchMeta((m) => {
      const cur = (m.readLater || []).map(String);
      m.readLater = allLater ? cur.filter((x) => !sids.includes(x)) : [...cur, ...sids.filter((id) => !cur.includes(id))];
    });
    flash(allLater ? `Removed ${ids.length} from read later` : `Saved ${ids.length} for later`, { label: "Undo", run: () => toggleReadLater(ids) });
  };
  const archive = (ids) => { patchMeta((m) => { m.archived = [...new Set([...m.archived, ...ids.map(String)])]; }); setSel(new Set()); flash(`Archived ${ids.length}`, { label: "Undo", run: () => unarchive(ids) }); };
  const unarchive = (ids) => { patchMeta((m) => { m.archived = m.archived.filter((x) => !ids.map(String).includes(x)); }); flash(`Unarchived ${ids.length}`); };
  const move = async (ids, f) => {
    setMoveOpen(false);
    const prev = ids.map((id) => ({ id, folder: all.find((x) => String(x.id) === String(id))?.folder })).filter((p) => p.folder);
    await moveTo(ids, f); setSel(new Set());
    flash(`Moved ${ids.length} → ${f}`, { label: "Undo", run: () => { prev.forEach(({ id, folder }) => moveTo([id], folder)); } });
  };
  const openMany = (ids) => { ids.forEach((id) => { const b = all.find((x) => String(x.id) === String(id)); if (b) chrome.tabs.create({ url: b.url, active: false }); }); flash(`Opened ${ids.length} tabs`); };
  const copyUrls = (ids) => { const urls = ids.map((id) => all.find((x) => String(x.id) === String(id))?.url).filter(Boolean); navigator.clipboard.writeText(urls.join("\n")).then(() => flash(`Copied ${urls.length} URLs`)).catch(() => flash("Copy failed")); };
  const exportSelected = (ids) => { const items = all.filter((b) => ids.map(String).includes(String(b.id))); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportHtml(items)], { type: "text/html" })); a.download = "bookmarks-selection.html"; a.click(); flash(`Exported ${items.length}`); };
  const autoMerge = () => {
    const kill = []; const removed = [];
    dupGroups.forEach((g) => { const s = [...g].sort((a, b) => b.visitCount - a.visitCount || b.dateAdded - a.dateAdded); s.slice(1).forEach((b) => { kill.push(b.id); removed.push(b); }); });
    if (!kill.length) return flash("No duplicates");
    setConfirm({
      title: "Auto-merge duplicates",
      msg: `Keep the most-visited copy in each of ${dupGroups.length} group${dupGroups.length > 1 ? "s" : ""} and move ${kill.length} duplicate${kill.length > 1 ? "s" : ""} to Trash.`,
      body: (
        <div className="confirm-preview scroll">
          {removed.map((b) => (
            <div key={b.id} className="confirm-preview-row"><Favicon b={b} size={18} /><span className="cp-title">{b.title}</span><span className="cp-dom">{b.domain}</span></div>
          ))}
        </div>
      ),
      okLabel: `Merge · −${kill.length}`,
      run: () => { trashIds(kill); setConfirm(null); flash(`Merged ${dupGroups.length} groups · −${kill.length}`, { label: "Undo", run: () => restore(kill) }); },
    });
  };
  const reorderPinned = (fromId, toId) => {
    if (fromId == null || String(fromId) === String(toId)) return;
    const ids = pinned.map((b) => String(b.id));
    const from = ids.indexOf(String(fromId)), to = ids.indexOf(String(toId));
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    patchMeta((m) => { const cur = (m.pinned || []).map(String); m.pinned = [...ids, ...cur.filter((id) => !ids.includes(id))]; });
  };
  const clearFilters = () => { setQ(""); setFolder(null); setTag(null); setScope(DEFAULT_SCOPE); };
  const startBmDrag = (e, b) => { e.dataTransfer.setData("text/bops-bm", String(b.id)); e.dataTransfer.effectAllowed = "move"; setDraggingBm(true); };
  const dropToFolder = (e, folderName) => {
    e.preventDefault(); setDraggingBm(false);
    const id = e.dataTransfer.getData("text/bops-bm");
    if (!id) return;
    const ids = sel.has(id) && sel.size ? [...sel] : [id];
    move(ids, folderName);
  };
  const openAll = () => {
    const bs = results.map((r) => r.b);
    if (!bs.length) return;
    const run = () => { bs.forEach((b) => chrome.tabs.create({ url: b.url, active: false })); flash(`Opened ${bs.length} tabs`); setConfirm(null); };
    if (bs.length > 10) setConfirm({ title: "Open all results", msg: `Open ${bs.length} tabs at once?`, okLabel: `Open ${bs.length}`, run });
    else run();
  };
  const snapshotTags = (pred) => { const snap = {}; Object.keys(meta.tags || {}).forEach((id) => { if (pred(meta.tags[id])) snap[id] = [...meta.tags[id]]; }); return snap; };
  const restoreTags = (snap) => patchMeta((m) => { Object.entries(snap).forEach(([id, v]) => { m.tags[id] = v; }); });
  const renameTag = (from, to) => {
    to = (to || "").trim().toLowerCase();
    if (!to || to === from) return;
    const snap = snapshotTags((arr) => arr?.includes(from));
    patchMeta((m) => { Object.keys(m.tags).forEach((id) => { if (m.tags[id]?.includes(from)) m.tags[id] = [...new Set(m.tags[id].map((t) => (t === from ? to : t)))]; }); });
    if (tag === from) setTag(to);
    flash(`Renamed #${from} → #${to}`, { label: "Undo", run: () => restoreTags(snap) });
  };
  const deleteTag = (t) => {
    const snap = snapshotTags((arr) => arr?.includes(t));
    patchMeta((m) => { Object.keys(m.tags).forEach((id) => { if (m.tags[id]?.includes(t)) m.tags[id] = m.tags[id].filter((x) => x !== t); }); });
    if (tag === t) setTag(null);
    flash(`Removed #${t}`, { label: "Undo", run: () => restoreTags(snap) });
  };
  const saveFolderStyle = (path, style) => { patchMeta((m) => { m.folderStyles = m.folderStyles || {}; if (!style.color && !style.emoji) delete m.folderStyles[path]; else m.folderStyles[path] = style; }); flash("Folder updated"); };
  const doExportJson = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportJson(live)], { type: "application/json" })); a.download = "bookmark-ops-backup.json"; a.click(); flash(`Backed up ${live.length}`); };
  const doImportJson = (file) => { const fr = new FileReader(); fr.onload = async () => { try { const n = await importJson(String(fr.result), new Map(all.map((b) => [b.url, b.id]))); flash(n ? `Restored · ${n} new` : "Backup merged"); } catch { flash("Invalid backup file"); } }; fr.readAsText(file); };
  const toggleSync = async (on) => { setSyncEnabled(on); setSyncOn(on); if (on) { const { oversize } = await pushToSync(); flash(oversize ? "Library too big to sync — local only" : "Sync enabled"); } else flash("Sync disabled"); };
  const openTagCtx = (e, t) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, tagName: t }); };
  const tagCtxItems = (t) => [
    { icon: <Ic.Tag size={13} />, label: tag === t ? "Clear filter" : "Filter by tag", run: () => setTag(tag === t ? null : t) },
    { icon: <Ic.Pencil size={13} />, label: "Rename / merge", run: () => { const to = window.prompt(`Rename #${t} (type an existing tag to merge into it)`, t); if (to) renameTag(t, to); } },
    "sep",
    { icon: <Ic.Trash size={13} />, label: "Delete tag", danger: true, run: () => deleteTag(t) },
  ];
  const openSectionCtx = (e, kind) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, section: kind }); };
  const sectionCtxItems = (kind) => {
    const setter = kind === "sugg" ? setShowSugg : kind === "pinned" ? setShowPinned : setShowLater;
    const label = kind === "sugg" ? "suggested" : kind === "pinned" ? "pinned" : "read later";
    const spacer = <span style={{ width: 13, display: "inline-block" }} />;
    return [
      ...(kind === "pinned" ? [
        { header: "Layout" },
        ...[["scroll", "Scroll"], ["grid", "Grid"], ["compact", "Compact"]].map(([k, l]) => ({
          icon: pinLayout === k ? <Ic.Check size={13} /> : spacer, label: l, run: () => setPinLayout(k),
        })),
        "sep",
      ] : []),
      { icon: <Ic.X size={13} />, label: `Hide ${label}`, run: () => { setter(false); flash(`Hid ${label} · re-enable in Settings`); } },
      { icon: <Ic.Sliders size={13} />, label: "Settings", run: () => setSettingsOpen(true) },
    ];
  };
  const rescan = () => { if (scan.active) return; setScan({ active: true }); chrome.runtime.sendMessage({ type: "scan", urls: live.map((b) => b.url) }, (res) => { setScan({ active: false }); flash(`Scan done · ${res?.dead?.length || 0} unreachable`); }); };
  const doExport = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportHtml(live)], { type: "text/html" })); a.download = "bookmarks-export.html"; a.click(); flash(`Exported ${live.length}`); };
  const doImport = (e) => { const f = e.target.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = async () => { const n = await importHtml(String(fr.result), new Set(all.map((b) => b.url))); flash(n ? `Imported ${n} new` : "No new bookmarks"); }; fr.readAsText(f); e.target.value = ""; };
  const saveFilter = () => { patchMeta((m) => { m.filters = [...(m.filters || []), { name: (folder ? folder + " " : "") + (SCOPES.find((s) => s[0] === scope)?.[1] || "All") + (tag ? " #" + tag : ""), scope, folder, tag, q }]; }); flash("Filter saved"); };
  const applyFilter = (f) => { setScope(f.scope || "all"); setFolder(f.folder || null); setTag(f.tag || null); setQ(f.q || ""); setMode("search"); setCmd(false); };
  const deleteFilter = (i) => { patchMeta((m) => { m.filters = (m.filters || []).filter((_, idx) => idx !== i); }); flash("Filter removed"); };
  const openFilterCtx = (e, f, i) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, filter: { f, i } }); };
  const filterCtxItems = ({ f, i }) => [
    { icon: <Ic.Arrow size={13} />, label: "Apply filter", run: () => applyFilter(f) },
    "sep",
    { icon: <Ic.Trash size={13} />, label: "Delete", danger: true, run: () => deleteFilter(i) },
  ];
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // checkbox click with shift-range support; anchor resolved against the
  // current order at click time so re-ranking can't select the wrong rows
  const clickSel = useCallback((e, id, listKey, orderedIds) => {
    if (e.shiftKey && selAnchor.current?.listKey === listKey) {
      const ai = orderedIds.indexOf(selAnchor.current.id);
      const bi = orderedIds.indexOf(id);
      if (ai !== -1 && bi !== -1) {
        const range = orderedIds.slice(Math.min(ai, bi), Math.max(ai, bi) + 1);
        setSel((s) => new Set([...s, ...range]));
        selAnchor.current = { listKey, id };
        return;
      }
    }
    toggleSel(id);
    selAnchor.current = { listKey, id };
  }, []);

  const addSuggestion = async (s, folderName = null) => {
    try { const node = await createBookmark({ title: s.title, url: s.url, folderName }); if (node?.id) setJustAdded(node.id); flash(`Added ${s.domain}${folderName ? " → " + folderName : ""}`); }
    catch { flash("Couldn't add bookmark"); }
  };
  const markSimilarOk = (s) => {
    patchMeta((m) => { m.similarOk = [...new Set([...(m.similarOk || []), urlKey(s.url)])]; });
    flash("Marked as ok");
  };
  const hideSuggestion = (s) => {
    patchMeta((m) => { m.suggestHidden = [...new Set([...(m.suggestHidden || []), s.domain])]; });
    flash(`Won't suggest ${s.domain}`);
  };
  const saveNew = async ({ title, url, folderName, tags, note }) => {
    const node = await createBookmark({ title, url, folderName });
    if (tags.length || note) await patchMeta((m) => { if (tags.length) m.tags[node.id] = tags; if (note) m.notes[node.id] = note; });
    if (node?.id) setJustAdded(node.id);
    flash(`Added ${title}`);
  };
  const saveEdit = async (b, { title, url, folderName, note }) => {
    await updateBookmark(b.id, { title, url });
    const orig = b.folder === "Bookmarks bar" ? null : b.folder;
    if (folderName !== orig) await moveTo([b.id], folderName || "Bookmarks bar");
    await patchMeta((m) => { if (note) m.notes[b.id] = note; else delete m.notes[b.id]; });
    flash("Saved");
  };

  const openCtx = useCallback((e, b) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, b }); }, []);
  const openSuggCtx = (e, s) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, sugg: s }); };
  const suggItems = (s) => [
    { icon: <Ic.Plus size={13} />, label: "Add bookmark", run: () => addSuggestion(s) },
    { icon: <Ic.External size={13} />, label: "Open in new tab", run: () => open(s) },
    ...(s.similarTo ? [{ icon: <Ic.Check size={13} />, label: "Mark as ok (not a duplicate)", run: () => markSimilarOk(s) }] : []),
    ...(allFolders.length ? [
      "sep",
      { header: "Add to folder" },
      ...allFolders.map((f) => ({ icon: <Ic.Folder size={13} />, label: f, run: () => addSuggestion(s, f) })),
    ] : []),
    "sep",
    { icon: <Ic.X size={13} />, label: `Don't suggest ${s.domain}`, danger: true, run: () => hideSuggestion(s) },
  ];
  const ctxItems = (b) => [
    { icon: <Ic.External size={13} />, label: "Open in new tab", run: () => open(b) },
    { icon: b.pinned ? <Ic.PinFilled size={13} /> : <Ic.Pin size={13} />, label: b.pinned ? "Unpin" : "Pin to top", run: () => togglePin([b.id]) },
    { icon: <Ic.Clock size={13} />, label: b.readLater ? "Remove from read later" : "Read later", run: () => toggleReadLater([b.id]) },
    { icon: <Ic.Pencil size={13} />, label: "Edit & note", run: () => setBmModal({ mode: "edit", b, focus: "title" }) },
    { icon: <Ic.Link size={13} />, label: "Edit URL", run: () => setBmModal({ mode: "edit", b, focus: "url" }) },
    { icon: <Ic.Copy size={13} />, label: "Share", run: () => navigator.clipboard.writeText(b.url).then(() => flash("Link copied")).catch(() => flash("Copy failed")) },
    { icon: <Ic.Search size={13} />, label: `More from ${b.domain}`, run: () => { setQ(`site:${b.domain}`); setMode("search"); } },
    ...(b.dead ? [
      "sep",
      { icon: <Ic.Restore size={13} />, label: "Open in Wayback Machine", run: () => chrome.tabs.create({ url: WAYBACK(b.url) }) },
      { icon: <Ic.Search size={13} />, label: "Search the title", run: () => chrome.tabs.create({ url: `https://duckduckgo.com/?q=${encodeURIComponent(b.title)}` }) },
    ] : []),
    ...(allFolders.filter((f) => f !== b.folder).length ? [
      "sep",
      { header: "Move to folder" },
      ...allFolders.filter((f) => f !== b.folder).map((f) => ({ icon: <Ic.Folder size={13} />, label: f, run: () => move([b.id], f) })),
    ] : []),
    "sep",
    { icon: <Ic.Trash size={13} />, label: "Delete", danger: true, run: () => askTrash([b.id]) },
  ];

  /* ── folders ── */
  const createNewFolder = async (name) => {
    try { await createFolder(name); flash(`Created ${name}`); } catch { flash("Couldn't create folder"); }
  };
  const createNewFolderPrompt = () => { const name = window.prompt("New folder name"); if (name && name.trim()) createNewFolder(name.trim()); };
  const doRenameFolder = async (f) => {
    if (!f.id) return flash("Can't rename this folder");
    const name = window.prompt("Rename folder", f.name);
    if (!name || !name.trim() || name.trim() === f.name) return;
    try { await renameFolder(f.id, name.trim()); if (folder === f.name) setFolder(name.trim()); flash("Folder renamed"); }
    catch { flash("Couldn't rename folder"); }
  };
  const doDeleteFolder = (f) => {
    if (!f.id) return flash("Can't delete this folder");
    const run = async () => {
      try { await deleteFolder(f.id); if (folder === f.name) setFolder(null); flash(`Deleted ${f.name}`); }
      catch { flash("Couldn't delete folder"); }
      setConfirm(null);
    };
    if (f.count > 0) setConfirm({ msg: `Delete folder "${f.name}" and its ${f.count} bookmark${f.count > 1 ? "s" : ""}? This can't be undone.`, run });
    else run();
  };
  const openFolderCtx = (e, f) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, folder: f }); };
  const folderCtxItems = (f) => [
    { icon: <Ic.Arrow size={13} />, label: "Filter to this folder", key: "F", run: () => { setFolder(f.path || f.name); setFolderNav(f.path || f.name); setMode("search"); } },
    { icon: <Ic.Swatch size={13} />, label: "Customize…", key: "C", run: () => setFolderStyleTarget({ path: f.path || f.name, name: f.name }) },
    { icon: <Ic.Pencil size={13} />, label: "Rename", key: "R", run: () => doRenameFolder(f) },
    { icon: <Ic.Plus size={13} />, label: "New folder", key: "N", run: () => createNewFolderPrompt() },
    "sep",
    { icon: <Ic.Trash size={13} />, label: "Delete", key: "D", danger: true, run: () => doDeleteFolder(f) },
  ];

  const paletteActions = useMemo(() => [
    { label: "Go to Search", hint: "⌘1", run: () => { setMode("search"); setCmd(false); } },
    { label: "Go to Cleanup", hint: "⌘2", run: () => { setMode("cleanup"); setCmd(false); } },
    { label: "Add bookmark", run: () => { setBmModal({ mode: "add" }); setCmd(false); } },
    { label: "Settings", run: () => { setSettingsOpen(true); setCmd(false); } },
    { label: "Stats", run: () => { setStatsOpen(true); setCmd(false); } },
    ...(results.length ? [{ label: `Open all ${results.length} results in tabs`, run: () => { openAll(); setCmd(false); } }] : []),
    { label: `Auto-merge ${dupGroups.length} duplicate groups`, run: () => { autoMerge(); setCmd(false); } },
    { label: `Delete ${issues.dead.length} dead links`, run: () => { askTrash(issues.dead.map((b) => b.id)); setCmd(false); } },
    { label: "Re-scan links", run: () => { rescan(); setCmd(false); } },
    { label: "Import bookmarks (.html)", run: () => { setGuide("import"); setCmd(false); } },
    { label: "Export bookmarks (.html)", run: () => { setGuide("export"); setCmd(false); } },
    { label: "Keyboard shortcuts and operators", hint: "?", run: () => { setHelpOpen(true); setCmd(false); } },
    { label: "Send feedback", run: () => { setFeedbackOpen(true); setCmd(false); } },
    ...(meta.filters || []).map((f) => ({ label: "Filter · " + f.name, run: () => applyFilter(f) })),
  ], [dupGroups, issues, meta.filters, live, results.length]);

  const selArr = [...sel];
  const selInResults = useMemo(() => resultIds.filter((id) => sel.has(id)), [resultIds, sel]);
  const allResultsSel = resultIds.length > 0 && selInResults.length === resultIds.length;
  const toggleAllResults = () => setSel((s) => { const n = new Set(s); if (allResultsSel) resultIds.forEach((id) => n.delete(id)); else resultIds.forEach((id) => n.add(id)); return n; });

  // Single-key actions while the results list (not the input) holds focus.
  const listKeyDown = (e) => {
    if (!results.length) return;
    const k = e.key;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (k === "ArrowDown" || k === "j") { stop(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (k === "ArrowUp" || k === "k") { stop(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (/^[1-9]$/.test(k)) { const r = results[+k - 1]; if (r) { stop(); open(r.b); } }
    else if (k === "Enter" && activeIdx >= 0) { const r = results[activeIdx]; if (r) { stop(); open(r.b, { background: e.metaKey || e.ctrlKey }); } }
    else if (k === "Escape") { stop(); setActiveIdx(-1); searchRef.current?.focus(); }
    else if (activeIdx >= 0 && results[activeIdx]) {
      const b = results[activeIdx].b;
      if (k === "p") { stop(); togglePin([b.id]); }
      else if (k === "e") { stop(); setBmModal({ mode: "edit", b, focus: "title" }); }
      else if (k === "x") { stop(); toggleSel(b.id); }
      else if (k === "l") { stop(); toggleReadLater([b.id]); }
      else if (k === "d" || k === "Backspace") { stop(); trash([b.id]); }
      else if (k.length === 1) { searchRef.current?.focus(); } // start typing → back to search
    }
  };

  return (
    <div data-theme={resolvedTheme} data-density={density} data-urls={showUrls ? "1" : "0"} style={accentVars}>
      <div className="app">
        <input ref={fileRef} type="file" accept=".html,text/html" onChange={doImport} style={{ display: "none" }} />
        <div className="app-shell">
        <div className="app-col">

          <header className="header">
            <div className="greet">
              <div className="greet-title">{greeting()}</div>
              <div className="brand-sub">{loading ? "indexing…" : `${live.length} bookmarks${issueCount ? ` · ${issueCount} need attention` : ""}`}</div>
            </div>
            <div className="header-tools">
              <button className="health-chip" onClick={() => setMode("cleanup")} title="Open cleanup">
                <span className="health-dot" style={{ background: scoreColor }} />
                <span className="health-num" style={{ color: scoreColor }}>{score}</span>
                <span className="health-label">health</span>
              </button>
              <button className="btn btn--primary btn--lg" onClick={() => setBmModal({ mode: "add" })}>
                <Ic.Plus size={13} /> Add
              </button>
              <button className="btn btn--secondary btn--lg btn--fill" onClick={() => setCmd(true)}><Ic.Command size={13} /> K</button>
              <div className="menu-wrap" ref={menuRef}>
                <button className="btn btn--secondary btn--lg btn--icon btn--fill" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                  <Ic.Dots size={15} />
                </button>
                {menuOpen && (
                  <div className="popover popover--down">
                    <button className="popover-item" onClick={() => { setMode("cleanup"); setMenuOpen(false); }}><Ic.Scan size={13} /> Cleanup</button>
                    <button className="popover-item" onClick={() => { setStatsOpen(true); setMenuOpen(false); }}><Ic.Bars size={13} /> Stats</button>
                    <button className="popover-item" onClick={() => { setGuide("import"); setMenuOpen(false); }}><Ic.Import size={13} /> Import bookmarks</button>
                    <button className="popover-item" onClick={() => { setGuide("export"); setMenuOpen(false); }}><Ic.Export size={13} /> Export bookmarks</button>
                    <div className="ctx-sep" />
                    <button className="popover-item" onClick={() => { setTheme(theme === "dark" ? "light" : "dark"); setMenuOpen(false); }}>
                      {theme === "dark" ? <Ic.Sun size={13} /> : <Ic.Moon size={13} />} Switch to {theme === "dark" ? "light" : "dark"} theme
                    </button>
                    <button className="popover-item" onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}><Ic.Sliders size={13} /> Settings</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="panel">
            {mode === "search" ? (
              <>
                <div className="search-bar">
                  <Ic.Search size={17} />
                  <input ref={searchRef} autoFocus className="search-input" value={q}
                    onChange={(e) => { setQ(e.target.value); setActiveIdx(-1); }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); }
                      else if (e.key === "ArrowDown" && results.length) { e.preventDefault(); setActiveIdx(0); listRef.current?.focus(); }
                      else if (e.key === "Enter" && results.length) {
                        const r = results[activeIdx >= 0 ? activeIdx : 0];
                        if (r) open(r.b, { background: e.metaKey || e.ctrlKey });
                      }
                    }}
                    placeholder={loading ? "Search bookmarks…" : `Search ${live.length} bookmarks…`} />
                  {q.trim() !== "" && <span className="count-kbd">{results.length >= 100 ? "100+" : results.length}</span>}
                  {q !== "" && <button className="search-clear" onClick={() => { setQ(""); searchRef.current?.focus(); }} aria-label="Clear search" title="Clear"><Ic.X size={14} /></button>}
                </div>

                {(meta.filters || []).length > 0 || q || tag || folder || scope !== DEFAULT_SCOPE ? (
                  <div className="rail scroll-x">
                    <span className="rail-label">Saved</span>
                    {(meta.filters || []).map((f, i) => <button key={i} className="chip" onClick={() => applyFilter(f)} onContextMenu={(e) => openFilterCtx(e, f, i)} title="Right-click to delete">{f.name}</button>)}
                    <button className="chip chip--dashed" onClick={saveFilter}>+ save current</button>
                  </div>
                ) : null}

                <div className="rail scroll-x">
                  {SCOPES.map(([k, l]) => <button key={k} className={`chip${scope === k ? " on" : ""}`} onClick={() => setScope(k)}>{l}</button>)}
                  {issueCount > 0 && (
                    <button className={`chip chip--issues${scope === "issues" ? " on" : ""}`}
                      onClick={() => setScope(scope === "issues" ? "all" : "issues")}>
                      Issues {issueCount}
                    </button>
                  )}
                  {folderChips.length > 0 && <span className="rail-sep" />}
                  {folderChips.map((f) => {
                    const fs = (meta.folderStyles || {})[f];
                    return (
                    <button key={f} className={`chip chip--folder${folder === f ? " on" : ""}${draggingBm ? " chip--droppable" : ""}`}
                      onClick={() => { const on = folder === f; setFolder(on ? null : f); setFolderNav(on ? "" : f); }}
                      onDragOver={(e) => { if (draggingBm) e.preventDefault(); }}
                      onDrop={(e) => dropToFolder(e, f)}>
                      {fs?.emoji ? <span className="f-emoji">{fs.emoji}</span> : <Ic.Folder size={11} />}
                      {fs?.color && <span className="f-dot" style={{ background: fs.color }} />} {f}
                    </button>
                    );
                  })}
                  {folders.length > folderChips.length && (
                    <button className="chip chip--more" onClick={() => setFolderOpen(true)}>
                      +{folders.length - folderChips.length} more
                    </button>
                  )}
                  <span className="rail-sep" />
                  <select className="folder-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="best">sort: best match</option>
                    <option value="folder">sort: folder</option>
                    <option value="added">sort: newest</option>
                    <option value="alpha">sort: A–Z</option>
                    <option value="domain">sort: domain</option>
                  </select>
                  {topTags.map((t) => <button key={t} className={`chip${tag === t ? " on" : ""}`} onClick={() => setTag(tag === t ? null : t)} onContextMenu={(e) => openTagCtx(e, t)} title="Right-click to rename or delete">#{t}</button>)}
                </div>

                {folderNav && (
                  <div className="rail breadcrumb scroll-x">
                    <button className="crumb" onClick={() => { setFolder(null); setFolderNav(""); }}><Ic.Folder size={12} /> All</button>
                    {folderNav.split("/").map((seg, i, arr) => {
                      const path = arr.slice(0, i + 1).join("/");
                      return (
                        <React.Fragment key={path}>
                          <span className="crumb-sep">/</span>
                          <button className={`crumb${folder === path ? " on" : ""}`} onClick={() => { setFolder(path); setFolderNav(path); }}>{seg}</button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {!q && !loading && showSugg && suggestions.length > 0 && (
                  <div className="rail scroll-x sugg-rail">
                    <span className="rail-label sec-label" onContextMenu={(e) => openSectionCtx(e, "sugg")} title="Right-click for options">Suggested</span>
                    {suggestions.map((s) => (
                      <div key={s.url} role="button" tabIndex={0} className="sugg-card"
                        title={s.similarTo
                          ? `${s.url}\nVisited ${s.visitCount} times.\nLooks similar to a saved bookmark: ${s.similarTo.title}\nClick to add anyway. Right-click for more options.`
                          : `${s.url}\nVisited ${s.visitCount} times. Click to bookmark. Right-click for more options.`}
                        onClick={() => addSuggestion(s)}
                        onContextMenu={(e) => openSuggCtx(e, s)}
                        onKeyDown={(e) => { if (e.key === "Enter") addSuggestion(s); }}>
                        <span className="sugg-fav">
                          <Favicon b={s} size={18} />
                          {s.similarTo && <span className="sugg-dot" />}
                        </span>
                        <span className="sugg-domain">{s.domain}</span>
                        {s.similarTo && s.pathLabel && <span className="sugg-path">{s.pathLabel}</span>}
                        <Ic.Plus size={11} />
                      </div>
                    ))}
                  </div>
                )}

                {!q && !loading && showPinned && pinned.length > 0 && (
                  <div className={`pinned ${pinLayout === "compact" ? "pinned--compact" : "pinned--cards"}`}>
                    <div className="pinned-head">
                      <span className="rail-label sec-label" onContextMenu={(e) => openSectionCtx(e, "pinned")} title="Right-click for options"><Ic.PinFilled size={11} /> Pinned</span>
                      <span className="pinned-count">{pinned.length}</span>
                    </div>
                    {pinLayout === "compact" ? (
                      <div className="pin-compact scroll-x">
                        {pinned.map((b) => (
                          <button key={b.id} className={`pin-chip${dragId === b.id ? " dragging" : ""}`} title={`${b.title}\n${b.domain}`} onClick={() => open(b)}
                            onContextMenu={(e) => openCtx(e, b)}
                            draggable onDragStart={() => setDragId(b.id)} onDragOver={(e) => e.preventDefault()}
                            onDrop={() => { reorderPinned(dragId, b.id); setDragId(null); }} onDragEnd={() => setDragId(null)}>
                            <Favicon b={b} size={24} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className={`pin-cards ${pinLayout === "grid" ? "pin-cards--grid" : "scroll-x"}`}>
                        {pinned.map((b) => (
                          <div key={b.id} role="button" tabIndex={0} className={`pin-card${dragId === b.id ? " dragging" : ""}`} onClick={() => open(b)}
                            onContextMenu={(e) => openCtx(e, b)} onKeyDown={(e) => { if (e.key === "Enter") open(b); }}
                            draggable onDragStart={() => setDragId(b.id)} onDragOver={(e) => e.preventDefault()}
                            onDrop={() => { reorderPinned(dragId, b.id); setDragId(null); }} onDragEnd={() => setDragId(null)}>
                            <button className="pin-off" title="Unpin" onClick={(e) => { e.stopPropagation(); togglePin([b.id]); }}><Ic.PinFilled size={11} /></button>
                            <Favicon b={b} size={26} />
                            <div className="pin-card-text">
                              <div className="pin-card-title">{b.title}</div>
                              <div className="pin-card-domain">{b.domain}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!q && !loading && showLater && readLaterItems.length > 0 && (
                  <div className="pinned">
                    <div className="pinned-head">
                      <span className="rail-label sec-label" onContextMenu={(e) => openSectionCtx(e, "later")} title="Right-click for options"><Ic.Clock size={11} /> Read later</span>
                      <span className="pinned-count">{readLaterItems.length}</span>
                    </div>
                    <div className="pinned-list scroll">
                      {readLaterItems.map((b) => (
                        <div key={b.id} className="row pin-row" onClick={() => open(b)} onContextMenu={(e) => openCtx(e, b)}>
                          <Favicon b={b} size={30} />
                          <div className="row-main">
                            <div className="row-title">{b.title}</div>
                            <div className="row-meta"><b>{b.domain}</b> · {b.folder}</div>
                          </div>
                          <button className="pin-off" title="Remove from read later" onClick={(e) => { e.stopPropagation(); toggleReadLater([b.id]); }}><Ic.Clock size={13} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <div className="list-tools">
                    <button className={`btn btn--bare select-all${allResultsSel ? " on" : ""}`} onClick={toggleAllResults}>
                      <span className={`check check--sm${allResultsSel ? " on" : ""}`}>{allResultsSel && <Ic.Check size={11} />}</span>
                      {allResultsSel ? `Clear (${selInResults.length})` : `Select all ${results.length}`}
                    </button>
                    {selInResults.length > 0 && !allResultsSel && <span className="list-tools-hint">{selInResults.length} selected</span>}
                    <span style={{ flex: 1 }} />
                    <button className="btn btn--bare" onClick={openAll} title="Open all results in new tabs"><Ic.External size={13} /> Open all {results.length}</button>
                  </div>
                )}

                <div className="list-wrap">
                  <div ref={listRef} className="list scroll" tabIndex={-1} onKeyDown={listKeyDown} style={{ maxHeight: "max(min(58dvh, 540px), calc(100dvh - 480px))" }}>
                    {loading && [0, 1, 2, 3, 4].map((i) => (
                      <div className="skel" key={i}>
                        <div className="skel-block" style={{ width: 20, height: 20 }} />
                        <div className="skel-block" style={{ width: 34, height: 34, borderRadius: 9 }} />
                        <div style={{ flex: 1 }}>
                          <div className="skel-block" style={{ width: `${44 + i * 9}%`, height: 13, marginBottom: 7 }} />
                          <div className="skel-block" style={{ width: "28%", height: 9 }} />
                        </div>
                      </div>
                    ))}
                    {!loading && results.length === 0 && (
                      live.length === 0 && !q && !folder && !tag ? (
                        <div className="empty">
                          <div className="empty-glyph"><Ic.Logo size={34} /></div>
                          <div className="empty-title">No bookmarks yet</div>
                          <div className="empty-sub">add your first, or import a browser export</div>
                          <div className="empty-actions">
                            <button className="btn btn--primary" onClick={() => setBmModal({ mode: "add" })}><Ic.Plus size={13} /> Add bookmark</button>
                            <button className="btn" onClick={() => setGuide("import")}><Ic.Import size={13} /> Import</button>
                          </div>
                        </div>
                      ) : (
                        <div className="empty">
                          <div className="empty-glyph"><Ic.Circle size={34} /></div>
                          <div className="empty-title">No matches</div>
                          <div className="empty-sub">{q ? "nothing matches your search" : "nothing here with these filters"}</div>
                          <div className="empty-actions">
                            {q && <button className="btn btn--primary" onClick={() => setBmModal({ mode: "add", initial: /\.\w/.test(q) && !/\s/.test(q) ? { url: q } : { title: q } })}><Ic.Plus size={13} /> Add “{q.length > 24 ? q.slice(0, 23) + "…" : q}”</button>}
                            {(q || folder || tag || scope !== DEFAULT_SCOPE) && <button className="btn" onClick={clearFilters}>Clear filters</button>}
                          </div>
                        </div>
                      )
                    )}
                    {results.map(({ b, hits }, idx) => (
                      <React.Fragment key={b.id}>
                        {sort === "folder" && (idx === 0 || results[idx - 1].b.folder !== b.folder) && (
                          <div className="list-section">{b.folder}</div>
                        )}
                        <div className={`row${sel.has(b.id) ? " sel" : ""}${b.dupeOf != null ? " row--dupe" : ""}${idx === activeIdx ? " row--active" : ""}${String(b.id) === String(justAdded) ? " row--new" : ""}`}
                          style={{ "--i": idx }} onClick={() => open(b)} onContextMenu={(e) => openCtx(e, b)}
                          draggable onDragStart={(e) => startBmDrag(e, b)} onDragEnd={() => setDraggingBm(false)}>
                          <button className={`check${sel.has(b.id) ? " on" : ""}`} aria-label="Select"
                            onClick={(e) => { e.stopPropagation(); clickSel(e, b.id, "search", resultIds); }}>
                            {sel.has(b.id) && <Ic.Check size={12} />}
                          </button>
                          <Favicon b={b} />
                          <div className="row-main">
                            <div className={`row-title${b.dead ? " dead" : ""}`}>
                              <Hl text={b.title} hits={hits} />
                              {b.note && <Ic.Note size={11} className="row-note" />}
                            </div>
                            <div className="row-meta"><b><Hl text={b.domain} hits={hits} offset={b.title.length + 1} /></b> · {b.folder}</div>
                          </div>
                          <div className="row-quick-actions">
                            <button className="rq" title={b.pinned ? "Unpin" : "Pin"} onClick={(e) => { e.stopPropagation(); togglePin([b.id]); }}>{b.pinned ? <Ic.PinFilled size={13} /> : <Ic.Pin size={13} />}</button>
                            <button className="rq" title="Read later" onClick={(e) => { e.stopPropagation(); toggleReadLater([b.id]); }}><Ic.Clock size={13} /></button>
                            <button className="rq" title="Copy link" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(b.url).then(() => flash("Link copied")); }}><Ic.Copy size={13} /></button>
                            <button className="rq" title="Edit" onClick={(e) => { e.stopPropagation(); setBmModal({ mode: "edit", b, focus: "title" }); }}><Ic.Pencil size={13} /></button>
                          </div>
                          <div className="row-side">
                            {b.dupeOf != null && (
                              <button className="row-quick" title="Remove this duplicate and keep the other copy"
                                onClick={(e) => { e.stopPropagation(); trash([b.id]); }}>
                                <Ic.Zap size={11} /> remove dupe
                              </button>
                            )}
                            {b.dead && <span className="badge badge--red">dead</span>}
                            {b.dupeOf != null && <span className="badge badge--amber">dupe</span>}
                            {b.tags.slice(0, 2).map((t) => <span key={t} className="badge badge--dim">#{t}</span>)}
                            <span className="row-stat">{b.visitCount || "·"}× {ago(b.lastVisited)}</span>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  {canScroll && <div className="scroll-fade" />}
                  {canScroll && (
                    <button className="scroll-hint" aria-label="Scroll for more"
                      onClick={() => listRef.current?.scrollBy({ top: listRef.current.clientHeight * 0.8, behavior: "smooth" })}>
                      <Ic.ChevronD size={14} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <Cleanup {...{ all, live, issues, score, scoreColor, dupGroups, tab, setTab, sel, setSel, clickSel, askTrash, restore, emptyTrash, archive, unarchive, addTag, autoMerge, scan, rescan, openCtx }}
                onBack={() => setMode("search")} />
            )}
          </main>

          {sel.size > 0 && (
            <div className="bulkbar scroll-x">
              <span className="bulk-count">{sel.size} selected</span>
              <span className="bulk-sep" />
              <input className="text-input" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && tagInput) { addTag(selArr, tagInput); setTagInput(""); } }} placeholder="#tag" />
              <button className="btn btn--primary" onClick={() => { if (tagInput) { addTag(selArr, tagInput); setTagInput(""); } }}><Ic.Tag size={13} /> Tag</button>
              <div style={{ position: "relative" }} ref={moveRef}>
                <button className="btn" onClick={() => setMoveOpen(!moveOpen)}><Ic.Folder size={13} /> Move <Ic.ChevronD size={11} /></button>
                {moveOpen && (
                  <div className="popover scroll">
                    <div className="popover-row">
                      <input className="text-input" style={{ flex: 1, width: "auto" }} value={newFolder}
                        onChange={(e) => setNewFolder(e.target.value)} placeholder="new folder" />
                      <button className="btn btn--primary" onClick={() => newFolder && move(selArr, newFolder)}><Ic.Plus size={13} /></button>
                    </div>
                    {allFolders.map((f) => <button key={f} className="popover-item" onClick={() => move(selArr, f)}><Ic.Folder size={12} /> {f}</button>)}
                  </div>
                )}
              </div>
              <button className="btn" onClick={() => togglePin(selArr)}><Ic.Pin size={13} /> Pin</button>
              <button className="btn" onClick={() => toggleReadLater(selArr)}><Ic.Clock size={13} /> Later</button>
              <button className="btn" onClick={() => openMany(selArr)}><Ic.External size={13} /> Open</button>
              <button className="btn" onClick={() => copyUrls(selArr)}><Ic.Copy size={13} /> Copy</button>
              <button className="btn" onClick={() => exportSelected(selArr)}><Ic.Export size={13} /> Export</button>
              <button className="btn" onClick={() => archive(selArr)}><Ic.Archive size={13} /> Archive</button>
              <button className="btn btn--danger" onClick={() => askTrash(selArr)}><Ic.Trash size={13} /> Delete</button>
              <button className="btn btn--bare" onClick={() => { setSel(new Set()); selAnchor.current = null; }} aria-label="Clear selection"><Ic.X size={13} /></button>
            </div>
          )}

          {cmd && (
            <div className="overlay" onClick={() => setCmd(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <Palette live={live} actions={paletteActions} onOpenBookmark={(b) => { open(b); setCmd(false); }} />
              </div>
            </div>
          )}

          {bmModal && (
            <div className="overlay" onClick={() => setBmModal(null)}>
              <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <BookmarkModal mode={bmModal.mode}
                  initial={bmModal.b ? { title: bmModal.b.title, url: bmModal.b.url, folder: bmModal.b.folder === "Bookmarks bar" ? "" : bmModal.b.folder, tags: bmModal.b.tags } : (bmModal.initial || {})}
                  focus={bmModal.focus || "url"}
                  folders={allFolders.filter((f) => f !== "Bookmarks bar")}
                  allTags={allTags}
                  existingUrls={existingUrls}
                  onSave={(p) => (bmModal.mode === "add" ? saveNew(p) : saveEdit(bmModal.b, p))}
                  onClose={() => setBmModal(null)} />
              </div>
            </div>
          )}

          {helpOpen && (
            <div className="overlay" onClick={() => setHelpOpen(false)}>
              <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <HelpModal onClose={() => setHelpOpen(false)} />
              </div>
            </div>
          )}

          {feedbackOpen && (
            <div className="overlay" onClick={() => setFeedbackOpen(false)}>
              <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <FeedbackModal onClose={() => setFeedbackOpen(false)} />
              </div>
            </div>
          )}

          {settingsOpen && (
            <div className="overlay" onClick={() => setSettingsOpen(false)}>
              <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                <SettingsModal {...{ theme, setTheme, pinLayout, setPinLayout, sort, setSort, scope, setScope, showSugg, setShowSugg, showPinned, setShowPinned, showLater, setShowLater, showUrls, setShowUrls, density, setDensity, accent, setAccent }}
                  accents={ACCENTS} syncOn={syncOn} onToggleSync={toggleSync}
                  onExportJson={doExportJson} onImportJson={doImportJson}
                  onShowTour={() => { setSettingsOpen(false); setTourOpen(true); }}
                  scopes={SCOPES} onClose={() => setSettingsOpen(false)} />
              </div>
            </div>
          )}

          {statsOpen && (
            <div className="overlay" onClick={() => setStatsOpen(false)}>
              <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                <StatsModal live={live} topTags={topTags} onOpen={(b) => { open(b); setStatsOpen(false); }} onClose={() => setStatsOpen(false)} />
              </div>
            </div>
          )}

          {tourOpen && (
            <div className="overlay" onClick={() => setTourOpen(false)}>
              <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                <TourModal onClose={() => setTourOpen(false)} />
              </div>
            </div>
          )}

          {folderStyleTarget && (
            <div className="overlay" onClick={() => setFolderStyleTarget(null)}>
              <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
                <FolderStyleModal folderName={folderStyleTarget.name} initial={(meta.folderStyles || {})[folderStyleTarget.path] || {}}
                  onSave={(style) => saveFolderStyle(folderStyleTarget.path, style)} onClose={() => setFolderStyleTarget(null)} />
              </div>
            </div>
          )}

          {guide && (
            <div className="overlay" onClick={() => setGuide(null)}>
              <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                <GuideModal kind={guide}
                  onConfirm={() => { if (guide === "import") fileRef.current?.click(); else doExport(); setGuide(null); }}
                  onClose={() => setGuide(null)} />
              </div>
            </div>
          )}

          {confirm && (
            <div className="overlay" onClick={() => setConfirm(null)}>
              <div className="modal confirm" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-title">{confirm.title || "Confirm"}</div>
                <div className="confirm-msg">{confirm.msg}</div>
                {confirm.body}
                <div className="confirm-actions">
                  <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
                  <button className="btn btn--primary" onClick={confirm.run}>{confirm.okLabel || "Confirm"}</button>
                </div>
              </div>
            </div>
          )}

          {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.sugg ? suggItems(ctx.sugg) : ctx.folder ? folderCtxItems(ctx.folder) : ctx.filter ? filterCtxItems(ctx.filter) : ctx.tagName ? tagCtxItems(ctx.tagName) : ctx.section ? sectionCtxItems(ctx.section) : ctxItems(ctx.b)} onClose={() => setCtx(null)} />}
          {toast && <div className="toast">{toast.msg}{toast.action && <button className="toast-action" onClick={() => { clearTimeout(toastTimer.current); toast.action.run(); setToast(null); }}>{toast.action.label}</button>}</div>}

          <footer className="foot">
            <button className="foot-help" onClick={() => setHelpOpen(true)}>
              <Ic.Question size={13} /> Shortcuts <span className="kbd">?</span>
            </button>
          </footer>
        </div>

        {mode === "search" && (
          <FolderRail tree={folderTree} nav={folderNav} active={folder} folderStyles={meta.folderStyles || {}} dropActive={draggingBm}
            mode={folderMode} onToggleMode={() => setFolderMode((m) => (m === "tree" ? "drill" : "tree"))}
            onOpen={(node) => { setFolder(node.path); if (folderMode !== "tree" && node.children?.length) setFolderNav(node.path); }}
            onNavigate={(p) => { setFolderNav(p); setFolder(p || null); }}
            onCreate={createNewFolder} onContextMenu={openFolderCtx} onDropBookmark={dropToFolder} />
        )}
        </div>

        {folderOpen && (
          <div className="overlay" onClick={() => setFolderOpen(false)}>
            <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
              <div className="pal-head"><Ic.Folder size={17} /><span className="pal-input" style={{ cursor: "default" }}>Jump to folder</span></div>
              <div className="pal-list scroll" style={{ maxHeight: 360 }}>
                <button className="popover-item" onClick={() => { setFolder(null); setFolderNav(""); setFolderOpen(false); }}>
                  <span className="popover-check">{!folder && <Ic.Check size={12} />}</span> All folders
                </button>
                {folders.map((f) => (
                  <button key={f} className="popover-item" onClick={() => { setFolder(f); setFolderNav(f); setFolderOpen(false); }}>
                    <span className="popover-check">{folder === f && <Ic.Check size={12} />}</span> {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Cleanup(p) {
  const { all, live, issues, score, scoreColor, dupGroups, tab, setTab, sel, setSel, clickSel, askTrash, restore, emptyTrash, archive, unarchive, addTag, autoMerge, scan, rescan, openCtx, onBack } = p;
  const trashList = useMemo(() => all.filter((b) => b.trashed), [all]);
  const archList = useMemo(() => all.filter((b) => b.archived), [all]);
  const tabs = [
    ["dead", "Dead", issues.dead, "var(--red)"],
    ["dupes", "Dupes", issues.dupes, "var(--amber)"],
    ["stale", "Stale", issues.stale, "var(--blue)"],
    ["untagged", "Untagged", issues.untagged, "var(--green)"],
    ["trash", "Trash", trashList, "var(--dim)"],
    ["archived", "Archived", archList, "var(--dim)"],
  ];
  const active = tabs.find((t) => t[0] === tab); const rows = active[2]; const col = active[3];
  const shown = rows.slice(0, 150);
  const shownIds = useMemo(() => shown.map((b) => b.id), [rows]);
  const listRef = useRef(null);
  const canScroll = useScrollHint(listRef, [rows.length, tab]);
  const tiles = [
    ["Live", live.length, "var(--accent)", null],
    ["Dead", issues.dead.length, "var(--red)", "dead"],
    ["Dupes", issues.dupes.length, "var(--amber)", "dupes"],
    ["Stale", issues.stale.length, "var(--blue)", "stale"],
    ["Untagged", issues.untagged.length, "var(--green)", "untagged"],
  ];
  const suggest = (b) => { const top = b.folder.split("/")[0].toLowerCase(); return [...new Set([top])].filter(Boolean).slice(0, 2); };
  const selIn = rows.filter((b) => sel.has(b.id)).map((b) => b.id);
  const rowLabel = tab === "dead" ? "unreachable" : tab === "dupes" ? "dup" : tab === "trash" ? "trashed" : tab === "archived" ? "archived" : tab === "untagged" ? "no tags" : null;
  const allSelected = shown.length > 0 && shown.every((b) => sel.has(b.id));
  const toggleAll = () => setSel((s) => {
    const n = new Set(s);
    if (allSelected) shownIds.forEach((id) => n.delete(id));
    else shownIds.forEach((id) => n.add(id));
    return n;
  });

  return (
    <div className="cleanup">
      <div className="cleanup-head">
        <div className="cleanup-title">Cleanup</div>
        <button className="btn btn--bare" onClick={onBack}><Ic.X size={13} /> Done</button>
      </div>
      <div className="cleanup-top">
        <Gauge value={score} color={scoreColor} />
        <div className="tiles">
          {tiles.map(([l, n, c, target]) =>
            target ? (
              <button key={l} className={`tile${tab === target ? " on" : ""}`} style={{ "--tile-c": c }} onClick={() => setTab(target)}>
                <div className="tile-label"><span className="tile-dot" />{l}</div>
                <div className="tile-num">{n}</div>
              </button>
            ) : (
              <div key={l} className="tile tile--static" style={{ "--tile-c": c }}>
                <div className="tile-label"><span className="tile-dot" />{l}</div>
                <div className="tile-num">{n}</div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="scan-row">
        <button className={`btn btn--accent${scan.active ? " scanning" : ""}`} onClick={rescan}>
          <Ic.Scan size={13} /> {scan.active ? "Scanning…" : "Re-scan links"}
        </button>
        <span className="scan-note">checks reachability only; a no-cors fetch can't see 404s</span>
      </div>

      <div className="tabs scroll-x">
        {tabs.map(([k, l, list, c]) => (
          <button key={k} className={`tab${tab === k ? " on" : ""}`} style={{ "--tab-c": c }} onClick={() => setTab(k)}>
            {l} <span className="tab-count">{list.length}</span>
          </button>
        ))}
      </div>

      {tab === "dupes" && dupGroups.length > 0 && (
        <div className="row-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn btn--accent" onClick={autoMerge}><Ic.Zap size={13} /> Auto-merge {dupGroups.length} groups · keep most-visited</button>
        </div>
      )}

      <div className="row-actions">
        {shown.length > 0 && (
          <button className={`btn select-all${allSelected ? " on" : ""}`} onClick={toggleAll}>
            <span className={`check check--sm${allSelected ? " on" : ""}`}>{allSelected && <Ic.Check size={11} />}</span>
            {allSelected ? `Clear (${selIn.length})` : `Select all${shown.length < rows.length ? ` ${shown.length}` : ""}`}
          </button>
        )}
        <span style={{ flex: 1 }} />
        {tab === "trash" ? (
          <>
            <button className="btn" onClick={() => restore(selIn)}><Ic.Restore size={13} /> Restore selected</button>
            <button className="btn btn--danger" onClick={emptyTrash}><Ic.Trash size={13} /> Empty trash</button>
          </>
        ) : tab === "archived" ? (
          <button className="btn" onClick={() => unarchive(selIn)}><Ic.Restore size={13} /> Unarchive selected</button>
        ) : (
          <>
            <button className="btn" onClick={() => archive(selIn)}><Ic.Archive size={13} /> Archive</button>
            <button className="btn btn--danger" onClick={() => askTrash(selIn)}><Ic.Trash size={13} /> Delete</button>
          </>
        )}
      </div>

      <div className="list-frame list-wrap">
        <div ref={listRef} className="list scroll" style={{ maxHeight: "max(min(42dvh, 340px), calc(100dvh - 640px))" }}>
          {rows.length === 0 && (
            <div className="empty">
              <div className="empty-glyph" style={{ color: "var(--green)" }}><Ic.Check size={30} /></div>
              <div className="empty-title">All clear</div>
              <div className="empty-sub">nothing in {active[1].toLowerCase()}</div>
            </div>
          )}
          {shown.map((b, idx) => (
            <div key={b.id} className={`row${sel.has(b.id) ? " sel" : ""}`} style={{ "--i": idx }}
              onClick={(e) => clickSel(e, b.id, "cleanup:" + tab, shownIds)} onContextMenu={(e) => openCtx(e, b)}>
              <button className={`check${sel.has(b.id) ? " on" : ""}`} aria-label="Select"
                onClick={(e) => { e.stopPropagation(); clickSel(e, b.id, "cleanup:" + tab, shownIds); }}>
                {sel.has(b.id) && <Ic.Check size={12} />}
              </button>
              <Favicon b={b} />
              <div className="row-main">
                <div className="row-title">{b.title}</div>
                {tab === "untagged" ? (
                  <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                    {suggest(b).map((t) => <button key={t} className="sug-tag" onClick={(e) => { e.stopPropagation(); addTag([b.id], t); }}>+ {t}</button>)}
                  </div>
                ) : (
                  <div className="row-meta"><b>{b.domain}</b> · {b.folder}</div>
                )}
              </div>
              <span className="row-stat" style={{ color: col }}>
                {tab === "stale" ? (b.visitCount === 0 ? "unopened" : "1y+") : rowLabel}
              </span>
            </div>
          ))}
        </div>
        {canScroll && <div className="scroll-fade" />}
        {canScroll && (
          <button className="scroll-hint" aria-label="Scroll for more"
            onClick={() => listRef.current?.scrollBy({ top: listRef.current.clientHeight * 0.8, behavior: "smooth" })}>
            <Ic.ChevronD size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function Gauge({ value, color }) {
  const r = 38, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <div className="gauge-wrap">
      <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="48" cy="48" r={r + 6} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="1 5" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle className="gauge-arc" cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="gauge-num" style={{ color }}>
        {value}
        <span className="gauge-cap">health</span>
      </div>
    </div>
  );
}
