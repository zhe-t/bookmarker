# bookmark.ops — Chrome extension (MV3)

Keyboard-first bookmark **search** + **cleanup**, wired to your real Chrome bookmarks.
Press **Ctrl/⌘ + Shift + K** anywhere to open the command palette; the New Tab page is the full dashboard.

![bookmark.ops — search and cleanup demo](docs/demo.gif)

## Quick start

```bash
npm install
npm run build      # outputs dist/
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `dist/` folder.

For live development with HMR:

```bash
npm run dev        # then Load unpacked the generated dist/ once
```

### Try the UI without installing

The whole interface is plain React, so you can run it as an ordinary web page —
no extension install, no real bookmarks touched. A small harness mocks the
`chrome.*` APIs with seeded sample data (the same setup used to record the demo
above):

```bash
npm run demo       # opens the dashboard at http://localhost:5174/demo/
```

## Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + Shift + K` | Open the command palette (the toolbar popup) |
| `Ctrl/⌘ + Shift + B` | Open the dashboard (New Tab) |
| `⌘K` (inside the dashboard) | In-page palette |
| `⌘1` / `⌘2` | Search / Cleanup mode |

Rebind any of these at `chrome://extensions/shortcuts`. Chrome allows ~4 suggested
shortcuts and they only fire while Chrome is focused (not OS-global).

## How the data maps to Chrome

Chrome bookmarks have **no tags, no visit counts, and no dead/stale flags**, so:

- **Tags / archive / trash / saved filters** live in `chrome.storage.local` (`src/lib/store.js`), merged onto bookmarks at read time.
- **Visit count + last-visited** come from the `chrome.history` API (best-effort proxy for frequency/recency ranking).
- **Duplicates** are detected by identical URL.
- **Dead links**: scanned from the service worker with `fetch(..., {mode:'no-cors'})`. Because no-cors responses are opaque, this reliably catches only *network-level* failures (DNS / connection refused) — **not HTTP 404s**. This is an inherent browser limitation; the UI labels it "reachability" honestly. For true status codes you'd need a backend proxy.
- **Delete is soft** (moves to a Trash list in storage); "Empty Trash" calls `chrome.bookmarks.remove` for real. Move/import use real `chrome.bookmarks.move` / `create`.

## Files

```
manifest.config.js          MV3 manifest (commands, newtab override, popup, favicon)
vite.config.js              Vite + @crxjs/vite-plugin + React
newtab.html / popup.html    entry points
public/fonts/               vendored woff2 (Bricolage Grotesque, IBM Plex Mono/Sans)
src/lib/model.js            pure helpers (fuzzy, operators, issues, health, rank)
src/lib/store.js            chrome.storage.local metadata
src/lib/bookmarks.js        chrome.bookmarks + chrome.history loader & mutations
src/background/             service worker: commands + dead-link scan
src/newtab/App.jsx          full dashboard (search + cleanup + bulk + palette)
src/newtab/Palette.jsx      shared command palette
src/newtab/BookmarkModal.jsx guided add/edit bookmark form
src/newtab/ContextMenu.jsx  right-click menu (rename, edit URL, share, delete)
src/newtab/HelpModal.jsx    shortcuts + search-operator reference
src/popup/main.jsx          palette as the toolbar popup
src/ui/icons.jsx            SVG icon set (1.6px stroke, 16×16 grid)
src/ui/Favicon.jsx          real favicons via Chrome's _favicon API + initial fallback
src/ui/hooks.js             useClickAway, useScrollHint
src/styles.css              design system: tokens, light/dark themes, components
demo/                       mock-chrome harness for running the UI standalone
test/                       unit tests (Vitest)
```

## Development

```bash
npm run dev        # extension build with HMR
npm run demo       # standalone UI with mocked chrome.* + seed data
npm test           # unit tests (Vitest) for src/lib
npm run lint       # ESLint
npm run format     # Prettier (writes changes)
npm run build      # production extension build → dist/
```

The pure logic in `src/lib/model.js` is covered by tests in `test/`. CI runs
lint, tests, and the build on every pull request. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## Fonts / CSP

MV3 forbids remote CSS/font `@import` on extension pages, so the typefaces
(Bricolage Grotesque for display, IBM Plex Mono / IBM Plex Sans for UI) are
vendored as `.woff2` in `public/fonts/` and loaded via `@font-face` — no remote
requests, ~230 KB total.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)
and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
