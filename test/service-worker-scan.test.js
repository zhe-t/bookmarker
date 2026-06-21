import { describe, it, expect, vi } from "vitest";

// Set up chrome stub before the service-worker module executes its top-level
// listener registrations (module evaluation order requires this to be first).
const chromeMock = {
  commands: { onCommand: { addListener: vi.fn() } },
  runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() }, getURL: (p) => p },
  tabs: { create: vi.fn() },
};
globalThis.chrome = chromeMock;

const { isScannable, scan } = await import("../src/background/service-worker.js");

describe("isScannable", () => {
  it("returns true for http and https URLs", () => {
    expect(isScannable("https://example.com")).toBe(true);
    expect(isScannable("http://example.com/path?q=1")).toBe(true);
  });
  it("returns false for non-http(s) schemes", () => {
    expect(isScannable("file:///usr/local/foo")).toBe(false);
    expect(isScannable("javascript:alert(1)")).toBe(false);
    expect(isScannable("data:text/plain,hello")).toBe(false);
    expect(isScannable("chrome://settings")).toBe(false);
  });
  it("returns false for unparseable URLs", () => {
    expect(isScannable("not-a-url")).toBe(false);
    expect(isScannable("")).toBe(false);
    expect(isScannable(undefined)).toBe(false);
  });
});

describe("scan", () => {
  it("(a) all-resolving fetchFn marks nothing dead", async () => {
    const fetchFn = vi.fn(async () => new Response());
    const dead = await scan(
      ["https://a.com", "https://b.com"],
      { fetchFn }
    );
    expect(dead).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("(b) fetchFn that rejects for one URL marks exactly that URL dead", async () => {
    const BAD = "https://dead.example.com";
    const fetchFn = vi.fn(async (url) => {
      if (url === BAD) throw new Error("network error");
      return new Response();
    });
    const dead = await scan(
      ["https://ok.com", BAD, "https://also-ok.com"],
      { fetchFn }
    );
    expect(dead).toEqual([BAD]);
  });

  it("(c) URLs > batch size all get fetched and results aggregate across batches", async () => {
    const TOTAL = 30;
    const BAD = "https://dead-batch2.example.com";
    const urls = Array.from({ length: TOTAL }, (_, i) => `https://url-${i}.com`);
    urls[15] = BAD; // in second batch (batch=12, so index 15 is batch 2)
    const fetchFn = vi.fn(async (url) => {
      if (url === BAD) throw new Error("fail");
      return new Response();
    });
    const dead = await scan(urls, { fetchFn, batch: 12 });
    expect(fetchFn).toHaveBeenCalledTimes(TOTAL);
    expect(dead).toEqual([BAD]);
  });

  it("(d) empty array returns []", async () => {
    const fetchFn = vi.fn();
    const dead = await scan([], { fetchFn });
    expect(dead).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("(OPT-042) duplicate URLs are fetched once and appear once in dead", async () => {
    const fetchFn = vi.fn(async () => { throw new Error("fail"); });
    const dead = await scan(["https://x.com", "https://x.com"], { fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(dead).toEqual(["https://x.com"]);
  });

  it("(OPT-041) abort timer is cleared via finally even when fetchFn rejects synchronously", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async () => { throw new Error("fail"); });
    await scan(["https://a.com", "https://b.com"], { fetchFn, timeoutMs: 6000 });
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
