export const meta = {
  name: 'v2-design-fix',
  description: 'Apply the 49 verified design-audit tasks in dependency waves with gates, then re-audit and fix residuals until dry',
  phases: [
    { title: 'Foundation', detail: 'SYS-01 then SYS-02 (theme scope, dead shell CSS)' },
    { title: 'Shared parts', detail: 'system tasks in parallel lanes' },
    { title: 'Modules', detail: 'module tasks in 13 file-cohesive lanes' },
    { title: 'Final sweep', detail: 'FINAL-01 type sweep' },
    { title: 'Gate', detail: 'typecheck, lint, tests, overflow audit, commit after each wave' },
    { title: 'Re-audit', detail: 'area reviewers check acceptance + fresh-eyes regressions' },
    { title: 'Residuals', detail: 'fix what the re-audit found, loop until dry' },
  ],
}

const S = args && args.kit ? args.kit : '/tmp/audit-kit' // the redesign-audit-kit checkout (tools/, tasks/, mockups/)
const ROUTES = '/ /swim-school /duty /schedule /students /students/parents /students/parent-changes /courses /assessments /assessments/setup /assessments/awaiting-enrolment /awaiting-enrolment /legend-agreements /programmes /together /cancellations /analytics /analytics/instructors /analytics/reception /instructor /instructor/swimmers /refunds /refunds/new /docs /docs/library /docs/work /docs/reports /docs/admin /docs/documents/new /training /training/sign-off /training/expiring /training/certificates /training/courses /hr /hr/activity /rota/overview /rota /rota/day /rota/today /rota/bookings /rota/absences /core /staff /staff/details-requests /staff/devices /staff/organisation /roles /clubs /activity /account /help, plus every record route in sandbox-ids.txt, plus /sign-in signed out'

const COMMON = `
You are fixing Turnfin (the repo checkout (the current working directory's Swimly project), git branch "redesign") so every screen fits the owner-approved "Poolside Clear v2" direction and the app is ready to use and sell. Work carefully and completely; this is production work, not a sketch.

Sources of truth: DESIGN.md ("Poolside Clear v2 system rules" and the frame description), src/app/docs/poolside.css, and the approved mockups at http://127.0.0.1:4300/preview/<Name>.html (V2System is the component sheet; V2*, SS*, Deck*, RF*, DC*, TR*, HR*, RO*, AD*, AU*, HP*, Me* are pages; "-menu" variants show the open account menu). AGENTS.md rules apply (named permissions, audit rows, metadata-fed tags, import boundaries enforced by npm run lint, Work vs Me separation, Instructor isolation).

Live check: the local sandbox at http://localhost:3100 (in-memory fictional data; Next dev with hot reload, so your edits show on reload). Accounts (password sandbox-turnfin-2026): alex@sandbox.invalid (superadmin), maya@ (duty manager), ava@ (instructor), liam@, noah@, riley@sandbox.invalid. Test record routes are listed in ${S}/sandbox-ids.txt (rediscover with cdp-links.mjs if one 404s).
Tools (Git Bash): cd "${S}/tools" && node cdp-shoot.mjs <outDir> <email> <password> "/path@375@dark" "/path@768@light" "/path@1024@dark" "/path@1280@light" — signs in, saves full-page PNGs, prints {over, clipped, small} checks. Mockups: BASE=http://127.0.0.1:4300 with email/password "" "" and paths like /preview/RFDetail.html@1280@light. Links: node "${S}/tools/cdp-links.mjs" x <email> <password> /path. Read PNGs with the Read tool; crop/zoom with python PIL for detail. Use outDir ${S}/shots/fix/<your-label>. Test record routes: the sandbox restarts empty, so discover ids with cdp-links.mjs (see ${S}/README.md).

HARD RULES (other agents are editing this same working tree at the same time):
- Edit existing repo files ONLY with the Edit tool (targeted string replacements). Never rewrite an existing file with Write, python, sed, or any script, because that would erase other agents' concurrent edits. If an Edit fails because the file changed since you read it, Read it again and redo the edit. Write is fine for brand-new files. Deleting a file is fine when your task says so (git rm or rm) — first grep that nothing else imports it.
- Do NOT run git commit, checkout, stash, reset, restore, rebase or push. A gate agent commits after each wave.
- Do NOT edit prisma schemas or migrations, run seeds, or touch any database other than browsing the local sandbox. Do not start or stop the sandbox or other servers on ports 3100/4300.
- While you work, npm run typecheck / lint may show errors in files other agents are editing. Fix every error in files your task touches; ignore transient errors elsewhere (the gate reconciles). Run: npx tsc --noEmit -p . ; npx eslint <your files>.
- Keep docs that describe what you change accurate (DESIGN.md sections your task names, docs/*.md) using Edit.
- Prefer removing a concept or reusing a shared part over adding a new one. No hard-coded colours or sizes; use tokens. Status colour only through metadata maps with icons. Sentence case. 44px targets. Both themes. 375/768/1024/1280 with no overflow, clipping or hidden-in-scroll content.
- Before finishing, verify visually: screenshot the acceptance routes (live) at the widths/themes the brief names and compare with the mockup; fix what does not match. Report honestly what you verified and anything left open.`

const FIX = {
  type: 'object',
  properties: {
    ids: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    filesChanged: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    verification: { type: 'string' },
    openIssues: { type: 'string' },
  },
  required: ['ids', 'status', 'filesChanged', 'summary', 'verification', 'openIssues'],
}

const GATE = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    commit: { type: 'string' },
    fixes: { type: 'string' },
    remaining: { type: 'string' },
  },
  required: ['passed', 'commit', 'fixes', 'remaining'],
}

const ISSUES = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          screen: { type: 'string' },
          element: { type: 'string' },
          observed: { type: 'string' },
          expected: { type: 'string' },
          fix: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'string' },
        },
        required: ['severity', 'screen', 'element', 'observed', 'expected', 'fix', 'files', 'evidence'],
      },
    },
    passedTasks: { type: 'array', items: { type: 'string' } },
    coverage: { type: 'string' },
  },
  required: ['issues', 'passedTasks', 'coverage'],
}

const done = []
const fixTask = (id, ph) => agent(`${COMMON}

YOUR TASK: ${id}. Read the full brief at ${S}/tasks/${id}.md (problem, original change, the amendments from verification which take precedence, acceptance, verification notes). Earlier waves already completed these tasks, which may have changed shared parts you build on (read their briefs in ${S}/tasks/ if you need their API): ${done.join(', ') || 'none yet'}. If the brief's line numbers or details no longer match the code because of those earlier tasks, follow the brief's intent against the current code. Implement the whole task, update the docs it names, verify, and report.`, { label: `fix:${id}`, phase: ph, schema: FIX })

const runLane = async (lane, ph) => {
  const out = []
  for (const id of lane) {
    const r = await fixTask(id, ph)
    out.push(r || { ids: [id], status: 'blocked', filesChanged: [], summary: 'agent returned nothing', verification: '', openIssues: 'no result' })
  }
  return out
}

const gate = async (name, results) => {
  const report = results.filter(Boolean).map((r) => `${r.ids.join('+')} [${r.status}] ${r.summary}\nOPEN: ${r.openIssues}`).join('\n\n')
  const g = await agent(`${COMMON}

You are the GATE for the wave "${name}". All other agents of this wave have finished; you are alone in the tree now, so the Edit-only rule is relaxed for you (still never rewrite files carelessly). Reports from this wave:
${report}

Do, in order:
1. npm run typecheck && npm run lint && npm test. Also cd apps/me && npm run typecheck && npm run lint. Fix every failure with the smallest change that keeps the intent of the wave's tasks (read the relevant briefs in ${S}/tasks/). Re-run until all pass.
2. Check the sandbox still serves (curl http://localhost:3100/sign-in). Screenshot these routes at 375 dark and 1280 light as alex: ${ROUTES}. Any page that errors, shows {over:true}, clipped bars, or an obvious visual break introduced by this wave must be fixed now (look at the PNGs, at least the ones the wave touched).
3. Commit everything: git add -A && git -c user.name="Fernando Serina" -c user.email="fernandomiguelserina@gmail.com" commit -m "Redesign audit: ${name}" -m "<one line per task id with what changed>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Do not push.
Report passed=true only if typecheck, lint and tests all pass and the commit succeeded; put the short commit hash in commit.`, { label: `gate:${name}`, phase: 'Gate', schema: GATE })
  log(`Gate ${name}: ${g ? (g.passed ? 'passed ' + g.commit : 'FAILED — ' + g.remaining) : 'no result'}`)
  return g
}

const all = []

phase('Foundation')
for (const id of ['SYS-01', 'SYS-02']) {
  const r = await fixTask(id, 'Foundation')
  all.push(r)
  done.push(id)
}
await gate('foundation (SYS-01, SYS-02)', all.slice(-2))

phase('Shared parts')
const W2 = [['SYS-03'], ['SYS-04'], ['SYS-05'], ['SYS-06'], ['SYS-07'], ['SYS-08'], ['SYS-09'], ['SYS-10'], ['SYS-11'], ['SYS-12'], ['SYS-13'], ['SYS-14', 'SYS-15'], ['SYS-16', 'SYS-17']]
const w2 = (await parallel(W2.map((lane) => () => runLane(lane, 'Shared parts')))).filter(Boolean).flat()
all.push(...w2)
done.push(...W2.flat())
await gate('shared parts (SYS-03 to SYS-17)', w2)

phase('Modules')
const W3 = [
  ['HOME-01', 'TL-01', 'RO-01', 'RO-02'],
  ['DC-01', 'DC-02', 'DC-03'],
  ['SS-04', 'SS-05'],
  ['RF-01', 'RF-02'],
  ['DK-01', 'DK-02'],
  ['ME-01', 'ME-02', 'ME-03'],
  ['HP-01', 'HP-02'],
  ['AD-01', 'AD-02'],
  ['SS-01', 'SS-02', 'SS-03'],
  ['SS-06', 'SS-07', 'SS-08'],
  ['SS-09', 'SS-10'],
  ['TR-01', 'HR-01'],
  ['AU-01'],
]
const w3 = (await parallel(W3.map((lane) => () => runLane(lane, 'Modules')))).filter(Boolean).flat()
all.push(...w3)
done.push(...W3.flat())
await gate('modules', w3)

phase('Final sweep')
const fin = await fixTask('FINAL-01', 'Final sweep')
all.push(fin)
done.push('FINAL-01')
await gate('final type sweep (FINAL-01)', [fin])

const AREAS = [
  { key: 'frame-primitives', ids: ['SYS-01', 'SYS-02', 'SYS-03', 'SYS-04', 'SYS-05', 'SYS-06', 'SYS-07', 'SYS-08', 'SYS-09', 'SYS-10', 'SYS-11', 'SYS-12', 'SYS-13', 'SYS-14', 'SYS-15', 'SYS-16', 'SYS-17', 'FINAL-01'], scope: 'the frame, navigation, account menu, every shared component and overlay (open dialogs/menus where the code shows them), states, type, tags, notices, forms — across many screens' },
  { key: 'home-rota', ids: ['HOME-01', 'TL-01', 'RO-01', 'RO-02'], scope: 'home as every role account, module overviews, the timeline, all Rota pages' },
  { key: 'swim-school', ids: ['SS-01', 'SS-02', 'SS-03', 'SS-04', 'SS-05', 'SS-06', 'SS-07', 'SS-08', 'SS-09', 'SS-10'], scope: 'every swim school desk page and record page' },
  { key: 'deck', ids: ['DK-01', 'DK-02'], scope: 'the pool deck as ava and alex, including the started class steps' },
  { key: 'refunds-docs', ids: ['RF-01', 'RF-02', 'DC-01', 'DC-02', 'DC-03'], scope: 'Refunds and Docs, including record pages and the editor' },
  { key: 'training-hr-admin', ids: ['TR-01', 'HR-01', 'AD-01', 'AD-02'], scope: 'Training, HR, Admin and the account page' },
  { key: 'auth-help-me', ids: ['AU-01', 'HP-01', 'HP-02', 'ME-01', 'ME-02', 'ME-03'], scope: 'sign-in, switch, confirm, Help (index, articles, instructor help) and Turnfin Me (code vs Me* mockups)' },
  { key: 'fresh-eyes', ids: [], scope: 'the WHOLE app with fresh eyes: walk every route as alex and as maya/ava, both themes, all four widths, and compare each with its mockup; report anything that still does not fit the direction or that looks unfinished, inconsistent or broken (including regressions introduced by the fixes)' },
]

let round = 0
let pending = AREAS
while (pending.length && round < 3) {
  round++
  phase('Re-audit')
  const reviews = await parallel(pending.map((a) => () => agent(`${COMMON}

You are a RE-AUDITOR (round ${round}). This is review only: do NOT edit repo files. Area: ${a.scope}.
${a.ids.length ? `These tasks were implemented; read their briefs in ${S}/tasks/ and check each task's acceptance criteria live (screenshots at the named widths/themes) and in code: ${a.ids.join(', ')}. List the ids that fully pass in passedTasks.` : 'There are no task briefs for you; judge every screen against DESIGN.md v2 and the mockups.'}
Then look for anything else in your area that does not fit Poolside Clear v2 or looks unfinished: typography, components, shapes, colour/contrast, layout/spacing, copy, states, responsive, dark mode, accessibility, and regressions. Every issue needs evidence (screenshot path and/or path:line) and a concrete fix with the files to change. Be strict: the bar is a product ready to sell. Do not report things that already match the direction.`, { label: `reaudit:${a.key}:r${round}`, phase: 'Re-audit', schema: ISSUES }).then((r) => (r ? { area: a, ...r } : null))))
  const withIssues = reviews.filter(Boolean).filter((r) => r.issues.length)
  const count = withIssues.reduce((n, r) => n + r.issues.length, 0)
  log(`Re-audit round ${round}: ${count} issues in ${withIssues.length} areas`)
  if (!count) break
  phase('Residuals')
  const fixes = await parallel(withIssues.map((r) => () => agent(`${COMMON}

YOUR TASK: fix these residual issues found by the round-${round} re-audit in the area "${r.area.scope}". Other residual fixers are working on other areas at the same time (Edit-only rule applies). Fix every issue (high, medium and low); if one is wrong on inspection, say why in openIssues instead of changing it.
${r.issues.map((x, i) => `${i + 1}. [${x.severity}] ${x.screen} :: ${x.element}\n   OBSERVED: ${x.observed}\n   EXPECTED: ${x.expected}\n   FIX: ${x.fix}\n   FILES: ${x.files.join(', ')}\n   EVIDENCE: ${x.evidence}`).join('\n')}
Verify each fix live and report.`, { label: `residual:${r.area.key}:r${round}`, phase: 'Residuals', schema: FIX })))
  all.push(...fixes.filter(Boolean))
  await gate(`re-audit round ${round} residuals`, fixes)
  pending = withIssues.map((r) => r.area)
}
if (pending.length && round >= 3) log(`Stopped after ${round} re-audit rounds; areas that still had issues in the last round: ${pending.map((a) => a.key).join(', ')}`)

return {
  tasks: all.filter(Boolean).map((r) => ({ ids: r.ids, status: r.status, summary: r.summary, open: r.openIssues })),
  rounds: round,
}
