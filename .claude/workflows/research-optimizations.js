export const meta = {
  name: 'research-optimizations',
  description: 'Deep-research the bookmark.ops codebase and produce 50 concise, testable, stability-focused optimization issues',
  whenToUse: 'When you want a prioritized batch of low-risk refinement/hardening/test-coverage issues for this repo',
  phases: [
    { title: 'Investigate', detail: 'parallel finders per module + cross-cutting lenses surface candidate issues' },
    { title: 'Select', detail: 'dedupe, rank, and refine down to the best 50 testable stability issues' },
  ],
}

// bookmark.ops — a keyboard-first bookmark search/cleanup Chrome extension (MV3,
// React 18 + Vite + @crxjs, tested with vitest). Baseline at authoring time:
// 107 tests pass, eslint clean, build clean. The codebase is already high
// quality, so we want REFINEMENTS that confirm/lock current behavior — NOT new
// features or behavior changes.

const ISSUE_FIELDS = `Each issue object MUST have:
- title: short imperative summary
- category: one of bug | edge-case | error-handling | perf | test | simplify | deadcode | a11y | security | consistency
- files: array of repo-relative paths the change touches
- problem: what is wrong/suboptimal today, citing file:line where possible
- proposed_change: the MINIMAL concrete change (no scope creep, no new features)
- test_plan: the exact unit test to add/adjust under test/ that proves it, OR why a unit test is impractical (UI-only) and what lint/build check covers it
- risk: low | medium | high
- effort: S | M | L
- rationale: how this refines/hardens stability WITHOUT changing current product behavior`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'category', 'files', 'problem', 'proposed_change', 'test_plan', 'risk', 'effort', 'rationale'],
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: ['bug', 'edge-case', 'error-handling', 'perf', 'test', 'simplify', 'deadcode', 'a11y', 'security', 'consistency'] },
          files: { type: 'array', items: { type: 'string' } },
          problem: { type: 'string' },
          proposed_change: { type: 'string' },
          test_plan: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          rationale: { type: 'string' },
        },
      },
    },
  },
}

const FINDERS = [
  {
    key: 'lib-core',
    scope: 'src/lib/bookmarks.js, src/lib/model.js, src/lib/store.js',
    focus: 'URL canonicalization correctness (urlKey, hostOf, shortPath), tree-walk edge cases (empty titles, deeply nested folders, missing dateAdded), dedup/grouping logic, chrome.storage read/write error handling, sync conflict resolution + the ~90KB oversize path, and any pure branch currently untested.',
  },
  {
    key: 'app-shell',
    scope: 'src/newtab/App.jsx (1186 lines — the main dashboard)',
    focus: 'React state/effect correctness (stale closures, missing effect cleanup / listener leaks, exhaustive-deps), unnecessary re-renders & memoization gaps, keyboard-handler edge cases, large-library performance (O(n^2) filtering/sorting), and pure helpers buried in the component that should be extracted to src/lib and unit-tested.',
  },
  {
    key: 'components',
    scope: 'src/newtab/{BookmarkModal,Palette,FolderRail,SettingsModal,TourModal,GuideModal,StatsModal,ContextMenu,HelpModal,FolderStyleModal,FeedbackModal}.jsx',
    focus: 'accessibility (focus trap, aria roles/labels, Escape-to-close, restore focus on close), keyboard navigation, duplicated modal/overlay logic that should be shared, prop edge cases (empty/long values), and consistency across the modals.',
  },
  {
    key: 'background-popup',
    scope: 'src/background/service-worker.js, src/popup/main.jsx, manifest.config.js',
    focus: 'MV3 service-worker lifecycle, message-passing races/timeouts, the dead-link scan (batching, error handling, opaque-response honesty, large URL sets), storage KEY duplicated across files, and manifest permission scoping/hardening.',
  },
  {
    key: 'ui-css',
    scope: 'src/ui/hooks.js, src/ui/icons.jsx, src/ui/Favicon.jsx, src/enhancements.css, src/styles.css',
    focus: 'hook correctness (useClickAway / useScrollHint effect deps and observer cleanup), Favicon fallback edge cases, dead/duplicated CSS rules, and small pure logic worth extracting + testing.',
  },
  {
    key: 'x-tests',
    scope: 'src/lib/* together with the existing test/ suite',
    focus: 'TEST-COVERAGE ONLY: identify specific untested pure functions and uncovered branches whose tests would LOCK IN current behavior. Every finding must be category=test with a concrete test_plan; proposed_change should be "add tests, no source change" unless a tiny testability tweak is needed.',
  },
  {
    key: 'x-security',
    scope: 'whole repo (src/**, manifest.config.js)',
    focus: 'SECURITY/HARDENING: dangerouslySetInnerHTML / innerHTML usage, unsafe URL handling or window.open targets, chrome message origin/sender validation, over-broad manifest permissions, and any user-controlled string reaching a sink.',
  },
  {
    key: 'x-consistency',
    scope: 'whole repo (src/**)',
    focus: 'CONSISTENCY / DEAD CODE / SIMPLIFY: duplicated constants (e.g. the storage KEY string in store.js and service-worker.js), unused exports/imports, near-duplicate helpers that should be unified, and shallow code that could be deepened into a tested helper — all without changing behavior.',
  },
]

phase('Investigate')

const finderResults = await parallel(
  FINDERS.map((f) => () =>
    agent(
      `You are auditing the "${f.scope}" slice of the bookmark.ops Chrome extension for STABILITY-IMPROVING optimizations.\n\n` +
        `Focus: ${f.focus}\n\n` +
        `Read the actual files (use Read/Grep). Find 8-15 concrete, HIGH-CONFIDENCE issues. ` +
        `Constraints: every issue must be CONCISE to implement, TESTABLE, and must NOT add features or change product behavior — it must refine, harden, or confirm current behavior. ` +
        `Prefer low/medium risk. Cite file:line in "problem".\n\n${ISSUE_FIELDS}`,
      { label: `find:${f.key}`, phase: 'Investigate', schema: FINDINGS_SCHEMA }
    )
  )
)

const candidates = finderResults.filter(Boolean).flatMap((r) => r.issues || [])

// Dedupe by normalized title + primary file before the expensive select pass.
const seen = new Set()
const deduped = []
for (const c of candidates) {
  const key = (c.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + '|' + (c.files?.[0] || '')
  if (seen.has(key)) continue
  seen.add(key)
  deduped.push(c)
}

log(`Collected ${candidates.length} candidates, ${deduped.length} after dedupe`)

phase('Select')

const FINAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'category', 'files', 'problem', 'proposed_change', 'test_plan', 'risk', 'effort', 'rationale', 'priority'],
        properties: {
          id: { type: 'string', description: 'OPT-001 .. OPT-050, zero-padded' },
          title: { type: 'string' },
          category: { type: 'string', enum: ['bug', 'edge-case', 'error-handling', 'perf', 'test', 'simplify', 'deadcode', 'a11y', 'security', 'consistency'] },
          files: { type: 'array', items: { type: 'string' } },
          problem: { type: 'string' },
          proposed_change: { type: 'string' },
          test_plan: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
          rationale: { type: 'string' },
          priority: { type: 'integer', description: '1 (highest value/lowest risk) .. 50' },
        },
      },
    },
  },
}

const selected = await agent(
  `You are the lead engineer curating an optimization backlog for the bookmark.ops Chrome extension.\n\n` +
    `Here are ${deduped.length} candidate issues found by auditors (JSON):\n\n${JSON.stringify(deduped, null, 2)}\n\n` +
    `Select and refine the BEST 50 (or all of them if fewer than 50 are genuinely worthwhile — never pad with low-value busywork). Selection rules:\n` +
    `1. Each issue must REFINE / HARDEN / CONFIRM current behavior — reject anything that adds a feature or changes product behavior.\n` +
    `2. Each must be CONCISE to implement and TESTABLE (prefer ones provable by a unit test under test/).\n` +
    `3. Favor low/medium risk, high confidence. De-prioritize speculative or high-risk refactors.\n` +
    `4. Merge near-duplicates. Keep proposed_change minimal and specific.\n` +
    `5. Ensure a healthy spread: lock-in test coverage, edge-case + error handling, real correctness bugs, security/hardening, dead-code/consistency, and safe perf wins.\n` +
    `6. Assign ids OPT-001..OPT-050 in priority order, and set priority 1..N (1 = implement first: lowest risk, highest stability value, ideally test-coverage and pure-logic fixes first so later changes are guarded).\n\n` +
    `Return refined issues. Keep every field accurate and self-contained so an implementer can act on it without extra context.`,
  { label: 'select-50', phase: 'Select', schema: FINAL_SCHEMA, effort: 'high' }
)

return { count: selected?.issues?.length || 0, candidates: candidates.length, deduped: deduped.length, issues: selected?.issues || [] }
