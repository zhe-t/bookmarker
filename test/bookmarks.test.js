import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadEnriched, exportJson, exportHtml } from "../src/lib/bookmarks.js";

const DAY = 864e5;
const NOW = new Date("2026-06-18T12:00:00Z").getTime();
const KEY = "bookmark-ops:meta:v1";

// A controlled bookmark tree (chrome.bookmarks.getTree shape): two containers,
// a user folder "Dev" with a duplicate pair, a bookmark directly in the bar, and
// one bookmark under "Other bookmarks".
const TREE = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        parentId: "0",
        title: "Bookmarks bar",
        children: [
          {
            id: "10",
            parentId: "1",
            title: "Dev",
            children: [
              { id: "101", parentId: "10", title: "GitHub", url: "https://github.com", dateAdded: 1000 },
              { id: "102", parentId: "10", title: "GitHub dup", url: "https://www.github.com/", dateAdded: 2000 },
            ],
          },
          { id: "103", parentId: "1", title: "Bar Direct", url: "https://bar.example/page", dateAdded: 3000 },
        ],
      },
      {
        id: "2",
        parentId: "0",
        title: "Other bookmarks",
        children: [{ id: "201", parentId: "2", title: "Lonely", url: "https://lonely.example", dateAdded: 4000 }],
      },
    ],
  },
];

const HISTORY = [
  { url: "https://github.com", title: "GitHub", visitCount: 50, lastVisitTime: NOW - DAY },
  { url: "https://frequent.example/page", title: "Frequent", visitCount: 10, lastVisitTime: NOW - DAY }, // not bookmarked => suggestion
  { url: "https://rare.example", title: "Rare", visitCount: 1, lastVisitTime: NOW - DAY }, // below the >=3 threshold => no suggestion
];

const META = { tags: { 101: ["git"] }, dead: ["https://lonely.example"] };

beforeAll(() => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.chrome = {
    bookmarks: { getTree: async () => structuredClone(TREE) },
    history: { search: async () => structuredClone(HISTORY) },
    storage: {
      local: { get: async (k) => ({ [k]: k === KEY ? META : undefined }) },
      sync: { get: async () => ({}) },
      onChanged: { addListener() {}, removeListener() {} },
    },
  };
});
afterAll(() => {
  delete globalThis.chrome;
  delete globalThis.localStorage;
});

describe("loadEnriched", () => {
  it("flattens the tree with the expected folder paths", async () => {
    const { all } = await loadEnriched();
    expect(all.map((b) => b.id)).toEqual(["101", "102", "103", "201"]);
    const byId = Object.fromEntries(all.map((b) => [b.id, b]));
    expect(byId["101"].folder).toBe("Dev");
    expect(byId["102"].folder).toBe("Dev");
    expect(byId["103"].folder).toBe("Bookmarks bar"); // direct child of a container
    expect(byId["201"].folder).toBe("Other bookmarks");
  });

  it("detects duplicates by canonical URL (www / trailing slash), keeping the earliest", async () => {
    const { all } = await loadEnriched();
    const byId = Object.fromEntries(all.map((b) => [b.id, b]));
    expect(byId["101"].dupeOf).toBeNull();
    expect(byId["102"].dupeOf).toBe("101");
  });

  it("merges history visit data and stored metadata", async () => {
    const { all } = await loadEnriched();
    const byId = Object.fromEntries(all.map((b) => [b.id, b]));
    expect(byId["101"].visitCount).toBe(50);
    expect(byId["101"].tags).toEqual(["git"]);
    expect(byId["101"].dead).toBe(false);
    expect(byId["102"].visitCount).toBe(0); // www variant not in history
    expect(byId["201"].dead).toBe(true); // from meta.dead
  });

  it("suggests frequent non-bookmarked history, filtering low-visit and bookmarked URLs", async () => {
    const { suggestions } = await loadEnriched();
    expect(suggestions.map((s) => s.domain)).toEqual(["frequent.example"]);
  });

  it("builds a folder tree with descendant counts, excluding Chrome's containers", async () => {
    const { folderTree } = await loadEnriched();
    expect(folderTree.map((f) => f.name)).toEqual(["Dev"]);
    expect(folderTree[0].count).toBe(2);
  });

  it("returns meta merged with the schema defaults", async () => {
    const { meta } = await loadEnriched();
    // a field not present in our partial META still exists via DEFAULT
    expect(meta.filters).toEqual([]);
    expect(meta.folderStyles).toEqual({});
  });
});

describe("exportJson", () => {
  it("serializes bookmarks with their metadata, keyed by URL", () => {
    const live = [
      { url: "https://a.com", title: "A", folder: "Dev", tags: ["x"], note: "n", pinned: true, readLater: false },
    ];
    const data = JSON.parse(exportJson(live));
    expect(data.version).toBe(1);
    expect(data.bookmarks).toHaveLength(1);
    expect(data.bookmarks[0]).toMatchObject({ url: "https://a.com", title: "A", tags: ["x"], note: "n", pinned: true });
  });
});

describe("exportHtml", () => {
  it("emits Netscape bookmark HTML and escapes special characters", () => {
    const html = exportHtml([
      { url: "https://a.com", title: 'Tom & "Jerry" <b>', tags: ["x"], dateAdded: 1000 },
    ]);
    expect(html).toContain("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
    expect(html).toContain('HREF="https://a.com"');
    expect(html).toContain("Tom &amp; &quot;Jerry&quot; &lt;b&gt;");
    expect(html).not.toContain("<b>"); // raw tag must be escaped
  });
});
