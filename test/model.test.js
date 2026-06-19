import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  ago,
  fdate,
  greeting,
  domainColor,
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
  YEAR,
} from "../src/lib/model.js";

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
  it("treats www and trailing-slash variants of a page as equal", () => {
    expect(urlKey("https://www.example.com/a/")).toBe(urlKey("http://example.com/a"));
  });
  it("returns the input unchanged when it is not a valid URL", () => {
    expect(urlKey("not a url")).toBe("not a url");
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
