import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  ago,
  fdate,
  greeting,
  domainColor,
  initial,
  urlKey,
  fuzzy,
  parseQuery,
  isStale,
  computeIssues,
  healthScore,
  byAdded,
  byAlpha,
  byDomain,
  rank,
  selectBookmarks,
  topOverlay,
  matchMenuShortcut,
  hostOf,
  normalizeUrl,
  isHttpUrl,
  YEAR,
  RECENCY_WINDOW,
} from "../src/lib/model.js";
import { faviconUrl } from "../src/ui/Favicon.jsx";

const DAY = 864e5;
// Fixed "now" so time-relative helpers are deterministic.
const NOW = new Date("2026-06-18T12:00:00Z").getTime();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("ago", () => {
  it("returns 'never' for a missing timestamp", () => {
    expect(ago(0)).toBe("never");
    expect(ago(undefined)).toBe("never");
  });
  it("buckets recent timestamps as 'today'", () => {
    expect(ago(NOW)).toBe("today");
    expect(ago(NOW - 3600e3)).toBe("today");
  });
  it("uses days, months, and years for older timestamps", () => {
    expect(ago(NOW - 5 * DAY)).toBe("5d");
    expect(ago(NOW - 60 * DAY)).toBe("2mo");
    expect(ago(NOW - 800 * DAY)).toBe("2y");
  });
});

describe("fdate", () => {
  it("returns 'never' without a timestamp", () => {
    expect(fdate(null)).toBe("never");
  });
  it("formats a timestamp into a readable date string", () => {
    expect(fdate(NOW)).toMatch(/2026/);
  });
});

describe("greeting", () => {
  it("changes with the hour of day", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(22)).toBe("Good evening");
  });
});

describe("domainColor", () => {
  it("is deterministic and well-formed", () => {
    expect(domainColor("github.com")).toBe(domainColor("github.com"));
    expect(domainColor("github.com")).toMatch(/^hsl\(\d+ 55% 45%\)$/);
  });
  it("differs across domains", () => {
    expect(domainColor("github.com")).not.toBe(domainColor("example.org"));
  });
  it("is deterministic for empty/undefined domain", () => {
    expect(domainColor("github.com")).toBe("hsl(94 55% 45%)");
    expect(domainColor("")).toBe("hsl(0 55% 45%)");
    expect(domainColor(undefined)).toBe("hsl(0 55% 45%)");
  });
});

describe("initial", () => {
  it("uppercases the first character of the domain", () => {
    expect(initial("github.com")).toBe("G");
  });
  it("falls back to '?' for empty/missing domains", () => {
    expect(initial("")).toBe("?");
    expect(initial(undefined)).toBe("?");
    expect(initial(null)).toBe("?");
  });
});

describe("urlKey", () => {
  it("drops protocol, www, hash, and trailing slash", () => {
    expect(urlKey("https://www.Example.com/path/")).toBe("example.com/path");
    expect(urlKey("http://example.com")).toBe("example.com/");
    expect(urlKey("https://example.com/a#section")).toBe("example.com/a");
  });
  it("strips common tracking params but keeps real ones", () => {
    expect(urlKey("https://example.com/?utm_source=x&id=5")).toBe("example.com/?id=5");
    expect(urlKey("https://example.com/?ref=twitter")).toBe("example.com/");
  });
  it("strips interleaved tracking params, keeping the real ones", () => {
    expect(urlKey("https://x.com/p?utm_source=a&utm_medium=b&gclid=c&q=1")).toBe("x.com/p?q=1");
    expect(urlKey("https://x.com/?fbclid=z")).toBe("x.com/");
    expect(urlKey("https://x.com/?gclid=1&id=2")).toBe("x.com/?id=2");
  });
  it("rebuilds a multi-param query string stably", () => {
    expect(urlKey("https://e.com/p?b=2&a=1")).toBe(urlKey("https://e.com/p?b=2&a=1"));
  });
  it("treats www and trailing-slash variants of a page as equal", () => {
    expect(urlKey("https://www.example.com/a/")).toBe(urlKey("http://example.com/a"));
  });
  it("returns the input unchanged when it is not a valid URL", () => {
    expect(urlKey("not a url")).toBe("not a url");
  });
});

describe("hostOf", () => {
  it("strips www and returns lowercased hostname for valid URLs", () => {
    expect(hostOf("https://www.Example.com/path")).toBe("example.com");
    expect(hostOf("https://github.com/user/repo")).toBe("github.com");
  });
  it("returns '' by default on invalid input", () => {
    expect(hostOf("not a url")).toBe("");
    expect(hostOf("")).toBe("");
  });
  it("returns the url as fallback when called with url as fallback (bookmarks.js contract)", () => {
    expect(hostOf("not a url", "not a url")).toBe("not a url");
  });
  it("matches the host portion of urlKey for the same URL", () => {
    const url = "https://WWW.Example.com/path";
    expect(hostOf(url)).toBe(urlKey(url).split("/")[0]);
  });
});

describe("normalizeUrl", () => {
  it("prepends https:// for bare hosts", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });
  it("leaves valid https:// URLs unchanged", () => {
    expect(normalizeUrl("https://example.com/path")).toBe("https://example.com/path");
  });
  it("rejects non-http(s) schemes", () => {
    expect(normalizeUrl("chrome://settings")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("file:///etc/hosts")).toBeNull();
  });
  it("returns null for empty or whitespace input", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
  });
});

describe("isHttpUrl", () => {
  it("returns true for http and https URLs", () => {
    expect(isHttpUrl("https://a.com")).toBe(true);
    expect(isHttpUrl("http://b.org/path?q=1")).toBe(true);
    expect(isHttpUrl("HTTP://CAPS.COM")).toBe(true);
  });
  it("returns false for non-http(s) schemes", () => {
    expect(isHttpUrl("chrome://extensions/")).toBe(false);
    expect(isHttpUrl("file:///etc/hosts")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,hi")).toBe(false);
  });
  it("returns false for empty, undefined, and null", () => {
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });
});

describe("fuzzy", () => {
  it("matches an empty query with a zero score", () => {
    const r = fuzzy("", "anything");
    expect(r).toEqual({ score: 0, hits: new Set() });
  });
  it("matches a subsequence and records hit indices", () => {
    const r = fuzzy("gh", "github");
    expect(r).not.toBeNull();
    expect(r.hits.has(0)).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });
  it("returns null when the query is not a subsequence", () => {
    expect(fuzzy("xyz", "github")).toBeNull();
  });
  it("rewards matches at word boundaries", () => {
    const boundary = fuzzy("r", "my react");
    const mid = fuzzy("y", "my react");
    expect(boundary.score).toBeGreaterThan(mid.score);
  });
  it("records hits for a non-contiguous subsequence", () => {
    expect(fuzzy("ac", "abc").hits).toEqual(new Set([0, 2]));
  });
  it("scores a contiguous match higher than a spread-out one", () => {
    expect(fuzzy("ab", "ab").score).toBeGreaterThan(fuzzy("ab", "axb").score);
  });
});

describe("parseQuery", () => {
  it("extracts operators and leaves the free text", () => {
    const { ops, text } = parseQuery("site:github.com tag:work hello");
    expect(ops.site).toBe("github.com");
    expect(ops.tag).toBe("work");
    expect(text).toBe("hello");
  });
  it("supports folder/in/category aliases and is: filters", () => {
    expect(parseQuery("in:Dev").ops.folder).toBe("dev");
    expect(parseQuery("category:Dev").ops.folder).toBe("dev");
    expect(parseQuery("is:dead").ops.is).toBe("dead");
  });
  it("parses a minimum visit count", () => {
    expect(parseQuery(">5 visits").ops.minVisits).toBe(5);
    expect(parseQuery(">12visits").ops.minVisits).toBe(12);
  });
  it("defaults to no operators on plain text", () => {
    const { ops, text } = parseQuery("just searching");
    expect(ops).toEqual({ site: null, tag: null, folder: null, is: null, minVisits: 0 });
    expect(text).toBe("just searching");
  });
});

describe("isStale", () => {
  it("flags never-visited bookmarks", () => {
    expect(isStale({ visitCount: 0, lastVisited: NOW })).toBe(true);
  });
  it("flags bookmarks last visited over a year ago", () => {
    expect(isStale({ visitCount: 3, lastVisited: NOW - YEAR - DAY })).toBe(true);
  });
  it("does not flag recently visited bookmarks", () => {
    expect(isStale({ visitCount: 3, lastVisited: NOW - 10 * DAY })).toBe(false);
  });
});

describe("computeIssues", () => {
  it("buckets bookmarks into issue categories", () => {
    const live = [
      { dead: true, dupeOf: null, visitCount: 5, lastVisited: NOW, tags: ["a"] },
      { dead: false, dupeOf: "123", visitCount: 5, lastVisited: NOW, tags: ["a"] },
      { dead: false, dupeOf: null, visitCount: 0, lastVisited: NOW, tags: ["a"] },
      { dead: false, dupeOf: null, visitCount: 5, lastVisited: NOW, tags: [] },
    ];
    const issues = computeIssues(live);
    expect(issues.dead).toHaveLength(1);
    expect(issues.dupes).toHaveLength(1);
    expect(issues.stale).toHaveLength(1);
    expect(issues.untagged).toHaveLength(1);
  });
});

describe("healthScore", () => {
  it("is 100 for a clean library", () => {
    const live = [{}, {}, {}];
    const issues = { dead: [], dupes: [], stale: [], untagged: [] };
    expect(healthScore(live, issues)).toBe(100);
  });
  it("drops as issues accumulate and stays within 0..100", () => {
    const live = Array.from({ length: 10 }, () => ({}));
    const issues = { dead: live, dupes: live, stale: live, untagged: live };
    const score = healthScore(live, issues);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(100);
  });
});

describe("sort comparators", () => {
  const wrap = (b) => ({ b });
  it("byAdded sorts newest first", () => {
    const list = [wrap({ dateAdded: 1 }), wrap({ dateAdded: 9 })].sort(byAdded);
    expect(list[0].b.dateAdded).toBe(9);
  });
  it("byAlpha sorts by title", () => {
    const list = [wrap({ title: "Zed" }), wrap({ title: "Apple" })].sort(byAlpha);
    expect(list[0].b.title).toBe("Apple");
  });
  it("byDomain sorts by domain", () => {
    const list = [wrap({ domain: "z.com" }), wrap({ domain: "a.com" })].sort(byDomain);
    expect(list[0].b.domain).toBe("a.com");
  });
});

describe("rank", () => {
  const pool = [
    { title: "GitHub", domain: "github.com", tags: ["dev"], note: "", visitCount: 50, lastVisited: NOW },
    { title: "Old Blog", domain: "blog.example", tags: [], note: "", visitCount: 0, lastVisited: null },
  ];
  it("returns every item (sorted) for an empty query", () => {
    const ranked = rank(pool, "");
    expect(ranked).toHaveLength(2);
    // higher frequency + recency ranks first
    expect(ranked[0].b.title).toBe("GitHub");
  });
  it("filters out non-matching items for a query", () => {
    const ranked = rank(pool, "github");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].b.domain).toBe("github.com");
  });
  it("ranks by descending score", () => {
    const ranked = rank(pool, "");
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });
  it("never produces a NaN score when visitCount is missing", () => {
    const ranked = rank([{ title: "x", domain: "x.com", tags: [], note: "", lastVisited: null }], "");
    expect(Number.isNaN(ranked[0].score)).toBe(false);
  });
  it("decays recency to zero at exactly RECENCY_WINDOW and is maximal at NOW", () => {
    const fresh = { title: "fresh", domain: "f.com", tags: [], note: "", visitCount: 0, lastVisited: NOW };
    const edge = { title: "edge", domain: "e.com", tags: [], note: "", visitCount: 0, lastVisited: NOW - RECENCY_WINDOW };
    const ranked = rank([edge, fresh], "");
    // score here is purely recency*6 (no query, no visits): edge → 0, fresh → 6
    const byTitle = Object.fromEntries(ranked.map((r) => [r.b.title, r.score]));
    expect(byTitle.edge).toBeCloseTo(0);
    expect(byTitle.fresh).toBeCloseTo(6);
    expect(ranked[0].b.title).toBe("fresh");
  });
});

describe("edge cases / hardening", () => {
  it("urlKey leaves non-web schemes untouched (no scheme-loss collisions)", () => {
    expect(urlKey("file:///Users/x/a.html")).toBe("file:///Users/x/a.html");
    expect(urlKey("chrome://extensions/")).toBe("chrome://extensions/");
  });
  it("urlKey only strips the exact 'ref' param, not lookalikes", () => {
    expect(urlKey("https://example.com/?referrer=x")).toBe("example.com/?referrer=x");
    expect(urlKey("https://example.com/?reference=x")).toBe("example.com/?reference=x");
  });
  it("urlKey strips exact fbclid/gclid but not lookalike prefixes", () => {
    expect(urlKey("https://e.com/?fbclid=1")).toBe("e.com/");
    expect(urlKey("https://e.com/?fbclidx=1")).toBe("e.com/?fbclidx=1");
    expect(urlKey("https://e.com/?gclid=1")).toBe("e.com/");
    expect(urlKey("https://e.com/?gclide=1")).toBe("e.com/?gclide=1");
  });
  it("isStale always returns a real boolean", () => {
    expect(isStale({ visitCount: 5, lastVisited: 0 })).toBe(false);
    expect(isStale({ lastVisited: NOW })).toBe(true); // missing visitCount => never-visited
    expect(typeof isStale({ visitCount: 1, lastVisited: NOW })).toBe("boolean");
  });
  it("ago treats future timestamps as 'today' (clock-skew tolerant)", () => {
    expect(ago(NOW + 10 * DAY)).toBe("today");
  });
  it("healthScore returns 100 for an empty library (no divide-by-zero)", () => {
    expect(healthScore([], { dead: [], dupes: [], stale: [], untagged: [] })).toBe(100);
  });
});

describe("topOverlay", () => {
  // The exact Escape-key priority order (highest first).
  const ORDER = [
    "cmd", "ctx", "bmModal", "guide", "helpOpen", "feedbackOpen",
    "folderStyleTarget", "statsOpen", "tourOpen", "settingsOpen",
    "confirm", "moveOpen", "folderOpen", "menuOpen",
  ];
  const allFalse = Object.fromEntries(ORDER.map((k) => [k, false]));

  it("returns null when no flags are set", () => {
    expect(topOverlay(allFalse)).toBe(null);
    expect(topOverlay({})).toBe(null);
  });

  it("returns the key when exactly one flag is set", () => {
    for (const key of ORDER) {
      expect(topOverlay({ ...allFalse, [key]: true })).toBe(key);
    }
  });

  it("returns the highest-priority key when multiple are set", () => {
    // every adjacent pair: the earlier key wins
    for (let i = 0; i < ORDER.length - 1; i++) {
      const flags = { ...allFalse, [ORDER[i]]: true, [ORDER[i + 1]]: true };
      expect(topOverlay(flags)).toBe(ORDER[i]);
    }
    // all set at once → the very first wins
    expect(topOverlay(Object.fromEntries(ORDER.map((k) => [k, true])))).toBe("cmd");
  });

  it("honors specific orderings", () => {
    expect(topOverlay({ ...allFalse, cmd: true, ctx: true })).toBe("cmd");
    expect(topOverlay({ ...allFalse, ctx: true, bmModal: true })).toBe("ctx");
    expect(topOverlay({ ...allFalse, menuOpen: true })).toBe("menuOpen");
    // menuOpen is lowest: any other flag beats it
    expect(topOverlay({ ...allFalse, menuOpen: true, folderOpen: true })).toBe("folderOpen");
  });

  it("uses truthiness, so objects/strings count as open", () => {
    // ctx/bmModal/guide/confirm/folderStyleTarget hold objects in the app
    expect(topOverlay({ ...allFalse, ctx: { x: 1 } })).toBe("ctx");
    expect(topOverlay({ ...allFalse, bmModal: { id: "1" } })).toBe("bmModal");
    // a falsy non-boolean (null/0) is treated as closed
    expect(topOverlay({ ...allFalse, ctx: null, bmModal: { id: "1" } })).toBe("bmModal");
  });
});

describe("selectBookmarks", () => {
  const bm = (o) => ({
    id: o.id,
    title: o.title ?? "Untitled",
    domain: o.domain ?? "example.com",
    folder: o.folder ?? "Bookmarks bar",
    tags: o.tags ?? [],
    note: o.note ?? "",
    visitCount: o.visitCount ?? 0,
    lastVisited: o.lastVisited ?? null,
    dateAdded: o.dateAdded ?? 0,
    dead: o.dead ?? false,
    dupeOf: o.dupeOf ?? null,
    pinned: o.pinned ?? false,
    readLater: o.readLater ?? false,
  });
  // A small library exercising every filter/sort dimension.
  const library = [
    bm({ id: "1", title: "GitHub", domain: "github.com", folder: "Dev", tags: ["work"], visitCount: 100, lastVisited: NOW - DAY, dateAdded: 10 }),
    bm({ id: "2", title: "GitLab", domain: "gitlab.com", folder: "Dev/CI", tags: ["work"], visitCount: 5, lastVisited: NOW - 5 * DAY, dateAdded: 50 }),
    bm({ id: "3", title: "Apple", domain: "apple.com", folder: "Shopping", tags: [], visitCount: 50, lastVisited: NOW - 2 * DAY, dateAdded: 90 }),
    bm({ id: "4", title: "Dead Link", domain: "gone.com", folder: "Dev", tags: ["work"], visitCount: 0, lastVisited: null, dead: true, dateAdded: 30 }),
    bm({ id: "5", title: "Dupe Copy", domain: "github.com", folder: "Dev", tags: ["dupe-tag"], dupeOf: "1", visitCount: 1, lastVisited: NOW - 3 * DAY, dateAdded: 20 }),
    bm({ id: "6", title: "Stale Old", domain: "old.com", folder: "Reading", tags: ["read"], visitCount: 2, lastVisited: NOW - YEAR - DAY, dateAdded: 40 }),
    bm({ id: "7", title: "Saved For Later", domain: "later.com", folder: "Reading", tags: ["read"], visitCount: 3, lastVisited: NOW - DAY, readLater: true, dateAdded: 60 }),
    bm({ id: "8", title: "Pinned Top", domain: "pin.com", folder: "Bookmarks bar", tags: ["fav"], visitCount: 200, lastVisited: NOW, pinned: true, dateAdded: 70 }),
  ];
  const sel = (over = {}) =>
    selectBookmarks({ library, query: "", scope: "all", folder: null, tag: null, sort: "best", showPinned: true, ...over });
  const ids = (res) => res.map((r) => r.b.id);

  it("returns ranked { b, score, hits } objects", () => {
    const r = sel();
    expect(r[0]).toHaveProperty("b");
    expect(r[0]).toHaveProperty("score");
    expect(r[0].hits).toBeInstanceOf(Set);
  });

  it("hides pinned bookmarks while browsing (showPinned && !query)", () => {
    expect(ids(sel({ showPinned: true }))).not.toContain("8");
    // pinned reappear when searching, or when showPinned is off
    expect(ids(sel({ showPinned: false }))).toContain("8");
    expect(ids(sel({ query: "pinned" }))).toContain("8");
  });

  describe("scope filters", () => {
    it("later keeps only readLater bookmarks", () => {
      expect(ids(sel({ scope: "later" }))).toEqual(["7"]);
    });
    it("issues keeps dead or dupeOf!=null", () => {
      expect(ids(sel({ scope: "issues" })).sort()).toEqual(["4", "5"]);
    });
    it("untagged keeps only tagless bookmarks", () => {
      expect(ids(sel({ scope: "untagged" }))).toEqual(["3"]);
    });
    it("dead keeps only dead bookmarks", () => {
      expect(ids(sel({ scope: "dead" }))).toEqual(["4"]);
    });
    it("dupes maps to the dupe filter", () => {
      expect(ids(sel({ scope: "dupes" }))).toEqual(["5"]);
    });
    it("stale keeps only stale bookmarks", () => {
      // never-visited (dead id 4) + visited-over-a-year-ago (id 6), pinned hidden
      expect(ids(sel({ scope: "stale" })).sort()).toEqual(["4", "6"]);
    });
    it("recent sorts by lastVisited desc", () => {
      const r = sel({ scope: "recent", showPinned: false });
      // id 8 lastVisited NOW is first; null lastVisited (id 4) sinks to the end
      expect(r[0].b.id).toBe("8");
      expect(r[r.length - 1].b.id).toBe("4");
    });
    it("top sorts by visitCount desc", () => {
      const r = sel({ scope: "top", showPinned: false });
      expect(r[0].b.id).toBe("8"); // visitCount 200
      expect(r[1].b.id).toBe("1"); // visitCount 100
    });
    it("added sorts by dateAdded desc", () => {
      const r = sel({ scope: "added", showPinned: false, sort: "best" });
      expect(r[0].b.id).toBe("3"); // dateAdded 90 is the newest
    });
  });

  describe("query operators", () => {
    it("site: filters by domain substring", () => {
      // both github.com items, pinned hidden but query present so all stay
      expect(ids(sel({ query: "site:github.com" })).sort()).toEqual(["1", "5"]);
    });
    it("tag: filters by tag", () => {
      expect(ids(sel({ query: "tag:read" })).sort()).toEqual(["6", "7"]);
    });
    it("folder: filters by folder substring", () => {
      expect(ids(sel({ query: "folder:dev" })).sort()).toEqual(["1", "2", "4", "5"]);
    });
    it(">N visits filters by minimum visit count", () => {
      expect(ids(sel({ query: ">50 visits" })).sort()).toEqual(["1", "3", "8"]);
    });
    it(">N visits excludes bookmarks with undefined visitCount", () => {
      // b.visitCount >= ops.minVisits is NaN-false for undefined, so the unvisited one drops
      const lib2 = [
        { ...bm({ id: "u", title: "Unvisited" }), visitCount: undefined },
        bm({ id: "v", title: "Visited", visitCount: 5 }),
      ];
      const r = selectBookmarks({ library: lib2, query: ">2 visits", scope: "all", folder: null, tag: null, sort: "best", showPinned: false });
      expect(r.map((x) => x.b.id)).toEqual(["v"]);
    });
    it("is: operator overrides scope (is:dead filters even when scope is all)", () => {
      // ops.is takes precedence over scope-derived is, so the dead one is kept under scope:all
      expect(ids(sel({ query: "is:dead", scope: "all" }))).toEqual(["4"]);
    });
  });

  it("tag arg filters by tag", () => {
    expect(ids(sel({ tag: "work" })).sort()).toEqual(["1", "2", "4"]);
  });

  describe("folder drill-down (prefix match)", () => {
    it("matches the folder and its subfolders", () => {
      // Dev plus Dev/CI; pinned hidden
      expect(ids(sel({ folder: "Dev" })).sort()).toEqual(["1", "2", "4", "5"]);
    });
    it("matches only the exact subfolder when drilled in", () => {
      expect(ids(sel({ folder: "Dev/CI" }))).toEqual(["2"]);
    });
    it("does not match a sibling sharing a name prefix", () => {
      const lib2 = [bm({ id: "a", folder: "Dev" }), bm({ id: "b", folder: "Development" })];
      const r = selectBookmarks({ library: lib2, query: "", scope: "all", folder: "Dev", tag: null, sort: "best", showPinned: false });
      expect(r.map((x) => x.b.id)).toEqual(["a"]);
    });
  });

  it("slices to the best 100 results", () => {
    const big = Array.from({ length: 150 }, (_, i) => bm({ id: String(i), visitCount: i }));
    const r = selectBookmarks({ library: big, query: "", scope: "top", folder: null, tag: null, sort: "best", showPinned: false });
    expect(r).toHaveLength(100);
    // top scope keeps the highest visitCount items
    expect(r[0].b.visitCount).toBe(149);
  });

  describe("secondary sort", () => {
    const base = { query: "", scope: "all", folder: null, tag: null, showPinned: false };
    it("folder sorts by folder name", () => {
      const r = selectBookmarks({ ...base, sort: "folder", library });
      const folders = r.map((x) => x.b.folder);
      expect(folders).toEqual([...folders].sort((a, b) => a.localeCompare(b)));
    });
    it("added sorts newest dateAdded first", () => {
      const r = selectBookmarks({ ...base, sort: "added", library });
      expect(r[0].b.dateAdded).toBe(90);
    });
    it("alpha sorts by title", () => {
      const r = selectBookmarks({ ...base, sort: "alpha", library });
      expect(r[0].b.title).toBe("Apple");
    });
    it("domain sorts by domain", () => {
      const r = selectBookmarks({ ...base, sort: "domain", library });
      expect(r[0].b.domain).toBe("apple.com");
    });
  });
});

describe("matchMenuShortcut", () => {
  const items = [
    "sep",
    { header: "Actions" },
    { label: "Open", key: "o", run: () => {} },
    { label: "Delete", key: "d", run: () => {} },
    { label: "No key item", run: () => {} },
  ];

  it("returns the item whose key matches (case-insensitive)", () => {
    expect(matchMenuShortcut(items, { key: "o" })).toBe(items[2]);
    expect(matchMenuShortcut(items, { key: "O" })).toBe(items[2]);
    expect(matchMenuShortcut(items, { key: "D" })).toBe(items[3]);
  });

  it("returns null when a modifier key is held", () => {
    expect(matchMenuShortcut(items, { key: "o", metaKey: true })).toBeNull();
    expect(matchMenuShortcut(items, { key: "o", ctrlKey: true })).toBeNull();
    expect(matchMenuShortcut(items, { key: "o", altKey: true })).toBeNull();
  });

  it("skips 'sep' strings and {header} entries (no .key)", () => {
    // 'sep' and the header object do not match any key
    expect(matchMenuShortcut(items, { key: "s" })).toBeNull();
    expect(matchMenuShortcut(items, { key: "A" })).toBeNull();
  });

  it("returns null when no item declares .key", () => {
    expect(matchMenuShortcut([{ label: "X", run: () => {} }], { key: "x" })).toBeNull();
  });

  it("returns null for an empty key", () => {
    expect(matchMenuShortcut(items, { key: "" })).toBeNull();
  });
});

describe("faviconUrl", () => {
  const ENCODED = encodeURIComponent("https://a.com/?q=1 2");

  it("builds a chrome-extension URL with pageUrl and size=64", () => {
    global.chrome = { runtime: { getURL: (p) => "chrome-extension://x" + p } };
    const url = faviconUrl("https://a.com/?q=1 2");
    expect(url).toContain("pageUrl=" + ENCODED);
    expect(url).toContain("&size=64");
    delete global.chrome;
  });

  it("returns null when chrome.runtime.getURL is absent", () => {
    const saved = global.chrome;
    global.chrome = undefined;
    expect(faviconUrl("https://a.com/")).toBeNull();
    global.chrome = saved;
  });
});
