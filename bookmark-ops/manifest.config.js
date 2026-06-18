import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "bookmark.ops",
  version: "0.1.0",
  description: "Keyboard-first bookmark search + cleanup. ⌘/Ctrl+Shift+K for the command palette.",
  action: {
    default_popup: "popup.html",
    default_title: "bookmark.ops command palette",
  },
  chrome_url_overrides: {
    newtab: "newtab.html",
  },
  background: {
    service_worker: "src/background/service-worker.js",
    type: "module",
  },
  permissions: ["bookmarks", "history", "storage", "tabs", "favicon"],
  // host permissions are only needed for best-effort dead-link scanning.
  host_permissions: ["<all_urls>"],
  commands: {
    _execute_action: {
      suggested_key: { default: "Ctrl+Shift+K", mac: "Command+Shift+K" },
      description: "Open the command palette",
    },
    "open-dashboard": {
      suggested_key: { default: "Ctrl+Shift+B", mac: "Command+Shift+B" },
      description: "Open the bookmark dashboard",
    },
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
});
