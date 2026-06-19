import { describe, it, expect } from "vitest";
import {
  DEFAULT,
  applyTogglePin,
  applyToggleReadLater,
  applyReorderPinned,
  applyAddTag,
  applyRenameTag,
  applyDeleteTag,
  applyTrash,
  applyRestore,
  applyArchive,
  applyUnarchive,
} from "../src/lib/store.js";

// Fresh draft, the same shape patchMeta hands the transformers (DEFAULT spread).
const draft = (over = {}) => ({ ...structuredClone(DEFAULT), ...structuredClone(over) });

describe("applyTogglePin", () => {
  it("appends only the missing ids, preserving existing order", () => {
    const m = applyTogglePin(draft({ pinned: ["1", "2"] }), [2, 3]);
    expect(m.pinned).toEqual(["1", "2", "3"]); // 2 already pinned, 3 appended
  });
  it("unpins when every id is already pinned, leaving others", () => {
    const m = applyTogglePin(draft({ pinned: ["1", "2", "3"] }), [1, 3]);
    expect(m.pinned).toEqual(["2"]);
  });
  it("pin then unpin a mixed selection round-trips the toggled ids", () => {
    let m = draft({ pinned: ["1"] });
    m = applyTogglePin(m, [2, 3]); // not all pinned -> append
    expect(m.pinned).toEqual(["1", "2", "3"]);
    m = applyTogglePin(m, [2, 3]); // all pinned -> remove
    expect(m.pinned).toEqual(["1"]);
  });
  it("coerces numeric ids to strings", () => {
    const m = applyTogglePin(draft(), [5]);
    expect(m.pinned).toEqual(["5"]);
  });
});

describe("applyToggleReadLater", () => {
  it("appends missing then removes when all present", () => {
    let m = applyToggleReadLater(draft({ readLater: ["1"] }), [1, 2]);
    expect(m.readLater).toEqual(["1", "2"]);
    m = applyToggleReadLater(m, [1, 2]);
    expect(m.readLater).toEqual([]);
  });
});

describe("applyReorderPinned", () => {
  it("moves fromId to toId's slot", () => {
    const m = applyReorderPinned(draft({ pinned: ["a", "b", "c"] }), ["a", "b", "c"], "a", "c");
    expect(m.pinned).toEqual(["b", "c", "a"]);
  });
  it("keeps pinned ids not in the visible list appended at the end", () => {
    const m = applyReorderPinned(draft({ pinned: ["a", "b", "c", "z"] }), ["a", "b", "c"], "c", "a");
    expect(m.pinned).toEqual(["c", "a", "b", "z"]);
  });
  it("no-ops when from equals to or ids are absent", () => {
    expect(applyReorderPinned(draft({ pinned: ["a", "b"] }), ["a", "b"], "a", "a").pinned).toEqual(["a", "b"]);
    expect(applyReorderPinned(draft({ pinned: ["a", "b"] }), ["a", "b"], "x", "a").pinned).toEqual(["a", "b"]);
    expect(applyReorderPinned(draft({ pinned: ["a", "b"] }), ["a", "b"], null, "a").pinned).toEqual(["a", "b"]);
  });
});

describe("applyAddTag", () => {
  it("adds and dedupes per id", () => {
    let m = applyAddTag(draft({ tags: { "1": ["news"] } }), [1, 2], "news");
    expect(m.tags["1"]).toEqual(["news"]); // already there, deduped
    expect(m.tags["2"]).toEqual(["news"]);
    m = applyAddTag(m, [1], "dev");
    expect(m.tags["1"]).toEqual(["news", "dev"]);
  });
});

describe("applyRenameTag", () => {
  it("renames a tag everywhere", () => {
    const m = applyRenameTag(draft({ tags: { "1": ["old", "x"], "2": ["old"] } }), "old", "new");
    expect(m.tags["1"]).toEqual(["new", "x"]);
    expect(m.tags["2"]).toEqual(["new"]);
  });
  it("merges with dedupe when renaming into an existing tag", () => {
    const m = applyRenameTag(draft({ tags: { "1": ["old", "keep"] } }), "old", "keep");
    expect(m.tags["1"]).toEqual(["keep"]);
  });
  it("leaves items without the tag untouched", () => {
    const m = applyRenameTag(draft({ tags: { "1": ["other"] } }), "old", "new");
    expect(m.tags["1"]).toEqual(["other"]);
  });
});

describe("applyDeleteTag", () => {
  it("removes the tag from every item", () => {
    const m = applyDeleteTag(draft({ tags: { "1": ["a", "b"], "2": ["b"] } }), "b");
    expect(m.tags["1"]).toEqual(["a"]);
    expect(m.tags["2"]).toEqual([]);
  });
});

describe("trash / restore round-trip", () => {
  it("trashes (deduped, string-coerced) then restores", () => {
    let m = applyTrash(draft({ trashed: ["1"] }), [1, 2]);
    expect(m.trashed).toEqual(["1", "2"]);
    m = applyRestore(m, [1]);
    expect(m.trashed).toEqual(["2"]);
  });
});

describe("archive / unarchive round-trip", () => {
  it("archives (deduped) then unarchives", () => {
    let m = applyArchive(draft({ archived: ["1"] }), [1, 2]);
    expect(m.archived).toEqual(["1", "2"]);
    m = applyUnarchive(m, [2]);
    expect(m.archived).toEqual(["1"]);
  });
});

describe("transformers don't touch unrelated fields", () => {
  it("pin leaves tags/trashed/archived/readLater alone", () => {
    const base = draft({ tags: { "1": ["x"] }, trashed: ["9"], archived: ["8"], readLater: ["7"] });
    const m = applyTogglePin(base, [1]);
    expect(m.tags).toEqual({ "1": ["x"] });
    expect(m.trashed).toEqual(["9"]);
    expect(m.archived).toEqual(["8"]);
    expect(m.readLater).toEqual(["7"]);
  });
  it("trash leaves pinned/tags alone", () => {
    const m = applyTrash(draft({ pinned: ["5"], tags: { "1": ["x"] } }), [1]);
    expect(m.pinned).toEqual(["5"]);
    expect(m.tags).toEqual({ "1": ["x"] });
  });
  it("deleteTag leaves pinned/trashed alone", () => {
    const m = applyDeleteTag(draft({ pinned: ["5"], trashed: ["6"], tags: { "1": ["gone"] } }), "gone");
    expect(m.pinned).toEqual(["5"]);
    expect(m.trashed).toEqual(["6"]);
  });
});
