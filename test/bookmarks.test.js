import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { loadEnriched, exportJson, exportHtml, importJson, importHtml } from "../src/lib/bookmarks.js";
import { urlKey } from "../src/lib/model.js";

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

  it("walks deep (depth-3) nesting and empty-title nested folders into correct paths and counts", async () => {
    // Dev > Sub > Deep > leaf (depth-3) and Dev > "" (empty title) > leaf
    const tree = [{ id: "0", title: "", children: [
      { id: "1", parentId: "0", title: "Bookmarks bar", children: [
        { id: "10", parentId: "1", title: "Dev", children: [
          { id: "20", parentId: "10", title: "Sub", children: [
            { id: "30", parentId: "20", title: "Deep", children: [
              { id: "301", parentId: "30", title: "Leaf", url: "https://deep.example", dateAdded: 1000 },
            ] },
          ] },
          { id: "40", parentId: "10", title: "", children: [
            { id: "401", parentId: "40", title: "Empty", url: "https://empty.example", dateAdded: 2000 },
          ] },
        ] },
      ] },
    ] }];
    const prev = globalThis.chrome.bookmarks.getTree;
    globalThis.chrome.bookmarks.getTree = async () => structuredClone(tree);
    try {
      const { all, folderTree } = await loadEnriched();
      const byId = Object.fromEntries(all.map((b) => [b.id, b]));
      expect(byId["301"].folder).toBe("Dev/Sub/Deep");
      expect(byId["401"].folder).toBe("Dev/"); // empty segment yields a trailing slash, filtered out downstream
      // both leaves roll up under Dev; the empty segment is dropped by filter(Boolean)
      expect(folderTree.map((f) => f.name)).toEqual(["Dev"]);
      expect(folderTree[0].count).toBe(2);
      const sub = folderTree[0].children.find((c) => c.name === "Sub");
      expect(sub.count).toBe(1);
      expect(sub.children.find((c) => c.name === "Deep").count).toBe(1);
    } finally {
      globalThis.chrome.bookmarks.getTree = prev;
    }
  });

  it("rolls nested counts up to ancestors, includes empty user folders, sorts alpha, and drops empty containers", async () => {
    // Dev (under the bar) holds a nested CI subfolder with one bookmark, so the
    // descendant bumps both Dev and CI. Zed is a depth-1 user folder with no
    // bookmarks (included with count 0); the depth-1 containers stay excluded.
    const tree = [{ id: "0", title: "", children: [
      { id: "1", parentId: "0", title: "Bookmarks bar", children: [
        { id: "10", parentId: "1", title: "Dev", children: [
          { id: "101", parentId: "10", title: "Top", url: "https://dev.example", dateAdded: 1000 },
          { id: "20", parentId: "10", title: "CI", children: [
            { id: "201", parentId: "20", title: "Pipe", url: "https://ci.example", dateAdded: 2000 },
          ] },
        ] },
      ] },
      { id: "30", parentId: "0", title: "Zed", children: [] }, // empty depth-1 user folder
      { id: "2", parentId: "0", title: "Other bookmarks", children: [] }, // empty container must not appear
    ] }];
    const prev = globalThis.chrome.bookmarks.getTree;
    globalThis.chrome.bookmarks.getTree = async () => structuredClone(tree);
    try {
      const { folderTree } = await loadEnriched();
      expect(folderTree.map((f) => f.name)).toEqual(["Dev", "Zed"]); // alpha sort, no container
      const dev = folderTree[0];
      expect(dev.count).toBe(2); // CI's leaf bumps Dev too
      const ci = dev.children.find((c) => c.name === "CI");
      expect(ci.path).toBe("Dev/CI");
      expect(ci.count).toBe(1);
      expect(folderTree[1].count).toBe(0); // empty user folder included with zero
    } finally {
      globalThis.chrome.bookmarks.getTree = prev;
    }
  });

  it("returns meta merged with the schema defaults", async () => {
    const { meta } = await loadEnriched();
    // a field not present in our partial META still exists via DEFAULT
    expect(meta.filters).toEqual([]);
    expect(meta.folderStyles).toEqual({});
  });
});

describe("walk fallbacks for legacy/imported nodes", () => {
  it("defaults a missing dateAdded to now and an empty title to the url host", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const tree = [{ id: "0", title: "", children: [
      { id: "1", parentId: "0", title: "Bookmarks bar", children: [
        { id: "103", parentId: "1", title: "No Date", url: "https://nodate.example/x" }, // missing dateAdded
        { id: "104", parentId: "1", title: "", url: "https://www.foo.example/x", dateAdded: 5000 }, // empty title
      ] },
    ] }];
    const prev = globalThis.chrome.bookmarks.getTree;
    globalThis.chrome.bookmarks.getTree = async () => structuredClone(tree);
    try {
      const { all } = await loadEnriched();
      const byId = Object.fromEntries(all.map((b) => [b.id, b]));
      expect(byId["103"].dateAdded).toBe(NOW);
      expect(Number.isFinite(byId["103"].dateAdded) && byId["103"].dateAdded > 0).toBe(true);
      expect(byId["104"].title).toBe("foo.example");
    } finally {
      globalThis.chrome.bookmarks.getTree = prev;
      vi.useRealTimers();
    }
  });
});

describe("hostOf normalization (via loadEnriched.domain)", () => {
  it("lowercases and strips www, matching urlKey's host portion for an uppercase WWW. host", async () => {
    const url = "https://WWW.Example.com/page";
    const tree = [{ id: "0", title: "", children: [
      { id: "1", parentId: "0", title: "Bookmarks bar",
        children: [{ id: "11", parentId: "1", title: "", url, dateAdded: 1000 }] },
    ] }];
    const prev = globalThis.chrome.bookmarks.getTree;
    globalThis.chrome.bookmarks.getTree = async () => structuredClone(tree);
    try {
      const { all } = await loadEnriched();
      const b = all.find((x) => x.id === "11");
      expect(b.domain).toBe("example.com");
      expect(b.domain).toBe(urlKey(url).split("/")[0]);
    } finally {
      globalThis.chrome.bookmarks.getTree = prev;
    }
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

  it("escapes URL and tags so attribute-injection payloads cannot break out", () => {
    const html = exportHtml([
      { url: 'https://a.com/"><img src=x>', title: "t", tags: ['t">x'], dateAdded: 1000 },
    ]);
    expect(html).not.toContain('"><img');
    expect(html).toContain('HREF="https://a.com/&quot;&gt;&lt;img src=x&gt;"');
    expect(html).toContain('TAGS="t&quot;&gt;x"');
  });

  it("does not throw on a title-less item and emits an empty title segment", () => {
    let html;
    expect(() => {
      html = exportHtml([{ url: "https://a.com", title: undefined, tags: [], dateAdded: 1000 }]);
    }).not.toThrow();
    expect(html).toContain('TAGS=""></A>');
  });

  it("defaults ADD_DATE for an item with no dateAdded instead of emitting NaN", () => {
    const html = exportHtml([{ url: "https://a.com", title: "x", tags: [] }]);
    expect(html).not.toContain('ADD_DATE="NaN"');
    expect(html).toMatch(/ADD_DATE="\d+"/);
  });

  it("converts dateAdded to seconds and comma-joins tags", () => {
    const html = exportHtml([{ url: "https://a.com", title: "x", tags: ["x", "y"], dateAdded: 1700000000000 }]);
    expect(html).toContain('ADD_DATE="1700000000"');
    expect(html).toContain('TAGS="x,y"');
  });
});

describe("importJson", () => {
  // Each test installs its own chrome with a mutable meta store, an incrementing
  // bookmarks.create, and a getTree (so ensureFolder can resolve/create folders).
  function install(metaSeed = {}) {
    let store = { ...metaSeed };
    let nextId = 500;
    const created = [];
    const tree = [{ id: "0", title: "", children: [
      { id: "1", parentId: "0", title: "Bookmarks bar", children: [] },
    ] }];
    globalThis.localStorage = { getItem: () => null, setItem: () => {} };
    globalThis.chrome = {
      bookmarks: {
        getTree: async () => structuredClone(tree),
        create: async ({ parentId, title, url }) => {
          const id = String(nextId++);
          created.push({ id, parentId, title, url });
          if (!url) tree[0].children[0].children.push({ id, parentId, title, children: [] });
          return { id, parentId, title, url };
        },
      },
      storage: {
        local: { get: async (k) => ({ [k]: store }), set: async (obj) => { store = obj[KEY]; } },
        sync: { get: async () => ({}) },
        onChanged: { addListener() {}, removeListener() {} },
      },
    };
    return { created, getStore: () => store };
  }

  it("creates missing bookmarks, returns the count, and skips URLs already present", async () => {
    const { created } = install();
    const existing = new Map([["https://have.example", "9"]]);
    const text = JSON.stringify({ bookmarks: [
      { url: "https://new.example", title: "New" },
      { url: "https://have.example", title: "Dup" }, // already in existing => skipped
      { title: "No URL" },                            // no url => skipped
    ] });
    const count = await importJson(text, existing);
    expect(count).toBe(1);
    expect(created.map((c) => c.url)).toEqual(["https://new.example"]);
    expect(existing.get("https://new.example")).toBe("500");
  });

  it("routes a real top-level folder through ensureFolder but treats a CONTAINER name as no folder", async () => {
    const { created } = install();
    const text = JSON.stringify({ bookmarks: [
      { url: "https://a.example", title: "A", folder: "Dev/Sub" }, // top = Dev => folder created
      { url: "https://b.example", title: "B", folder: "Bookmarks bar" }, // container => folderName null
    ] });
    await importJson(text, new Map());
    const devFolder = created.find((c) => !c.url && c.title === "Dev");
    expect(devFolder).toBeTruthy();
    const a = created.find((c) => c.url === "https://a.example");
    expect(a.parentId).toBe(devFolder.id); // routed under the new Dev folder
    const b = created.find((c) => c.url === "https://b.example");
    expect(b.parentId).toBe("1"); // container name => straight into the bar, no folder
  });

  it("dedupes tags via Set union, sets note only when truthy, and pushes pinned/readLater ids once", async () => {
    const { getStore } = install({ tags: { 9: ["keep"] }, notes: {}, pinned: [], readLater: [] });
    const existing = new Map([["https://known.example", "9"]]);
    const text = JSON.stringify({ bookmarks: [
      { url: "https://known.example", tags: ["keep", "new"], note: "", pinned: true, readLater: true },
      { url: "https://known.example", tags: ["new", "extra"], pinned: true, readLater: true }, // same id again
    ] });
    await importJson(text, existing);
    const m = getStore();
    expect(m.tags["9"].sort()).toEqual(["extra", "keep", "new"]); // union, no dupes
    expect(m.notes["9"]).toBeUndefined();                          // empty note never written
    expect(m.pinned).toEqual(["9"]);                               // pushed once despite two items
    expect(m.readLater).toEqual(["9"]);
  });

  it("writes a note when truthy", async () => {
    const { getStore } = install({ tags: {}, notes: {}, pinned: [], readLater: [] });
    const text = JSON.stringify({ bookmarks: [{ url: "https://n.example", note: "hello" }] });
    await importJson(text, new Map());
    expect(getStore().notes["500"]).toBe("hello");
  });
});

// Minimal DOMParser mock for the node environment: parses <A HREF="...">text</A> tags.
function makeDOMParser() {
  return {
    parseFromString(html) {
      const anchors = [];
      const re = /<[Aa]\s[^>]*[Hh][Rr][Ee][Ff]=["']([^"']+)["'][^>]*>(.*?)<\/[Aa]>/gi;
      let m;
      while ((m = re.exec(html)) !== null) {
        anchors.push({ href: m[1], textContent: m[2].trim() });
      }
      return { querySelectorAll: () => anchors };
    },
  };
}

describe("importHtml", () => {
  function install() {
    let nextId = 600;
    const created = [];
    const tree = [{ id: "0", title: "", children: [
      { id: "1", parentId: "0", title: "Bookmarks bar", children: [] },
    ] }];
    globalThis.localStorage = { getItem: () => null, setItem: () => {} };
    globalThis.chrome = {
      bookmarks: {
        getTree: async () => structuredClone(tree),
        create: async ({ parentId, title, url }) => {
          const id = String(nextId++);
          created.push({ id, parentId, title, url });
          if (!url) tree[0].children[0].children.push({ id, parentId, title, children: [] });
          return { id, parentId, title, url };
        },
      },
      storage: {
        local: { get: async (k) => ({ [k]: {} }), set: async () => {} },
        sync: { get: async () => ({}) },
        onChanged: { addListener() {}, removeListener() {} },
      },
    };
    globalThis.DOMParser = class { parseFromString(...a) { return makeDOMParser().parseFromString(...a); } };
    return { created };
  }

  afterAll(() => { delete globalThis.DOMParser; });

  it("creates only the new link and returns 1 when one href is already in existingUrls", async () => {
    const { created } = install();
    const html = `<html><body>
      <A HREF="https://new.example/page">New Page</A>
      <A HREF="https://have.example">Have</A>
    </body></html>`;
    const existing = new Set(["https://have.example"]);
    const count = await importHtml(html, existing);
    expect(count).toBe(1);
    expect(created.filter((c) => c.url).map((c) => c.url)).toEqual(["https://new.example/page"]);
  });

  it("returns 0 and never calls ensureFolder when all links are already present", async () => {
    const { created } = install();
    const html = `<A HREF="https://a.example">A</A>`;
    const count = await importHtml(html, new Set(["https://a.example"]));
    expect(count).toBe(0);
    expect(created).toHaveLength(0); // ensureFolder never called => no folder created
  });

  it("uses the host as title when the link text is empty", async () => {
    const { created } = install();
    const html = `<A HREF="https://www.foo.example/bar"></A>`;
    await importHtml(html, new Set());
    const bm = created.find((c) => c.url === "https://www.foo.example/bar");
    expect(bm).toBeTruthy();
    expect(bm.title).toBe("foo.example"); // hostOf strips www and lowercases
  });

  it("slices to at most 1000 links", async () => {
    const { created } = install();
    const links = Array.from({ length: 1050 }, (_, i) => `<A HREF="https://x${i}.example">t</A>`).join("\n");
    const html = `<html><body>${links}</body></html>`;
    await importHtml(html, new Set());
    const bookmarkCreates = created.filter((c) => c.url);
    expect(bookmarkCreates.length).toBe(1000);
  });
});

// Helper: install a minimal chrome mock with custom history entries and meta,
// using a single-node bookmark tree so loadEnriched has no saved URLs.
function installSuggestions({ history, meta = {} }) {
  const tree = [{ id: "0", title: "", children: [
    { id: "1", parentId: "0", title: "Bookmarks bar", children: [] },
  ] }];
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.chrome = {
    bookmarks: { getTree: async () => structuredClone(tree) },
    history: { search: async () => structuredClone(history) },
    storage: {
      local: { get: async (k) => ({ [k]: meta }) },
      sync: { get: async () => ({}) },
      onChanged: { addListener() {}, removeListener() {} },
    },
  };
}

describe("computeSuggestions filters (via loadEnriched)", () => {
  afterAll(() => {
    delete globalThis.chrome;
    delete globalThis.localStorage;
  });

  it("keeps one card per domain and picks the URL with the highest visit count", async () => {
    installSuggestions({
      history: [
        { url: "https://multi.example/low",  title: "Low",  visitCount: 5,  lastVisitTime: NOW },
        { url: "https://multi.example/high", title: "High", visitCount: 20, lastVisitTime: NOW },
        { url: "https://other.example/",     title: "Other", visitCount: 8, lastVisitTime: NOW },
      ],
    });
    const { suggestions } = await loadEnriched();
    const domains = suggestions.map((s) => s.domain);
    expect(domains.filter((d) => d === "multi.example")).toHaveLength(1);
    const multi = suggestions.find((s) => s.domain === "multi.example");
    expect(multi.url).toBe("https://multi.example/high"); // higher-visit URL wins
  });

  it("excludes URLs whose pathname includes /search with a query string", async () => {
    installSuggestions({
      history: [
        { url: "https://engine.example/search?q=foo", title: "Search", visitCount: 10, lastVisitTime: NOW },
        { url: "https://engine.example/results",      title: "Results", visitCount: 10, lastVisitTime: NOW },
      ],
    });
    const { suggestions } = await loadEnriched();
    const urls = suggestions.map((s) => s.url);
    expect(urls).not.toContain("https://engine.example/search?q=foo");
  });

  it("excludes domains listed in meta.suggestHidden", async () => {
    installSuggestions({
      history: [
        { url: "https://hidden.example/page", title: "Hidden", visitCount: 15, lastVisitTime: NOW },
        { url: "https://visible.example/",    title: "Visible", visitCount: 8, lastVisitTime: NOW },
      ],
      meta: { suggestHidden: ["hidden.example"] },
    });
    const { suggestions } = await loadEnriched();
    const domains = suggestions.map((s) => s.domain);
    expect(domains).not.toContain("hidden.example");
    expect(domains).toContain("visible.example");
  });

  it("excludes a URL that passes ^https?: but throws in new URL (malformed-http catch path)", async () => {
    installSuggestions({
      history: [
        { url: "http://", title: "Broken", visitCount: 9, lastVisitTime: NOW },
        { url: "https://good.example/", title: "Good", visitCount: 5, lastVisitTime: NOW },
      ],
    });
    const { suggestions } = await loadEnriched();
    const domains = suggestions.map((s) => s.domain);
    expect(domains).not.toContain(""); // malformed URL yields no domain entry
    expect(domains).toContain("good.example"); // valid URL still appears
  });

  it("caps suggestions at 8 items even when more qualifying domains exist", async () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      url: `https://d${i}.example/`,
      title: `Site ${i}`,
      visitCount: 10 + i,
      lastVisitTime: NOW,
    }));
    installSuggestions({ history });
    const { suggestions } = await loadEnriched();
    expect(suggestions.length).toBe(8);
  });

  it("sets similarTo and pathLabel when the history URL shares a domain with a saved bookmark", async () => {
    // saved bookmark at /saved; history entry at /other on the same domain
    const tree = [{ id: "0", title: "", children: [
      { id: "1", parentId: "0", title: "Bookmarks bar", children: [
        { id: "11", parentId: "1", title: "Saved Page", url: "https://twin.example/saved", dateAdded: 1000 },
      ] },
    ] }];
    globalThis.chrome = {
      bookmarks: { getTree: async () => structuredClone(tree) },
      history: { search: async () => [
        { url: "https://twin.example/other", title: "Other Page", visitCount: 10, lastVisitTime: NOW },
      ] },
      storage: {
        local: { get: async (k) => ({ [k]: {} }) },
        sync: { get: async () => ({}) },
        onChanged: { addListener() {}, removeListener() {} },
      },
    };
    const { suggestions } = await loadEnriched();
    const s = suggestions.find((x) => x.domain === "twin.example");
    expect(s).toBeTruthy();
    expect(s.similarTo).toEqual({ title: "Saved Page", url: "https://twin.example/saved" });
    expect(s.pathLabel).not.toBeNull();
    expect(s.pathLabel).toBe("/other");
  });

  it("suppresses similarTo and pathLabel when the URL's key is in meta.similarOk", async () => {
    const histUrl = "https://twin.example/other";
    const tree = [{ id: "0", title: "", children: [
      { id: "1", parentId: "0", title: "Bookmarks bar", children: [
        { id: "11", parentId: "1", title: "Saved Page", url: "https://twin.example/saved", dateAdded: 1000 },
      ] },
    ] }];
    globalThis.chrome = {
      bookmarks: { getTree: async () => structuredClone(tree) },
      history: { search: async () => [
        { url: histUrl, title: "Other Page", visitCount: 10, lastVisitTime: NOW },
      ] },
      storage: {
        local: { get: async (k) => ({ [k]: { similarOk: [urlKey(histUrl)] } }) },
        sync: { get: async () => ({}) },
        onChanged: { addListener() {}, removeListener() {} },
      },
    };
    const { suggestions } = await loadEnriched();
    const s = suggestions.find((x) => x.domain === "twin.example");
    expect(s).toBeTruthy();
    expect(s.similarTo).toBeNull();
    expect(s.pathLabel).toBeNull();
  });
});
