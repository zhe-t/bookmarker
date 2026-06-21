export const meta = {
  name: 'implement-optimizations-split',
  description: 'Planner/executor split: Opus writes an exact edit spec per issue, a cheaper model applies it (test-gated, atomic commit)',
  whenToUse: 'When you want Opus reasoning quality but cheap-model execution cost for implementing the optimization backlog',
  phases: [
    { title: 'Plan', detail: 'Opus reads the issue + current code and emits an exact, mechanical edit spec (read-only)', model: 'opus' },
    { title: 'Execute', detail: 'a cheaper model applies the spec verbatim, gates on test+lint, commits atomically' },
  ],
}

// args: array of issue ids, OR { ids:[...], planModel, execModel, execEffort }.
// Sequential per issue (shared working tree + inter-issue dependencies): each
// PLAN sees the prior issues already committed, so specs target the real current
// code. PLAN is read-only Opus; EXECUTE is a cheaper model that just applies the
// spec and runs the gate. A clean HEAD between issues makes revert-on-fail safe.

let parsedArgs = args
if (typeof parsedArgs === 'string') {
  try { parsedArgs = JSON.parse(parsedArgs) } catch { parsedArgs = parsedArgs.split(/[\s,]+/).filter(Boolean) }
}
const ids = Array.isArray(parsedArgs) ? parsedArgs : (parsedArgs?.ids || parsedArgs?.issues || [])
const PLAN_MODEL = (Array.isArray(parsedArgs) ? null : parsedArgs?.planModel) || 'opus'
const EXEC_MODEL = (Array.isArray(parsedArgs) ? null : parsedArgs?.execModel) || 'sonnet'
const EXEC_EFFORT = (Array.isArray(parsedArgs) ? null : parsedArgs?.execEffort) || 'low'

if (!ids.length) {
  log('No issue ids passed via args — nothing to do.')
  return { error: 'no issues provided', implemented: 0 }
}

const TRAILER = 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'

const SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'feasible', 'edits', 'newFiles', 'commands', 'commitTitle', 'commitBody'],
  properties: {
    id: { type: 'string' },
    feasible: { type: 'boolean', description: 'false if the issue is already satisfied by current code or cannot be done as a minimal stability change' },
    reason: { type: 'string', description: 'when feasible=false, why' },
    edits: {
      type: 'array',
      description: 'in-place edits to existing files',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'find', 'replace'],
        properties: {
          file: { type: 'string' },
          find: { type: 'string', description: 'verbatim current text, with enough surrounding context to be UNIQUE in the file' },
          replace: { type: 'string', description: 'exact replacement text' },
        },
      },
    },
    newFiles: {
      type: 'array',
      description: 'whole new files to create (e.g. a new test file)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'contents'],
        properties: { path: { type: 'string' }, contents: { type: 'string' } },
      },
    },
    commands: { type: 'array', items: { type: 'string' }, description: 'gate commands to run, e.g. ["npm test","npm run lint"]' },
    commitTitle: { type: 'string' },
    commitBody: { type: 'string' },
    notes: { type: 'string' },
  },
}

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'status', 'summary', 'filesChanged'],
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['committed', 'skipped', 'failed'] },
    commit: { type: ['string', 'null'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
}

const results = []
for (let i = 0; i < ids.length; i++) {
  const id = typeof ids[i] === 'string' ? ids[i] : ids[i].id

  // --- PLAN (Opus, read-only) ---------------------------------------------
  const spec = await agent(
    `You are the PLANNER for one optimization in the bookmark.ops Chrome extension. Produce an EXACT, mechanical edit spec that a junior model can apply with ZERO judgment. DO NOT modify any file.\n\n` +
      `ISSUE: ${id}. Read its full entry from docs/optimization-issues.json (JSON array; match "id"). Treat its problem/proposed_change/test_plan as the goal.\n\n` +
      `Then READ the actual current source files it touches (they may already differ from the spec because earlier issues were applied). Produce:\n` +
      `- edits[]: for each change to an existing file, a "find" string copied VERBATIM from the current file with enough context to be unique, and the exact "replace" string. Preserve surrounding code style/indentation exactly.\n` +
      `- newFiles[]: any brand-new files (e.g. a new test file) with full contents.\n` +
      `- commands[]: the gate to run — always include "npm test" and "npm run lint"; add "npm run build" only if build/manifest config changed.\n` +
      `- commitTitle ("${id}: <concise title>") and a 1-2 line commitBody.\n\n` +
      `RULES: minimal change only; no behavior change beyond the issue; never weaken/delete existing tests. If current code already satisfies the issue (an earlier issue subsumed it) or it can't be done as a minimal stability change, set feasible=false with a reason and leave edits/newFiles empty.\n\n` +
      `Return the structured spec. Accuracy of every "find" string is critical — it must match the file byte-for-byte.`,
    { label: `plan:${id}`, phase: 'Plan', schema: SPEC_SCHEMA, model: PLAN_MODEL, effort: 'high' }
  )

  if (!spec || spec.feasible === false) {
    const res = { id, status: 'skipped', summary: spec?.reason || 'planner deemed infeasible / no spec', filesChanged: [], notes: spec?.reason || '' }
    results.push(res)
    log(`${id}: skipped (plan) — ${res.summary}`)
    continue
  }

  // --- EXECUTE (cheap model) ----------------------------------------------
  const res = await agent(
    `You are the EXECUTOR. Apply the following edit spec for ${id} to the bookmark.ops repo EXACTLY as given. The working tree is clean at HEAD.\n\n` +
      `SPEC (JSON):\n${JSON.stringify({ edits: spec.edits, newFiles: spec.newFiles, commands: spec.commands, commitTitle: spec.commitTitle, commitBody: spec.commitBody }, null, 2)}\n\n` +
      `STEPS:\n` +
      `1. For each entry in edits[], use the Edit tool with the given find->replace. For each newFiles[] entry, use Write with the given contents. Do not invent other changes.\n` +
      `2. Run every command in commands[]. \n` +
      `3. If ALL commands pass: git add -A && git commit -m "${spec.commitTitle}" -m "${spec.commitBody || ''}" -m "${TRAILER}", then capture \`git rev-parse --short HEAD\` and return status="committed" with that hash.\n` +
      `4. If a "find" string does not match, or a command fails: you may make AT MOST one small corrective fix strictly within the spec's intent (e.g. fix a stale find anchor). If it still fails, FULLY REVERT for a clean next step and return status="skipped" with the reason:\n` +
      `   git restore --staged . ; git checkout -- . ; git clean -fd src/ test/\n\n` +
      `INVARIANTS: apply ONLY what the spec describes; never touch unrelated files; never weaken tests; never push; never leave the tree dirty. Return the structured result.`,
    { label: id, phase: 'Execute', schema: RESULT_SCHEMA, model: EXEC_MODEL, effort: EXEC_EFFORT }
  )

  const out = res || { id, status: 'failed', summary: 'executor returned no result', filesChanged: [] }
  results.push(out)
  log(`${id}: ${out.status}${out.commit ? ' (' + out.commit + ')' : ''} — ${out.summary || ''}`)
}

const committed = results.filter((r) => r.status === 'committed').length
const skipped = results.filter((r) => r.status === 'skipped').length
const failed = results.filter((r) => r.status === 'failed').length
log(`Done: ${committed} committed, ${skipped} skipped, ${failed} failed of ${ids.length}`)

return { total: ids.length, committed, skipped, failed, planModel: PLAN_MODEL, execModel: EXEC_MODEL, results }
