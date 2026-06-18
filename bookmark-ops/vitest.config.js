import { defineConfig } from "vitest/config";

// Standalone test config so the test run does not load the @crxjs extension
// build pipeline (manifest generation, HMR, etc.) from vite.config.js.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.{js,jsx}"],
  },
});
