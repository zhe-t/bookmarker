// All bookmark metadata Chrome doesn't store natively lives here.
// Keyed by bookmark id. Chrome bookmarks have no tags / archive / "dead" flag,
// so we keep that in chrome.storage.local and merge it at read time.

export const META_KEY = "bookmark-ops:meta:v1";
const KEY = META_KEY;
const SYNC_FLAG = "bops-sync";

export const DEFAULT = {
  tags: {},      // id -> [tag,...]
  pinned: [],    // ids pinned to the top of search (ordered)
  trashed: [],   // ids soft-deleted (hidden; "empty trash" really removes)
  archived: [],  // ids archived (hidden from main, restorable)
  readLater: [], // ids flagged to read later (ordered)
  notes: {},     // id -> note text
  folderStyles: {}, // folder path -> { color, emoji }
  dead: [],      // urls found unreachable by the last scan
  filters: [],   // user-saved smart filters
  similarOk: [],      // suggestion url keys the user confirmed are fine despite a similar bookmark
  suggestHidden: [],  // domains the user removed from the suggestion strip
  _ts: 0,        // last-write timestamp, used for sync conflict resolution
};

// chrome.storage.sync limits: ~100KB total, ~8KB per item. We keep meta in one
// key, so a big library can overflow — callers get an `oversize` signal back.
const SYNC_BUDGET = 90 * 1024;

export const getSyncEnabled = () => localStorage.getItem(SYNC_FLAG) === "1";
export const setSyncEnabled = (on) => localStorage.setItem(SYNC_FLAG, on ? "1" : "0");

async function readArea(area) {
  try { const r = await chrome.storage[area].get(KEY); return r[KEY] || null; } catch { return null; }
}

export async function getMeta() {
  const local = await readArea("local");
  let chosen = local;
  if (getSyncEnabled()) {
    const synced = await readArea("sync");
    // last-write-wins across devices
    if (synced && (!local || (synced._ts || 0) > (local._ts || 0))) chosen = synced;
  }
  return { ...DEFAULT, ...(chosen || {}) };
}

// Persist meta. Always writes local; mirrors to sync when enabled and it fits.
// Returns { oversize } so the UI can warn when a write skipped sync.
export async function setMeta(meta) {
  const out = { ...meta, _ts: Date.now() };
  let oversize = false;
  try { await chrome.storage.local.set({ [KEY]: out }); } catch { /* quota */ }
  if (getSyncEnabled()) {
    const size = JSON.stringify(out).length;
    if (size < SYNC_BUDGET) { try { await chrome.storage.sync.set({ [KEY]: out }); } catch { oversize = true; } }
    else oversize = true;
  }
  return { meta: out, oversize };
}

// convenience patch helper: fn may mutate the draft in place or return a new one
export async function patchMeta(fn) {
  const draft = structuredClone(await getMeta());
  const next = fn(draft) || draft;
  return setMeta(next);
}

/* ── pure metadata transformers ──
   Each takes a meta draft (and args), mutates the relevant field, and returns
   the same object. Designed to drop straight into `patchMeta((m) => applyX(m, …))`.
   Call sites keep the toast wording / state side-effects; only the data rules live here. */

// Toggle pin on a set of ids: if all are already pinned, unpin them all;
// otherwise append the ones not yet pinned (preserving existing order).
export function applyTogglePin(meta, ids) {
  const sids = ids.map(String);
  const cur = (meta.pinned || []).map(String);
  const allPinned = sids.every((id) => cur.includes(id));
  meta.pinned = allPinned ? cur.filter((x) => !sids.includes(x)) : [...cur, ...sids.filter((id) => !cur.includes(id))];
  return meta;
}

// Same shape as applyTogglePin, for the read-later list.
export function applyToggleReadLater(meta, ids) {
  const sids = ids.map(String);
  const cur = (meta.readLater || []).map(String);
  const allLater = sids.every((id) => cur.includes(id));
  meta.readLater = allLater ? cur.filter((x) => !sids.includes(x)) : [...cur, ...sids.filter((id) => !cur.includes(id))];
  return meta;
}

// Reorder the pinned list. `orderedPinnedIds` is the visible pinned order
// (passed in so this stays pure); fromId moves to toId's slot. Any pinned ids
// not in the visible list are appended after, untouched.
export function applyReorderPinned(meta, orderedPinnedIds, fromId, toId) {
  if (fromId == null || String(fromId) === String(toId)) return meta;
  const ids = orderedPinnedIds.map(String);
  const from = ids.indexOf(String(fromId)), to = ids.indexOf(String(toId));
  if (from < 0 || to < 0) return meta;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  const cur = (meta.pinned || []).map(String);
  meta.pinned = [...ids, ...cur.filter((id) => !ids.includes(id))];
  return meta;
}

// Add a tag to each id, deduping per id.
export function applyAddTag(meta, ids, tag) {
  ids.forEach((id) => { meta.tags[id] = [...new Set([...(meta.tags[id] || []), tag])]; });
  return meta;
}

// Rename a tag everywhere; if the target already exists on an item the result
// dedupes (so rename-into-existing merges).
export function applyRenameTag(meta, from, to) {
  Object.keys(meta.tags).forEach((id) => {
    if (meta.tags[id]?.includes(from)) meta.tags[id] = [...new Set(meta.tags[id].map((t) => (t === from ? to : t)))];
  });
  return meta;
}

// Remove a tag from every item that carries it.
export function applyDeleteTag(meta, tag) {
  Object.keys(meta.tags).forEach((id) => {
    if (meta.tags[id]?.includes(tag)) meta.tags[id] = meta.tags[id].filter((x) => x !== tag);
  });
  return meta;
}

// Soft-delete: add ids to trashed (deduped).
export function applyTrash(meta, ids) {
  meta.trashed = [...new Set([...meta.trashed, ...ids.map(String)])];
  return meta;
}

// Restore from trash: drop ids from trashed.
export function applyRestore(meta, ids) {
  const sids = ids.map(String);
  meta.trashed = meta.trashed.filter((x) => !sids.includes(x));
  return meta;
}

// Archive: add ids to archived (deduped).
export function applyArchive(meta, ids) {
  meta.archived = [...new Set([...meta.archived, ...ids.map(String)])];
  return meta;
}

// Unarchive: drop ids from archived.
export function applyUnarchive(meta, ids) {
  const sids = ids.map(String);
  meta.archived = meta.archived.filter((x) => !sids.includes(x));
  return meta;
}

// Push the current local meta to sync (used when the user first enables sync).
export async function pushToSync() {
  const local = await readArea("local");
  if (!local) return { oversize: false };
  const size = JSON.stringify(local).length;
  if (size >= SYNC_BUDGET) return { oversize: true };
  try { await chrome.storage.sync.set({ [KEY]: local }); return { oversize: false }; }
  catch { return { oversize: true }; }
}

export function subscribe(cb) {
  const handler = (changes, area) => { if ((area === "local" || area === "sync") && changes[KEY]) cb(changes[KEY].newValue); };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
