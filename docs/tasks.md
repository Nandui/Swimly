# Tasks

Owner request, 8 October 2026: each site's daily checks and logs (opening checks, pool water
readings, changing room checks, a spill cleared), integrated from the standalone prototype in
`Nandui/turnfin-tasks` (a Trail-style study). A template says what a task asks for, where, for
whom and when; each published template makes its tasks at its sites on the days its schedule
says. Staff complete them, readings outside their range are flagged and followed up, reviewers
approve, and each site gets a score.

## Surfaces (`/tasks`, a Work module on the shared `ModuleShell`)

- **Today** (`/tasks`): one site's day, from the frame's site picker (`?site=`, the working site
  by default) and the previous and next day (`?date=`). Figures (done of all, overdue or missed,
  awaiting approval, score, open actions), then **Needs attention** (overdue, missed, can't be
  done, waiting for a reviewer), **To do** and **Done**. A later day shows what the schedules
  will make, read only. **Add a task** lists the published templates without a schedule.
- **A task** (`/tasks/[id]`): its details, the checklist, the questions (one record, or several
  for a log), photos and files, a warning as soon as a reading is out of range, then **Save
  progress** or **Complete task**. Comments and follow-up actions sit beside it. Reviewers
  **Approve** (never their own), **Reopen** or mark it **Not applicable**; whoever does it can
  say it **can't be completed**, with the reason.
- **Actions** (`/tasks/actions`): one site's follow-ups, open (oldest needed first, overdue
  flagged) and the latest 30 resolved, each with what was done. Raised from a task or on their
  own; reviewers resolve them or open them again.
- **Reports** (`/tasks/reports`, Review): each site's score, missed, late and out-of-range
  counts over up to 92 days, the score by day, week or month, the latest readings out of range
  or tasks not done, and **Download CSV** with every task in the range.
- **Templates** (`/tasks/templates`, Manage; also listed on Admin's overview): published,
  drafts and archived. The editor (`/tasks/templates/new`, `/tasks/templates/[id]`) sets the
  title and what to do, tags and high priority, the **sites** (none means every site), the
  **roles** it is for (none means everyone at the site), the **schedules**, the **checklist**,
  the **questions** and how many records, and whether it needs a comment or approval. Copy,
  archive and restore.

## Rules (`src/lib/tasks/rules.ts`, pure)

- **Schedules** repeat once, daily, weekly on chosen days or monthly on the first day's date
  (skipping shorter months), every 1 to 52 days, weeks or months. Times are the centre's clock
  (Europe/Dublin); a due time at or before the start is the next morning, and a time the
  clocks skip in spring is refused.
- **Questions**: text, number, choose one, date, photo or file, or a heading. A number may
  have an acceptable range, what to do when it is out of range, and "needs a follow-up
  action": the task cannot be completed until one is raised from it.
- **Completing** needs every checklist item ticked, every required answer valid, the
  number of records, a comment if the template asks for one, and the follow-up for a reading
  that needs one. Out-of-range readings are kept on the task in words.
- **What a task shows** is worked out from its stored status (open, done, not applicable,
  can't complete) and its times: Later, To do, Overdue, Missed (an earlier day), Done, Done
  early, Done late, Awaiting approval, Approved, Not applicable, Can't complete
  (`TASK_STATE_META`, each with an icon).
- **The score** is 0 to 100: done on time or early counts in full, late half, missed, overdue
  and can't complete nothing; not applicable and anything not yet due are left out. It is
  worked out from the tasks, never stored.

## Making tasks

A task keeps a copy of what its template asked for (`Task.definition`), so changing a template
never rewrites what someone already did. Tasks are made from the published templates up to
today, from the day each was first published, the first time anything needs them: opening the
day, the home page, a report, or the nightly cron (`/api/cron/tasks`, 01:30 UTC, yesterday and
today at every site), so a day nobody opened still counts its missed tasks. Each is unique by
template, site, day and schedule, so making them twice is harmless. A task added by hand is due
by the end of its day.

## Access

| Level | Permissions | Lets you |
| --- | --- | --- |
| Do | `tasks.complete` | See your sites' tasks; complete the ones aimed at your role (or at nobody in particular); comment, add photos, raise follow-up actions, say a task can't be done |
| Review | `tasks.review` | Also approve (never your own), reopen, mark not applicable, resolve actions, Reports |
| Manage | `tasks.manage` | Also write the templates |

Reach is the person's sites (`sitesFor`); a task at another site is a 404. A template aimed at
roles is completed only by those roles; reviewers at the site may always step in. Every change
checks the version it was made from ("Someone else changed this task. Reload…") and is audited
in the same transaction (module Tasks; tasks and actions with their site, templates with
none). Photos and files are PNG, JPEG or PDF up to 5 MB, checked by their first bytes, and
served only to people who do tasks at that site (`/tasks/files/[id]`).

## Not carried over from the prototype

Its own sites, opening hours and closed dates (sites are Core's; "Not applicable" covers a
closed day), its own activity log (Admin's activity log has every change), notification
settings that sent nothing, "automated" tasks with no trigger, the form-or-table log switch
(several records make a log) and stored score snapshots (worked out from the tasks).

## Files

- Schema: `prisma/schema/tasks.prisma`, `prisma/migrations/20261025120000_tasks` (additive)
- `src/lib/tasks/`: `rules.ts` (pure), `access.ts`, `data.ts`, `actions.ts`, `home.ts`
- UI: `src/app/tasks/`, `src/components/tasks/`; the site picker is the shared
  `src/components/workspace/site-switcher.tsx` (Rota's too)
- Cron: `src/app/api/cron/tasks/route.ts`, `vercel.json`
- Sandbox: `scripts/sandbox-tasks.ts` (four templates, two weeks of invented history)
- Tests: `rules.test.ts`, `tasks.test.ts` (end to end on an isolated database)

## Not built yet

Notifications (a reading out of range, a missed priority task), offline use on a tablet, tasks
triggered by another module (a Rota absence, a Purchasing delivery), conditional questions and
a library of reusable question sets, and a printable or PDF report.
