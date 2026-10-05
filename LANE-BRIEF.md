# Module lane brief (read after AGENT-BRIEF.md)

All 17 shared-part tasks (SYS-01 to SYS-17) are applied and committed on `redesign`. Read their briefs in /home/user/audit-kit/tasks/ when you need a shared part's API, and `git -C /home/user/swimly log --stat -8` to see what changed. The shared parts you must use rather than re-invent:

- Frame: ModuleShell (page bar, rail, bottom bar, site picker, account menu). Never nest a page frame.
- PageHeader (`back={{href,label}}`, `status` for tags beside actions) and BackLink; LinkPagination.
- Tag `<Tag meta={…} />` with metadata maps (six tones, icons) from src/lib/status.ts and module constants. Never raw colours.
- Notice (info, warning, error, success; `live` only for action results).
- EmptyState, PageLoading, PageNotFound, PageError (src/components/ui-kit/page-state.tsx).
- SegmentedLinks / SegmentedChoice (wrap, never scroll).
- Button: variants default, outline, ghost, destructive, link; sizes default and icon. Row actions are 44px outline circles.
- Forms: Field with `optional`, hints as captions, ChoiceRow, SearchField, FileField.
- Lists: Item / ItemTitle (600) / ItemDescription (12px caption), Table, figure tiles (.pc-stat), .pc-grid, .tf-content spacing.
- Avatar (32 / lg 40 / xl 64, `self`), Progress meter.
- Format helpers in src/lib/format.ts: formatDay, formatDateRange, formatTime, formatTimeRange, plural, formatCount.

Your lane is a short list of task ids. Do them in the order given, one after the other: for each, read /home/user/audit-kit/tasks/<ID>.md (amendments win), implement it fully against the current code, update the docs it names, verify live, then move to the next. Later tasks in your lane build on earlier ones.

Other lanes run at the same time on other modules. Stay in your own module's files where you can; if you must touch a shared part, keep the edit minimal and backwards compatible, and say so in your report. Edit-only rule applies strictly.

Verification (lighter, by owner decision): screenshot your acceptance routes at 375 dark and 1280 light only (not all four widths), compare them with the mockup, and fix what does not match. The stage gate re-checks every route afterwards. Keep your report short.

The sandbox holds fictional seeded records (refunds in every state, published and draft documents, a started class). If the sandbox restarts, re-seed with: cd /home/user/audit-kit/tools && node seed-ui.mjs

At the end, run `cd /home/user/swimly && npx tsc --noEmit -p . && npx eslint <files you touched>` and fix anything in your files.

Final report: one short section per task id (status done/partial/blocked, files, what changed, how verified, left open).
