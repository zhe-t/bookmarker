// All bookmark metadata Chrome doesn't store natively lives here.
// Keyed by bookmark id. Chrome bookmarks have no tags / archive / "dead" flag,
// so we keep that in chrome.storage.local and merge it at read time.

const KEY = "bookmark-ops:meta:v1";
const SYNC_FLAG = "bops-sync";

const DEFAULT = {
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
  meta._ts = Date.now();
  let oversize = false;
  try { await chrome.storage.local.set({ [KEY]: meta }); } catch { /* quota */ }
  if (getSyncEnabled()) {
    const size = JSON.stringify(meta).length;
    if (size < SYNC_BUDGET) { try { await chrome.storage.sync.set({ [KEY]: meta }); } catch { oversize = true; } }
    else oversize = true;
  }
  return { meta, oversize };
}

// convenience patch helper: fn may mutate the draft in place or return a new one
export async function patchMeta(fn) {
  const draft = structuredClone(await getMeta());
  const next = fn(draft) || draft;
  return setMeta(next);
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
