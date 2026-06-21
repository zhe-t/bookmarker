import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  DEFAULT,
  META_KEY,
  getSyncEnabled,
  setSyncEnabled,
  getMeta,
  setMeta,
  patchMeta,
  pushToSync,
  subscribe,
} from "../src/lib/store.js";

const KEY = "bookmark-ops:meta:v1";
const SYNC_FLAG = "bops-sync";
const NOW = new Date("2026-06-18T12:00:00Z").getTime();

// Stateful backing stores so reads reflect prior writes within a test.
let localArea;
let syncArea;
let lsStore;
let onChangedHandlers; // handlers registered via chrome.storage.onChanged.addListener

function makeArea(backing) {
  return {
    get: async (k) => ({ [k]: backing[k] }),
    set: async (obj) => {
      Object.assign(backing, obj);
    },
  };
}

beforeAll(() => {
  globalThis.localStorage = {
    getItem: (k) => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => {
      lsStore[k] = String(v);
    },
  };
  globalThis.chrome = {
    storage: {
      local: makeArea({}),
      sync: makeArea({}),
      onChanged: {
        addListener: (h) => onChangedHandlers.push(h),
        removeListener: (h) => {
          onChangedHandlers = onChangedHandlers.filter((x) => x !== h);
        },
      },
    },
  };
});

afterAll(() => {
  delete globalThis.chrome;
  delete globalThis.localStorage;
});

beforeEach(() => {
  // Fresh backing state per test.
  localArea = {};
  syncArea = {};
  lsStore = {};
  onChangedHandlers = [];
  globalThis.chrome.storage.local = makeArea(localArea);
  globalThis.chrome.storage.sync = makeArea(syncArea);
});

describe("META_KEY", () => {
  it("is the exact wire format the service worker reads/writes", () => {
    expect(META_KEY).toBe("bookmark-ops:meta:v1"); // locks the shared storage key
  });
});

describe("DEFAULT", () => {
  it("contains all fields needed as App.jsx pre-load placeholder (pinned, similarOk, suggestHidden)", () => {
    expect(Array.isArray(DEFAULT.pinned)).toBe(true);
    expect(Array.isArray(DEFAULT.similarOk)).toBe(true);
    expect(Array.isArray(DEFAULT.suggestHidden)).toBe(true);
  });
});

describe("getMeta", () => {
  it("merges stored partial meta over DEFAULT (every DEFAULT key present)", async () => {
    localArea[KEY] = { tags: { 101: ["git"] }, _ts: 5 };
    const meta = await getMeta();
    for (const k of Object.keys(DEFAULT)) {
      expect(meta).toHaveProperty(k);
    }
    expect(meta.tags).toEqual({ 101: ["git"] });
    expect(meta.filters).toEqual([]); // default-supplied
    expect(meta.folderStyles).toEqual({}); // default-supplied
  });

  it("with sync DISABLED returns the local copy and ignores sync", async () => {
    setSyncEnabled(false);
    localArea[KEY] = { notes: { 1: "local" }, _ts: 1 };
    syncArea[KEY] = { notes: { 1: "synced-newer" }, _ts: 999 };
    const meta = await getMeta();
    expect(meta.notes).toEqual({ 1: "local" });
  });

  it("with sync ENABLED and a NEWER sync _ts returns the synced copy (last-write-wins)", async () => {
    setSyncEnabled(true);
    localArea[KEY] = { notes: { 1: "local" }, _ts: 10 };
    syncArea[KEY] = { notes: { 1: "synced" }, _ts: 20 };
    const meta = await getMeta();
    expect(meta.notes).toEqual({ 1: "synced" });
  });

  it("with sync ENABLED and an OLDER sync _ts returns the local copy", async () => {
    setSyncEnabled(true);
    localArea[KEY] = { notes: { 1: "local" }, _ts: 30 };
    syncArea[KEY] = { notes: { 1: "synced" }, _ts: 20 };
    const meta = await getMeta();
    expect(meta.notes).toEqual({ 1: "local" });
  });

  it("with sync ENABLED and an EQUAL sync _ts favors the local copy (tie-break)", async () => {
    setSyncEnabled(true);
    localArea[KEY] = { notes: { 1: "local" }, _ts: 10 };
    syncArea[KEY] = { notes: { 1: "synced" }, _ts: 10 };
    const meta = await getMeta();
    expect(meta.notes).toEqual({ 1: "local" });
  });

  it("with sync ENABLED but no synced copy yet returns the local copy", async () => {
    setSyncEnabled(true);
    localArea[KEY] = { notes: { 1: "local" }, _ts: 10 };
    const meta = await getMeta();
    expect(meta.notes).toEqual({ 1: "local" });
  });

  it("returns a DEFAULT clone when both storage areas are empty", async () => {
    setSyncEnabled(true); // also reads sync, which is empty too
    const meta = await getMeta();
    expect(meta).toEqual(DEFAULT);
    expect(meta).not.toBe(DEFAULT); // fresh object, safe to mutate
  });

  it("returns DEFAULT (does not reject) when chrome.storage.local.get throws", async () => {
    setSyncEnabled(false);
    globalThis.chrome.storage.local = {
      get: async () => {
        throw new Error("storage unavailable");
      },
    };
    const meta = await getMeta(); // readArea swallows the throw -> null
    expect(meta).toEqual(DEFAULT);
  });
});

describe("setMeta", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("stamps _ts, always writes local, mirrors to sync when enabled, returns oversize:false", async () => {
    setSyncEnabled(true);
    const { meta, oversize } = await setMeta({ pinned: ["a"] });
    expect(oversize).toBe(false);
    expect(meta._ts).toBe(NOW); // stamped deterministically
    expect(localArea[KEY]).toEqual(meta); // wrote local
    expect(syncArea[KEY]).toEqual(meta); // mirrored to sync
  });

  it("does not mirror to sync when sync is disabled", async () => {
    setSyncEnabled(false);
    const { oversize } = await setMeta({ pinned: ["a"] });
    expect(oversize).toBe(false);
    expect(localArea[KEY]).toBeDefined();
    expect(syncArea[KEY]).toBeUndefined();
  });

  it("does not mutate the caller's meta object", async () => {
    setSyncEnabled(false);
    const input = { pinned: ["a"] };
    const { meta } = await setMeta(input);
    expect(input._ts).toBeUndefined(); // caller's object untouched
    expect(meta._ts).toBe(NOW); // stamp lives on the returned copy
  });

  it("resolves and still stamps _ts when the local write rejects (quota best-effort)", async () => {
    setSyncEnabled(false); // sync skipped, so oversize stays false
    globalThis.chrome.storage.local.set = async () => {
      throw new Error("QUOTA");
    };
    const { meta, oversize } = await setMeta({ pinned: ["a"] });
    expect(oversize).toBe(false);
    expect(meta._ts).toBe(NOW); // returned meta still stamped
  });

  it("returns oversize:true and does NOT write sync when meta exceeds the 90KB budget", async () => {
    setSyncEnabled(true);
    const big = { notes: { 1: "x".repeat(90 * 1024 + 10) } };
    const { oversize } = await setMeta(big);
    expect(oversize).toBe(true);
    expect(localArea[KEY]).toBeDefined(); // local still written
    expect(syncArea[KEY]).toBeUndefined(); // sync skipped
  });

  // The cutoff is strict `<`, so exactly-at-budget is oversize and just-under mirrors.
  // Filler is sized off the serialized envelope so the boundary is hit to the byte.
  const BUDGET = 90 * 1024;
  const envBase = JSON.stringify({ notes: { 1: "" }, _ts: NOW }).length;

  it("treats a payload serializing to EXACTLY the 90KB budget as oversize", async () => {
    setSyncEnabled(true);
    const at = { notes: { 1: "x".repeat(BUDGET - envBase) } };
    expect(JSON.stringify({ ...at, _ts: NOW }).length).toBe(BUDGET); // exact boundary
    const { oversize } = await setMeta(at);
    expect(oversize).toBe(true); // `< BUDGET` excludes equality
    expect(syncArea[KEY]).toBeUndefined();
  });

  it("mirrors a payload serializing to one byte UNDER the budget", async () => {
    setSyncEnabled(true);
    const under = { notes: { 1: "x".repeat(BUDGET - envBase - 1) } };
    expect(JSON.stringify({ ...under, _ts: NOW }).length).toBe(BUDGET - 1);
    const { oversize } = await setMeta(under);
    expect(oversize).toBe(false);
    expect(syncArea[KEY]).toBeDefined();
  });
});

describe("patchMeta", () => {
  it("reads, clones, applies the mutation, persists, and getMeta reflects it", async () => {
    setSyncEnabled(false);
    localArea[KEY] = { pinned: ["a"], _ts: 1 };
    await patchMeta((draft) => {
      draft.pinned.push("b");
    });
    const meta = await getMeta();
    expect(meta.pinned).toEqual(["a", "b"]);
  });

  it("supports a mutation that returns a new object", async () => {
    setSyncEnabled(false);
    localArea[KEY] = { pinned: ["a"], _ts: 1 };
    await patchMeta((draft) => ({ ...draft, pinned: ["z"] }));
    const meta = await getMeta();
    expect(meta.pinned).toEqual(["z"]);
  });

  it("deep-clones so nested edits don't leak into objects read earlier", async () => {
    setSyncEnabled(false);
    localArea[KEY] = { tags: { 1: ["a"] }, _ts: 1 };
    const firstMeta = await getMeta(); // captured before the patch
    await patchMeta((draft) => {
      draft.tags["1"].push("b");
    });
    const stored = await getMeta();
    expect(stored.tags["1"]).toEqual(["a", "b"]); // patch landed
    expect(firstMeta.tags["1"]).toEqual(["a"]); // earlier read untouched
  });
});

describe("pushToSync", () => {
  it("writes local to sync when it fits and returns oversize:false", async () => {
    localArea[KEY] = { pinned: ["a"], _ts: 1 };
    const r = await pushToSync();
    expect(r).toEqual({ oversize: false });
    expect(syncArea[KEY]).toEqual({ pinned: ["a"], _ts: 1 });
  });

  it("returns oversize:false and writes nothing when there is no local meta", async () => {
    const r = await pushToSync();
    expect(r).toEqual({ oversize: false });
    expect(syncArea[KEY]).toBeUndefined();
  });

  it("returns oversize:true and does NOT write sync when over budget", async () => {
    localArea[KEY] = { notes: { 1: "x".repeat(90 * 1024 + 10) }, _ts: 1 };
    const r = await pushToSync();
    expect(r).toEqual({ oversize: true });
    expect(syncArea[KEY]).toBeUndefined();
  });
});

describe("subscribe", () => {
  it("invokes cb with newValue for a KEY change in local or sync, and nothing else", () => {
    const cb = vi.fn();
    subscribe(cb);
    const handler = onChangedHandlers[0];

    handler({ [KEY]: { newValue: { pinned: ["a"] } } }, "local");
    expect(cb).toHaveBeenCalledWith({ pinned: ["a"] });

    handler({ [KEY]: { newValue: { pinned: ["b"] } } }, "sync");
    expect(cb).toHaveBeenLastCalledWith({ pinned: ["b"] });

    cb.mockClear();
    handler({ "other-key": { newValue: 1 } }, "local"); // wrong key
    handler({ [KEY]: { newValue: { pinned: ["c"] } } }, "managed"); // wrong area
    expect(cb).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function that removes the same handler", () => {
    const cb = vi.fn();
    const off = subscribe(cb);
    const handler = onChangedHandlers[0];
    off();
    expect(onChangedHandlers).not.toContain(handler);
  });
});

describe("getSyncEnabled / setSyncEnabled", () => {
  it("round-trips the sync flag through localStorage", () => {
    expect(getSyncEnabled()).toBe(false); // unset defaults to false
    setSyncEnabled(true);
    expect(lsStore[SYNC_FLAG]).toBe("1");
    expect(getSyncEnabled()).toBe(true);
    setSyncEnabled(false);
    expect(lsStore[SYNC_FLAG]).toBe("0");
    expect(getSyncEnabled()).toBe(false);
  });
});
