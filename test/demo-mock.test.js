import { describe, it, expect, beforeAll } from "vitest";

// Smoke test for the demo harness: importing mock-chrome installs globalThis.chrome,
// then the REAL loadEnriched must produce a populated dataset. This turns silent
// drift between the mock/seed and the src/lib data contract into a CI failure.
beforeAll(async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  await import("../demo/mock-chrome.js");
});

describe("demo mock harness", () => {
  it("drives loadEnriched into a populated, internally-consistent dataset", async () => {
    const { loadEnriched } = await import("../src/lib/bookmarks.js");
    const { all, suggestions, folderTree, meta } = await loadEnriched();

    expect(all.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(folderTree.length).toBeGreaterThan(0);

    // seededMeta spreads the real DEFAULT, so every schema key must be present
    for (const k of ["tags", "pinned", "trashed", "archived", "readLater", "notes", "folderStyles", "dead", "filters", "similarOk", "suggestHidden"]) {
      expect(meta).toHaveProperty(k);
    }

    // the seeded www/non-www pair must be flagged as a duplicate, and the
    // seeded dead URL must be marked dead
    expect(all.some((b) => b.dupeOf != null)).toBe(true);
    expect(all.some((b) => b.dead)).toBe(true);
  });
});
