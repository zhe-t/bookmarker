# Contributing to bookmark.ops

Thanks for taking the time to contribute! This document covers how to get the
extension running locally, the project layout, and what we expect in a pull
request.

## Getting started

You need [Node.js](https://nodejs.org) 20+ and npm (the test runner, Vitest 4, requires Node 20+).

```bash
npm install
npm run build      # outputs dist/
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select the generated `dist/` folder

For live development with hot-module reload:

```bash
npm run dev        # then Load unpacked the generated dist/ once
```

### Running the UI without Chrome

The whole UI is plain React. You can run it in an ordinary browser tab — no
extension install, no real bookmarks touched — via the demo harness, which
mocks the `chrome.*` APIs with seeded sample data:

```bash
npm run demo       # serves the dashboard at http://localhost:5174/demo/
```

This is the fastest way to iterate on UI work and is how the README demo GIF is
generated.

## Project layout

```
manifest.config.js          MV3 manifest (commands, newtab override, popup)
vite.config.js              Vite + @crxjs/vite-plugin + React (extension build)
vite.demo.config.js         plain SPA build of the mock-chrome demo harness
src/lib/                    pure helpers + chrome.bookmarks/history/storage access
src/background/             service worker: commands + dead-link scan
src/newtab/                 the full dashboard (App.jsx) + modals
src/popup/                  the toolbar popup (command palette)
src/ui/                     shared icons, Favicon, hooks
demo/                       mock-chrome harness for running the UI standalone
test/                       unit tests (Vitest)
```

See the README for how the data model maps onto Chrome's bookmark/history APIs.

## Development workflow

```bash
npm test           # run unit tests (Vitest)
npm run lint       # ESLint
npm run build      # production build, must succeed
```

CI runs lint, tests, and the build on every pull request, so please run them
locally first.

### Code style

- The codebase is JavaScript (ESM) + React function components.
- Pure logic lives in `src/lib/` and should stay dependency-free and testable —
  if you add or change anything there, add or update a test in `test/`.
- Match the surrounding style: it favors compact, dense one-liners. ESLint
  enforces correctness; there is intentionally **no autoformatter**, so mirror
  the formatting of nearby code by hand.

## Submitting a pull request

1. Fork and create a feature branch.
2. Keep changes focused; one logical change per PR.
3. Make sure `npm run lint`, `npm test`, and `npm run build` all pass.
4. Describe what changed and why. Screenshots/GIFs are welcome for UI changes.

## Reporting bugs and requesting features

Use the GitHub issue templates. For bugs, include your Chrome version, steps to
reproduce, and what you expected to happen.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
