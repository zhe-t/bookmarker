// Pure, dependency-free helpers shared across the extension.

export const YEAR = 365 * 864e5;

export const ago = (ts) => {
  if (!ts) return "never";
  const d = Math.floor((Date.now() - ts) / 864e5);
  if (d < 1) return "today";
  if (d < 30) return d + "d";
  if (d < 365) return Math.floor(d / 30) + "mo";
  return Math.floor(d / 365) + "y";
};
export const fdate = (ts) => (ts ? new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "never");

export const greeting = (h = new Date().getHours()) =>
  h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 18 ? "Good afternoon" : "Good evening";

// deterministic color from a domain so favicons fall back to a colored initial
export function domainColor(domain) {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 55% 45%)`;
}

// Canonical key for "is this the same page": protocol-insensitive, no www,
// no hash, no trailing slash, common tracking params stripped.
export function urlKey(url) {
  try {
    const u = new URL(url);
    // only canonicalize web URLs; leave file:/chrome:/etc. untouched so their
    // scheme isn't dropped (which would collide distinct pages onto one key)
    if (u.protocol !== "http:" && u.protocol !== "https:") return url;
    const params = [...u.searchParams.keys()];
    params.forEach((k) => { if (/^(utm_|fbclid$|gclid$|ref$)/i.test(k)) u.searchParams.delete(k); });
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const qs = u.searchParams.toString();
    return host + path + (qs ? "?" + qs : "");
  } catch {
    return url;
  }
}

// fuzzy subsequence match → { score, hits:Set } or null
export function fuzzy(query, text) {
  if (!query) return { score: 0, hits: new Set() };
  const q = query.toLowerCase(), t = text.toLowerCase();
  let qi = 0, score = 0, streak = 0; const hits = new Set();
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      hits.add(i); qi++; streak++; score += 1 + streak * 0.6;
      if (i === 0 || /\s|\/|\.|-/.test(t[i - 1])) score += 3;
    } else streak = 0;
  }
  return qi === q.length ? { score, hits } : null;
}

// operators: site: tag: folder:|in: is:dead|dupe|stale|untagged  >Nvisits
export function parseQuery(raw) {
  const ops = { site: null, tag: null, folder: null, is: null, minVisits: 0 };
  let text = raw || "";
  text = text.replace(/site:(\S+)/i, (_, v) => { ops.site = v.toLowerCase(); return ""; });
  text = text.replace(/tag:(\S+)/i, (_, v) => { ops.tag = v.toLowerCase(); return ""; });
  text = text.replace(/(?:folder|in|category):(\S+)/i, (_, v) => { ops.folder = v.toLowerCase(); return ""; });
  text = text.replace(/is:(dead|dupe|stale|untagged)/i, (_, v) => { ops.is = v.toLowerCase(); return ""; });
  text = text.replace(/>(\d+)\s*visits?/i, (_, v) => { ops.minVisits = +v; return ""; });
  return { ops, text: text.trim() };
}

export const isStale = (b) => (b.visitCount ?? 0) === 0 || (!!b.lastVisited && Date.now() - b.lastVisited > YEAR);

export function computeIssues(live) {
  const dead = [], dupes = [], stale = [], untagged = [];
  live.forEach((b) => {
    if (b.dead) dead.push(b);
    if (b.dupeOf != null) dupes.push(b);
    if (isStale(b)) stale.push(b);
    if (b.tags.length === 0) untagged.push(b);
  });
  return { dead, dupes, stale, untagged };
}

export function healthScore(live, issues) {
  const t = live.length || 1;
  const pen =
    (issues.dead.length / t) * 45 +
    (issues.dupes.length / t) * 25 +
    (issues.stale.length / t) * 18 +
    (issues.untagged.length / t) * 12;
  return Math.max(0, Math.min(100, Math.round(100 - pen)));
}

// Escape-key overlay priority: given the open flags, return the key naming the
// topmost (highest-priority) open overlay, or null if none are open. The order
// here is the single source of truth for which layer Escape closes first.
// Note: selection-clear and cleanup→search are NOT overlays and stay in the
// component as the final fallbacks after this returns null.
const OVERLAY_ORDER = [
  "cmd",
  "ctx",
  "bmModal",
  "guide",
  "helpOpen",
  "feedbackOpen",
  "folderStyleTarget",
  "statsOpen",
  "tourOpen",
  "settingsOpen",
  "confirm",
  "moveOpen",
  "folderOpen",
  "menuOpen",
];
export function topOverlay(flags) {
  for (const key of OVERLAY_ORDER) if (flags[key]) return key;
  return null;
}

// stable secondary sorts offered in the sort dropdown
export const byAdded = (a, b) => (b.b.dateAdded || 0) - (a.b.dateAdded || 0);
export const byAlpha = (a, b) => (a.b.title || "").localeCompare(b.b.title || "");
export const byDomain = (a, b) => (a.b.domain || "").localeCompare(b.b.domain || "") || byAdded(a, b);

// rank a pool by fuzzy match + recency + frequency
export function rank(pool, text) {
  return pool
    .map((b) => {
      const m = fuzzy(text, b.title + " " + b.domain + " " + b.tags.join(" ") + " " + (b.note || ""));
      if (text && !m) return null;
      const rec = b.lastVisited ? Math.max(0, 1 - (Date.now() - b.lastVisited) / (400 * 864e5)) : 0;
      return { b, score: (m ? m.score : 0) + rec * 6 + Math.log2((b.visitCount || 0) + 1) * 1.5, hits: m ? m.hits : new Set() };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

// The bookmark search/selection pipeline: filter the library by scope, query
// operators, tag, and folder; rank; apply the primary scope sort; slice to the
// best 100; then apply the secondary sort. Returns ranked { b, score, hits }
// objects (the shape `rank` produces and the result list consumes).
export function selectBookmarks({ library, query, scope, folder, tag, sort, showPinned }) {
  const { ops, text } = parseQuery(query);
  let pool = library;
  // pinned live in their own section while browsing (no query); hide them
  // from the main list so they aren't shown twice. During search they stay.
  if (!query && showPinned) pool = pool.filter((b) => !b.pinned);
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
}
