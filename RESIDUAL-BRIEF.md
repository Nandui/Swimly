# Residual fix brief (re-audit round 1)

Read /home/user/audit-kit/AGENT-BRIEF.md and /home/user/audit-kit/LANE-BRIEF.md first and follow them (Edit-only, no git, no prisma, lighter verification at 375 dark and 1280 light, plus any width the issue names).

The re-audit findings are in /home/user/audit-kit/reaudit/*.md (one file per area; screenshots referenced there are under /home/user/audit-kit/shots/reaudit/). Your message lists exactly which items are yours, by file and number. Fix every item assigned to you. If an item turns out wrong on inspection, or would change behaviour beyond presentation and copy (permissions, who can see what, data scope, audit), do not change it: explain it under "Not changed" in your report.

Other lanes edit other modules at the same time. Stay in the files your items name; when you must touch a shared file (poolside.css, shared components), keep the edit small and additive. The "Add a <noun>" rename (frame-primitives 4) and copy items are split per module: only rename the labels in your own module's files, and update any help guide text or scripts/help-screenshots/capture.mjs click label that names a button you renamed (search for the old label first).

At the end run: cd /home/user/swimly && npx tsc --noEmit -p . && npx eslint <files you touched>, plus focused tests for files you changed (npx tsx --test <test files>).

Report: one line per item: "<file> #<n>: fixed | not changed (why)", then how you verified (shots), then anything left open. Keep it short.
