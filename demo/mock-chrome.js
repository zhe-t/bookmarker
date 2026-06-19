// A minimal in-memory stand-in for the slice of the chrome.* APIs the dashboard
// uses, seeded with realistic sample data. This is ONLY loaded by the demo
// harness (npm run demo) — it never ships in the extension build.
//
// The seed is shaped to exercise every cleanup category: a dead link, a
// duplicate, several stale/untagged bookmarks, plus history-only domains that
// surface as "add" suggestions.
//
// Scope: reads are faithful; mutations are best-effort. Add/edit reflect in the
// in-memory tree, but move/remove/removeTree are no-ops and the dead-link
// "rescan" is simulated — so destructive actions appear to work and then reset
// on reload. Good enough for a demo; do not treat it as a real backend.

import { DEFAULT } from "../src/lib/store.js";

const DAY = 864e5;
const now = Date.now();

// folderId -> display name (top-level categories live under the Bookmarks bar)
const FOLDERS = [
  { id: "10", name: "Dev" },
  { id: "20", name: "Reading" },
  { id: "30", name: "Design" },
  { id: "40", name: "Tools" },
];

// [id, title, url, folderId | null (=> directly in the bar)]
const BOOKMARKS = [
  ["101", "GitHub", "https://github.com", "10"],
  ["102", "MDN Web Docs", "https://developer.mozilla.org", "10"],
  ["103", "React Docs", "https://react.dev", "10"],
  ["104", "Stack Overflow", "https://stackoverflow.com/questions", "10"],
  ["105", "GitHub", "https://www.github.com/", "10"], // duplicate of 101 by canonical URL
  ["201", "Paul Graham — Essays", "http://www.paulgraham.com/articles.html", "20"],
  ["202", "Hacker News", "https://news.ycombinator.com", "20"],
  ["203", "Stratechery", "https://stratechery.com", "20"],
  ["204", "The Old Blog", "https://oldblog.example.com", "20"],
  ["301", "Figma", "https://figma.com", "30"],
  ["302", "Dribbble", "https://dribbble.com", "30"],
  ["303", "Refactoring UI", "https://refactoringui.com", "30"],
  ["401", "Excalidraw", "https://excalidraw.com", "40"],
  ["402", "Vercel", "https://vercel.com", "40"],
  ["403", "Linear", "https://linear.app", "40"],
  ["404", "Defunct Startup", "https://defunct-startup.example", "40"],
  ["501", "Gmail", "https://mail.google.com", null],
];

// url -> { c: visitCount, daysAgo: lastVisit }
const VISITS = {
  "https://github.com": { c: 120, daysAgo: 1 },
  "https://developer.mozilla.org": { c: 60, daysAgo: 4 },
  "https://react.dev": { c: 90, daysAgo: 2 },
  "https://stackoverflow.com/questions": { c: 40, daysAgo: 9 },
  "https://news.ycombinator.com": { c: 220, daysAgo: 1 },
  "https://figma.com": { c: 35, daysAgo: 6 },
  "https://linear.app": { c: 80, daysAgo: 3 },
  "https://mail.google.com": { c: 310, daysAgo: 1 },
  "https://vercel.com": { c: 22, daysAgo: 12 },
};

// History-only domains (not bookmarked) → power the "add" suggestion strip.
const HISTORY_ONLY = [
  ["https://chat.openai.com", "ChatGPT", 160, 1],
  ["https://tailwindcss.com/docs", "Tailwind CSS Docs", 48, 2],
  ["https://www.youtube.com", "YouTube", 95, 1],
];

// ── build the bookmark tree chrome.bookmarks.getTree() returns ──────────────
function buildTree() {
  const folderNodes = FOLDERS.map((f) => ({
    id: f.id,
    parentId: "1",
    title: f.name,
    children: BOOKMARKS.filter((b) => b[3] === f.id).map(toNode(f.id)),
  }));
  const barLevelBookmarks = BOOKMARKS.filter((b) => b[3] === null).map(toNode("1"));
  return [
    {
      id: "0",
      title: "",
      children: [
        { id: "1", parentId: "0", title: "Bookmarks bar", children: [...folderNodes, ...barLevelBookmarks] },
        { id: "2", parentId: "0", title: "Other bookmarks", children: [] },
      ],
    },
  ];
}
const toNode = (parentId) => (b) => ({
  id: b[0],
  parentId,
  title: b[1],
  url: b[2],
  dateAdded: now - (200 - Number(b[0])) * DAY,
});

let tree = buildTree();

// ── history ─────────────────────────────────────────────────────────────────
function buildHistory() {
  const fromBookmarks = Object.entries(VISITS).map(([url, v]) => ({
    url,
    title: url,
    visitCount: v.c,
    lastVisitTime: now - v.daysAgo * DAY,
  }));
  const historyOnly = HISTORY_ONLY.map(([url, title, c, daysAgo]) => ({
    url,
    title,
    visitCount: c,
    lastVisitTime: now - daysAgo * DAY,
  }));
  return [...fromBookmarks, ...historyOnly];
}
const history = buildHistory();

// ── chrome.storage (metadata Chrome can't store natively) ────────────────────
const META_KEY = "bookmark-ops:meta:v1";
// Spread DEFAULT so new fields added to the real store schema can't silently
// drift out of the demo seed — only override what the demo needs to look alive.
const seededMeta = {
  ...DEFAULT,
  tags: {
    101: ["git", "code"],
    102: ["docs"],
    103: ["docs", "frontend"],
    202: ["news"],
    301: ["design"],
    401: ["design", "tools"],
  },
  pinned: ["101", "202"],
  readLater: ["203"],
  notes: { 103: "Hooks + reference" },
  dead: ["https://defunct-startup.example"],
  _ts: now,
};
const storageData = { local: { [META_KEY]: seededMeta }, sync: {} };
const listeners = [];

function makeArea(area) {
  return {
    async get(key) {
      const k = typeof key === "string" ? key : null;
      if (k) return { [k]: storageData[area][k] };
      return { ...storageData[area] };
    },
    async set(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: storageData[area][k], newValue: v };
        storageData[area][k] = v;
      }
      listeners.forEach((cb) => cb(changes, area));
    },
  };
}

// ── chrome.bookmarks mutations (best-effort; demo is mostly read-only) ────────
function findNode(nodes, id, parent = null) {
  for (const n of nodes) {
    if (n.id === id) return { node: n, parent: parent || nodes };
    if (n.children) {
      const hit = findNode(n.children, id, n.children);
      if (hit) return hit;
    }
  }
  return null;
}

let createSeq = 0; // monotonic so two same-tick creates never collide

const bookmarks = {
  async getTree() {
    return structuredClone(tree);
  },
  async update(id, changes) {
    const hit = findNode(tree, id);
    if (hit) Object.assign(hit.node, changes);
    return hit ? structuredClone(hit.node) : null;
  },
  async create({ parentId = "1", title, url }) {
    const id = "new-" + ++createSeq;
    const node = { id, parentId, title, url, dateAdded: now };
    const hit = findNode(tree, parentId);
    if (hit && hit.node.children) hit.node.children.push(node);
    return structuredClone(node);
  },
  async move(id, { parentId }) {
    return { id, parentId };
  },
  async remove() {},
  async removeTree() {},
};

globalThis.chrome = {
  bookmarks,
  history: {
    async search() {
      return structuredClone(history);
    },
  },
  // The real dead-link scan lives in the service worker, which replies to a
  // { type: "scan", urls } message with { dead: [...urls] }. The demo has no
  // service worker, so answer here with the seeded dead URLs — otherwise
  // "Re-scan links" would call sendMessage on an undefined runtime and throw.
  runtime: {
    sendMessage(msg, cb) {
      const dead = (msg?.urls || []).filter((u) => seededMeta.dead.includes(u));
      if (cb) cb({ dead });
    },
  },
  storage: {
    local: makeArea("local"),
    sync: makeArea("sync"),
    onChanged: {
      addListener: (cb) => listeners.push(cb),
      removeListener: (cb) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      },
    },
  },
  // Favicon.jsx checks chrome.runtime?.getURL; leaving it undefined makes the UI
  // fall back to its deterministic colored initials (which look great in the demo).
  tabs: { create() {}, async query() { return []; } },
};
