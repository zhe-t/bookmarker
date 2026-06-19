import { domainColor, urlKey } from "./model.js";
import { getMeta, patchMeta } from "./store.js";

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

// Short, human-scannable path for a URL (first 1–2 segments, ellipsized).
// Used to distinguish a suggestion from a same-domain bookmark.
const shortPath = (url) => {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean).slice(0, 2);
    let p = segs.length ? "/" + segs.join("/") : (u.search || "/");
    if (p.length > 22) p = p.slice(0, 21) + "…";
    return p;
  } catch { return ""; }
};

// Flatten the bookmark tree into a list with folder paths. Chrome's fixed
// containers (Bookmarks bar, Other bookmarks) are depth-1 nodes; their names
// would prefix every path, so folder paths start below them. Bookmarks living
// directly in a container use the container's name as their folder.
function walk(nodes, path, out, depth = 0, base = "", folders = []) {
  for (const n of nodes) {
    if (n.url) {
      out.push({
        id: n.id, title: n.title || hostOf(n.url), url: n.url,
        domain: hostOf(n.url), folder: path || base || "Bookmarks bar",
        parentId: n.parentId, dateAdded: n.dateAdded || Date.now(),
      });
    } else if (n.children) {
      const name = n.title || "";
      if (depth === 0) walk(n.children, "", out, 1, "", folders);
      // depth-1 folders are the top-level user categories shown in the sidebar;
      // record their node id so they can be renamed/deleted by id, not name
      else if (depth === 1) { folders.push({ id: n.id, name }); walk(n.children, "", out, 2, name, folders); }
      else walk(n.children, path ? path + "/" + name : name, out, depth + 1, base, folders);
    }
  }
}

// Frequently-visited history entries that aren't bookmarked yet, for the
// suggestion strip. Filters obvious noise (search-result pages, non-http).
// "Already bookmarked" uses normalized url keys, so trailing-slash / hash /
// www / tracking-param variants of a saved page are never suggested. A
// candidate on the same domain as a saved bookmark (different path) is kept
// but flagged via `similarTo`, unless the user marked that url as ok.
function computeSuggestions(hist, bookmarks, similarOk, hiddenDomains) {
  const keySet = new Set(bookmarks.map((b) => urlKey(b.url)));
  const byDomain = {};
  bookmarks.forEach((b) => { if (!byDomain[b.domain]) byDomain[b.domain] = b; });
  // one card per domain: sorted by visits first, so the first URL seen for a
  // domain is its most-visited page
  const seenDomain = new Set();
  return hist
    .filter((h) => /^https?:/.test(h.url) && (h.visitCount || 0) >= 3 && !keySet.has(urlKey(h.url)))
    .filter((h) => !hiddenDomains.has(hostOf(h.url)))
    .filter((h) => { try { const u = new URL(h.url); return !(u.pathname.includes("/search") && u.search); } catch { return false; } })
    .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
    .filter((h) => { const d = hostOf(h.url); return seenDomain.has(d) ? false : seenDomain.add(d); })
    .slice(0, 8)
    .map((h) => {
      const domain = hostOf(h.url);
      const twin = byDomain[domain];
      const similarTo = twin && !similarOk.has(urlKey(h.url)) ? { title: twin.title, url: twin.url } : null;
      // when the domain is already bookmarked, surface the path so a different
      // page on that domain doesn't read like a duplicate of the saved one
      const pathLabel = similarTo ? shortPath(h.url) : null;
      return { url: h.url, title: h.title || domain, domain, pathLabel, visitCount: h.visitCount || 0, color: domainColor(domain), similarTo };
    });
}

// Load real bookmarks, enrich with history visit data + stored metadata.
export async function loadEnriched() {
  const tree = await chrome.bookmarks.getTree();
  const flat = [];
  const folderNodes = [];
  walk(tree, "", flat, 0, "", folderNodes);

  // visit counts + last visit from history (best-effort, single bulk query)
  const visits = {};
  let hist = [];
  try {
    hist = await chrome.history.search({ text: "", startTime: 0, maxResults: 100000 });
    hist.forEach((h) => { visits[h.url] = { c: h.visitCount || 0, t: h.lastVisitTime || null }; });
  } catch { /* history permission may be denied */ }

  const meta = await getMeta();
  const deadSet = new Set(meta.dead);
  const trashed = new Set(meta.trashed.map(String));
  const archived = new Set(meta.archived.map(String));
  const pinned = new Set((meta.pinned || []).map(String));
  const readLater = new Set((meta.readLater || []).map(String));
  const notes = meta.notes || {};

  // duplicate detection by canonical key (catches www / trailing-slash /
  // tracking-param variants, not just byte-identical URLs); keep earliest.
  const seen = {};
  flat.forEach((b) => {
    const v = visits[b.url] || { c: 0, t: null };
    b.color = domainColor(b.domain);
    b.visitCount = v.c;
    b.lastVisited = v.t;
    b.tags = meta.tags[b.id] || [];
    b.note = notes[b.id] || "";
    b.dead = deadSet.has(b.url);
    b.trashed = trashed.has(String(b.id));
    b.archived = archived.has(String(b.id));
    b.pinned = pinned.has(String(b.id));
    b.readLater = readLater.has(String(b.id));
    const k = urlKey(b.url);
    if (seen[k] != null) b.dupeOf = seen[k]; else { seen[k] = b.id; b.dupeOf = null; }
  });

  const suggestions = computeSuggestions(hist, flat, new Set(meta.similarOk || []), new Set(meta.suggestHidden || []));
  const folderTree = buildFolderTree(flat, folderNodes);

  return { all: flat, meta, suggestions, folderNodes, folderTree };
}

// Nested folder tree with descendant-inclusive counts, for drill-down
// navigation. Empty top-level folders (from folderNodes) are included.
const CONTAINER = /^(bookmarks bar|other bookmarks|mobile bookmarks)$/i;
function buildFolderTree(flat, folderNodes) {
  const root = { name: "", path: "", count: 0, children: new Map() };
  const descend = (parts, bump) => {
    let node = root, path = "";
    for (const part of parts) {
      path = path ? path + "/" + part : part;
      if (!node.children.has(part)) node.children.set(part, { name: part, path, count: 0, children: new Map() });
      node = node.children.get(part);
      if (bump) node.count += 1;
    }
  };
  flat.forEach((b) => { const parts = b.folder.split("/").filter(Boolean); if (parts.length) descend(parts, true); });
  folderNodes.forEach((f) => { if (f.name && !CONTAINER.test(f.name) && !root.children.has(f.name)) descend([f.name], false); });
  const toArr = (n) => ({ name: n.name, path: n.path, count: n.count, children: [...n.children.values()].map(toArr).sort((a, b) => a.name.localeCompare(b.name)) });
  return [...root.children.values()].filter((n) => !CONTAINER.test(n.name)).map(toArr).sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateBookmark(id, changes) {
  return chrome.bookmarks.update(String(id), changes);
}

// Full backup as JSON: bookmarks plus their metadata, keyed inline by URL so it
// restores correctly on another machine where bookmark ids differ.
export function exportJson(live) {
  const bookmarks = live.map((b) => ({
    url: b.url, title: b.title, folder: b.folder,
    tags: b.tags || [], note: b.note || "",
    pinned: !!b.pinned, readLater: !!b.readLater,
  }));
  return JSON.stringify({ version: 1, exportedAt: Date.now(), bookmarks }, null, 2);
}

// Restore a JSON backup: create any missing bookmarks (matched by URL), then
// merge tags / notes / pins / read-later back onto the resolved ids.
export async function importJson(text, existing) {
  const data = JSON.parse(text);
  const items = Array.isArray(data.bookmarks) ? data.bookmarks : [];
  let created = 0;
  for (const it of items) {
    if (!it.url || existing.has(it.url)) continue;
    const top = it.folder ? it.folder.split("/")[0] : null;
    const folderName = top && !CONTAINER.test(top) ? top : null;
    try { const node = await createBookmark({ title: it.title || it.url, url: it.url, folderName }); existing.set(it.url, node.id); created++; } catch { /* skip */ }
  }
  await patchMeta((m) => {
    items.forEach((it) => {
      const id = String(existing.get(it.url) || "");
      if (!id) return;
      if (it.tags?.length) m.tags[id] = [...new Set([...(m.tags[id] || []), ...it.tags])];
      if (it.note) m.notes[id] = it.note;
      if (it.pinned && !m.pinned.map(String).includes(id)) m.pinned.push(id);
      if (it.readLater && !m.readLater.map(String).includes(id)) m.readLater.push(id);
    });
  });
  return created;
}

// Create a bookmark, optionally under a (possibly new) named folder.
export async function createBookmark({ title, url, folderName }) {
  const parentId = folderName ? await ensureFolder(folderName) : "1";
  return chrome.bookmarks.create({ parentId, title, url });
}

// Find or create a folder by name under the Bookmarks bar; returns its id.
export async function ensureFolder(name) {
  const tree = await chrome.bookmarks.getTree();
  let found = null;
  const search = (nodes) => nodes.forEach((n) => { if (!n.url && n.title === name) found = n; if (n.children) search(n.children); });
  search(tree);
  if (found) return found.id;
  // bookmarks bar is typically id "1"
  const created = await chrome.bookmarks.create({ parentId: "1", title: name });
  return created.id;
}

export async function moveTo(ids, folderName) {
  const parentId = await ensureFolder(folderName);
  for (const id of ids) await chrome.bookmarks.move(String(id), { parentId });
}

// Create a new top-level folder (reuses existing one of the same name).
export const createFolder = (name) => ensureFolder(name);

// Rename a folder node by id.
export async function renameFolder(id, title) {
  return chrome.bookmarks.update(String(id), { title });
}

// Delete a folder node and everything inside it.
export async function deleteFolder(id) {
  return chrome.bookmarks.removeTree(String(id));
}

export async function removeForever(ids) {
  for (const id of ids) { try { await chrome.bookmarks.remove(String(id)); } catch { /* already gone */ } }
}

// Export current live set to Netscape bookmark HTML.
export function exportHtml(items) {
  const rows = items.map((b) =>
    `    <DT><A HREF="${b.url}" ADD_DATE="${Math.floor(b.dateAdded / 1e3)}" TAGS="${b.tags.join(",")}">${escapeHtml(b.title)}</A>`
  ).join("\n");
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${rows}\n</DL><p>`;
}
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Import a Netscape HTML string: create new bookmarks under an "Imported" folder, skipping URLs we already have.
export async function importHtml(htmlString, existingUrls) {
  const doc = new DOMParser().parseFromString(htmlString, "text/html");
  const links = [...doc.querySelectorAll("a")].filter((a) => a.href && !existingUrls.has(a.href));
  if (!links.length) return 0;
  const parentId = await ensureFolder("Imported");
  let n = 0;
  for (const a of links.slice(0, 1000)) {
    try { await chrome.bookmarks.create({ parentId, title: a.textContent.trim() || hostOf(a.href), url: a.href }); n++; } catch { /* skip */ }
  }
  return n;
}
