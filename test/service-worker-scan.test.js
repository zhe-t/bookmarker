import { describe, it, expect, vi } from "vitest";

// Set up chrome stub before the service-worker module executes its top-level
// listener registrations (module evaluation order requires this to be first).
const chromeMock = {
  commands: { onCommand: { addListener: vi.fn() } },
  runtime: { onInstalled: { addListener: vi.fn() }, onMessage: { addListener: vi.fn() }, getURL: (p) => p },
  tabs: { create: vi.fn() },
};
globalThis.chrome = chromeMock;

const { isScannable } = await import("../src/background/service-worker.js");

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
