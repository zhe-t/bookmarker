export const meta = {
  name: 'implement-optimizations',
  description: 'Iterate the optimization backlog and implement each issue as a minimal, test-gated, atomically-committed change',
  whenToUse: 'After research-optimizations has produced an issue backlog; pass the issues array as args',
  phases: [
    { title: 'Implement', detail: 'sequentially implement, test-gate (test+lint+build), and commit each issue' },
  ],
}

// args = ordered array of issue IDs (e.g. ["OPT-001", ...]) OR full issue
// objects. Each agent reads the canonical issue detail from
// docs/optimization-issues.json (committed) by id, so args can stay small.
// Runs SEQUENTIALLY on purpose: every agent shares the one working tree and many
// issues touch the same files (App.jsx etc.), so parallelism would corrupt the
// tree. Each issue is implemented, gated on `npm test` + `npm run lint`, and
// committed atomically — a clean tree at the start of each step makes revert safe.

let parsedArgs = args
if (typeof parsedArgs === 'string') {
  try { parsedArgs = JSON.parse(parsedArgs) } catch { parsedArgs = parsedArgs.split(/[\s,]+/).filter(Boolean) }
}
const issues = Array.isArray(parsedArgs) ? parsedArgs : (parsedArgs?.issues || parsedArgs?.ids || [])
if (!issues.length) {
  log('No issue ids passed via args — nothing to do.')
  return { error: 'no issues provided', implemented: 0 }
}

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'status', 'summary', 'filesChanged', 'testsAddedOrChanged'],
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['committed', 'skipped', 'failed'] },
    commit: { type: ['string', 'null'], description: 'commit hash if committed, else null' },
    summary: { type: 'string', description: 'one-line description of what was done or why skipped' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsAddedOrChanged: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
}

const TRAILER = 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'

phase('Implement')

const results = []
for (let i = 0; i < issues.length; i++) {
  const entry = issues[i]
  const id = typeof entry === 'string' ? entry : (entry.id || `OPT-${String(i + 1).padStart(3, '0')}`)
  const inlineDetail = typeof entry === 'string' ? null : entry

  const r = await agent(
    `You are implementing EXACTLY ONE optimization in the bookmark.ops Chrome extension repo. The working tree is clean at git HEAD.\n\n` +
      `ISSUE: ${id}\n` +
      (inlineDetail
        ? `Details (JSON):\n${JSON.stringify(inlineDetail, null, 2)}\n\n`
        : `Read the full issue spec from docs/optimization-issues.json (it is a JSON array; find the object whose "id" === "${id}"). Use its problem, proposed_change, and test_plan as your authoritative instructions.\n\n`) +
      `HARD RULES:\n` +
      `- Make the MINIMAL change that resolves this single issue. Do NOT change product behavior or add features beyond the issue. Do NOT touch unrelated files.\n` +
      `- Match the surrounding code style exactly (concise, comment density of neighbors).\n` +
      `- If the issue is testable as pure logic, add or adjust a focused unit test under test/ that proves it. NEVER weaken or delete existing tests to make things pass.\n` +
      `- For UI-only changes where a unit test is impractical, say so in notes and rely on lint+build.\n\n` +
      `PROCEDURE (run these yourself with Bash):\n` +
      `1. Implement the change.\n` +
      `2. Run \`npm test\` and \`npm run lint\`. If you changed build/manifest config, also run \`npm run build\`.\n` +
      `3. If ALL pass: stage and commit atomically, then return status="committed" with the short commit hash:\n` +
      `   git add -A && git commit -m "${id}: <concise title>" -m "<1-2 line body>" -m "${TRAILER}"\n` +
      `   (capture the hash with \`git rev-parse --short HEAD\`)\n` +
      `4. If you cannot make all checks pass within this issue's scope, FULLY REVERT so the tree is clean for the next issue, and return status="skipped" with the reason in notes:\n` +
      `   git restore --staged . ; git checkout -- . ; git clean -fd src/ test/\n\n` +
      `INVARIANTS: never leave the tree dirty; never push; never commit unrelated changes; the next agent depends on a clean HEAD. Return the structured result.`,
    { label: id, phase: 'Implement', schema: RESULT_SCHEMA, effort: 'medium' }
  )

  const res = r || { id, status: 'failed', summary: 'agent returned no result', filesChanged: [], testsAddedOrChanged: [] }
  results.push(res)
  log(`${id}: ${res.status}${res.commit ? ' (' + res.commit + ')' : ''} — ${res.summary || ''}`)
}

const committed = results.filter((r) => r.status === 'committed').length
const skipped = results.filter((r) => r.status === 'skipped').length
const failed = results.filter((r) => r.status === 'failed').length
log(`Done: ${committed} committed, ${skipped} skipped, ${failed} failed of ${issues.length}`)

return { total: issues.length, committed, skipped, failed, results }
