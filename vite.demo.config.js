import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone build of the UI with a mocked chrome.* layer (demo/mock-chrome.js).
// Lets the dashboard run as an ordinary web page — no extension install, no real
// bookmarks touched. `publicDir` stays the project default ("public") so the
// vendored /fonts resolve exactly as they do in the extension.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true, open: "/demo/" },
  build: {
    outDir: "demo-dist",
    emptyOutDir: true,
    rollupOptions: { input: "demo/index.html" },
  },
});
