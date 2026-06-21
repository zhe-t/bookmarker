import { describe, it, expect } from "vitest";
import manifest from "../manifest.config.js";

describe("manifest.config.js", () => {
  it("uses manifest_version 3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("background type is module (required for ES imports)", () => {
    expect(manifest.background.type).toBe("module");
  });

  it("background service_worker path is correct", () => {
    expect(manifest.background.service_worker).toBe(
      "src/background/service-worker.js"
    );
  });

  it("includes required permissions: storage, bookmarks, tabs", () => {
    expect(manifest.permissions).toContain("storage");
    expect(manifest.permissions).toContain("bookmarks");
    expect(manifest.permissions).toContain("tabs");
  });

  it("CSP extension_pages contains script-src 'self'", () => {
    expect(manifest.content_security_policy.extension_pages).toContain(
      "script-src 'self'"
    );
  });
});
