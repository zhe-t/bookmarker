import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.js";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  // CRXJS needs a stable HMR port during dev
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
  build: { target: "es2022", sourcemap: false },
});
