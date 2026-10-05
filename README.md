# Redesign audit kit (branch `redesign-audit-kit`)

Working material for finishing the Poolside Clear v2 design audit on the `redesign` branch of Swimly.
This branch is tooling only. It is never merged into the product.

## Contents

- `tasks/<ID>.md`: the 49 verified fix tasks. Each brief holds the problem, the original change, the amendments from verification (these win), acceptance checks and the verifiers' notes.
- `audit-result.json`: the raw result of the audit workflow. It covers 632 findings, 49 kept tasks and the findings dropped at synthesis.
- `mockups/preview/*.html`: the owner-approved mockups, one per page. `V2System` is the component sheet. The `-menu` variants show the open account menu. `mockups/turnfin.png` is the logo they load.
- `tools/cdp-shoot.mjs`: signs in to the sandbox, takes full-page screenshots and prints `{over, clipped, small}` checks.
- `tools/cdp-links.mjs`: lists the links on signed-in pages, for finding record ids.
- `tools/sheet.py`: builds a contact sheet from screenshots.
- `v2-design-fix.js`: the fix workflow (waves, gates, re-audit loop). Pass `args: { kit: "<path to this checkout>" }`.

## Setup in a fresh environment

```bash
# 1. The kit next to the repo
git fetch origin redesign-audit-kit && git worktree add /tmp/audit-kit origin/redesign-audit-kit

# 2. App dependencies and headless Chromium for the tools
cd Swimly && npm ci && npx playwright install chromium

# 3. The sandbox: in-memory PGlite with fictional data, on port 3100
npm run sandbox

# 4. The mockups, on port 4300
python3 -m http.server 4300 --bind 127.0.0.1 --directory /tmp/audit-kit/mockups
```

Sandbox accounts all use the password `sandbox-turnfin-2026`:
- alex@sandbox.invalid: superadmin
- maya@: duty manager
- ava@: instructor
- liam@, noah@, riley@sandbox.invalid

The sandbox restarts empty, so find record ids with:
`node /tmp/audit-kit/tools/cdp-links.mjs x alex@sandbox.invalid sandbox-turnfin-2026 /students /courses /programmes`

Refunds, Docs documents and a started class have to be created through the UI. Use fictional data only.

## Status, 5 October 2026: complete

All 49 tasks are applied, gated and pushed on `redesign` (12 commits after `01f9aa2`), plus one re-audit round and its fixes (`reaudit/*.md`). The earlier `dc7c374`/`d126fa5` were lost with the old machine and everything was redone. Open owner decisions are listed in the final recap: Rota Absences scope, viewer job titles, "shift" vs "duty", tables as rows on phones, the Account pill, Rota Today's timeline. Cloud helpers: `AGENT-BRIEF.md`, `LANE-BRIEF.md`, `REAUDIT-BRIEF.md`, `RESIDUAL-BRIEF.md`, `gate.sh`, `peek.py`, `tools/seed-ui.mjs` (fills the sandbox with fictional refunds, documents and a started class).

## Status when the work moved to the cloud (4 October 2026)

**Done:**
- Wave 1, foundation (SYS-01, SYS-02): gated and committed, `dc7c374`.
- Wave 2, shared parts: SYS-04 finished.

**Interrupted:** SYS-03 and SYS-05 to SYS-17. Their partial edits were committed as an ungated work-in-progress checkpoint. Re-run each of those tasks: the agent reads the current code, finishes what's missing and keeps what's already right. Then run the wave 2 gate.

**Still to do:**
1. Wave 3, modules, in 13 lanes. See `W3` in `v2-design-fix.js`.
2. FINAL-01.
3. The re-audit and residual loop, up to three rounds.

To resume with the script, edit `v2-design-fix.js`:
- skip the Foundation phase;
- put `SYS-01`, `SYS-02` and `SYS-04` in `done`;
- drop SYS-04 from W2.

## Rules the agents follow

These are also written in the script.
- Edit only with the Edit tool, because agents share one working tree.
- No git commits except by the gates.
- No prisma or database changes, and no servers started or stopped by agents.
- Verify live against the sandbox, both themes, at 375, 768, 1024 and 1280.
