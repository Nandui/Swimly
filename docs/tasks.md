# Tasks

Owner request, 8 October 2026: each site's daily checks and logs (opening checks, pool water
readings, changing room checks, a spill cleared), integrated from the standalone prototype in
`Nandui/turnfin-tasks` (a Trail-style study) with every feature the prototype had (owner
decision, 9 October 2026: "all features should be ported"). A template says what a task asks
for, how it is made, where, for whom and when; staff complete the tasks, readings outside their
range are flagged and followed up, reviewers approve, and each site gets a score.

## Surfaces (`/tasks`, a Work module on the shared `ModuleShell`)

The page bar follows the prototype: Today, Manage tasks, Reports, Actions (with the open count),
Sites and Activity.

- **Today** (`/tasks`): one site's day, from the frame's site picker (`?site=`, the working site
  by default). Figures: Completed (with a meter), Remaining, Awaiting approval ("Review completed
  work" filters to it), Open actions ("See what needs follow-up") and the score. The day (arrows
  and a date), then filters: words, status (all, to do, overdue, awaiting approval, completed)
  and tag. The tasks in the prototype's four groups: **Needs attention** (overdue, waiting for a
  reviewer), **Still to do**, **Completed and reviewed** and **Exceptions** (can't complete, not
  applicable, missed). **At a glance**: the site, its area and time zone, opening and closing,
  high-priority tasks left, closed dates ahead and, for managers, **Site settings**. A later day
  shows what the schedules will make; a closed date says so. **Add a task** lists the published
  ad hoc templates.
- **A task** (`/tasks/[id]`): its details (site, day, time in the site's clock, the roles it is
  for), the checklist, the record log (one form, or several records shown as a table once
  closed), photos and files, a warning as soon as a reading is out of range, then **Save
  progress** or **Complete task**; leaving with unsaved changes asks first. Comments and
  follow-up actions sit beside it (a follow-up made from a template links its own task).
  Reviewers **Approve** (never their own), **Reopen** or mark it **Not applicable**; whoever does
  it can say it **can't be completed**, with the reason.
- **Actions** (`/tasks/actions`): one site's follow-ups, open (oldest needed first, overdue
  flagged) and the latest 30 resolved, each with what was done. Raised from a task or on their
  own, writing one or choosing a **follow-up action template**, which also adds that template's
  task for today. Reviewers resolve them or open them again.
- **Reports** (`/tasks/reports`, Review): two tabs. **Site scores**: the average score for the
  chosen site, **Consistency over time** (a line of its score by period, with a hover readout),
  **Site performance** and the scores by day, week or month for every site, each score shown
  with its band (good 96% and up, fair 76% and up, low). **Task reports**: every task in the
  range, filtered by status (on time, late, missed, out of range, awaiting approval), words and
  tag. **Export report** downloads the tab: daily scores (frozen or provisional) or the tasks.
- **Manage tasks** (`/tasks/templates`, Manage; also on Admin's overview): the task library,
  filtered by words, state and tag, each row with copy and archive. The task designer
  (`/tasks/templates/new`, `/tasks/templates/[id]`) has the prototype's tabs: **Content** (title,
  instructions, checklist, record log with its fields, one form or multiple records, and
  sign-off: comment, approval), **Schedule** (how it is added, and its schedules), **Assign**
  (sites, roles and whether completion is restricted to them, tags, high priority) and
  **Report** (notify reviewers of completions, or of completions with readings out of range).
  Save draft, publish, copy, archive and restore; leaving with unsaved changes asks first.
- **Sites** (`/tasks/sites`): each site's Tasks status (live, setting up, inactive), area, time
  zone, business hours, published templates and closed dates. Managers change them (**Manage
  site**).
- **Activity** (`/tasks/activity`, Review): every change audited under Tasks at the sites the
  person reviews, and to the templates, newest first. Managers can **Export everything**
  (`/tasks/export.json`): site settings, templates, tasks with comments and file names, actions
  and frozen scores, as JSON; the export is audited.
- **Help**: three guides in Help's Tasks topic (do the day's tasks; review tasks and follow-up
  actions; write templates and set up sites).

## Rules (`src/lib/tasks/rules.ts`, pure)

- **Kinds** (`TEMPLATE_KINDS`): repeat (on its schedules), one-off (its schedule, once), ad hoc
  (added from Today when needed, open from the site's opening to its closing), follow-up action
  (offered when raising an action; adds its task for today) and automated (made by another
  module; no module sends these yet, so it makes no tasks).
- **Schedules** repeat once, daily, weekly on chosen days or monthly on the first day's date
  (skipping shorter months), every 1 to 52 days, weeks or months. Times are the site's clock, at
  a set time or at its opening or closing; a due time at or before the start is the next
  morning, and a time the clocks skip in spring is refused.
- **Record log fields**: text, number, choose one, date, photo or file, or a section heading. A
  number may have a minimum and maximum, out-of-range guidance and "require a follow-up action":
  the task cannot be completed until one is raised. **Records**: one form per task, or multiple
  records with a minimum.
- **Completing** needs every checklist item ticked, every required answer valid, the number of
  records, a comment if the template asks for one, and the follow-up for a reading that needs
  one. Out-of-range readings are kept on the task in words.
- **Roles**: a template is aimed at roles; with "restrict completion" only they complete it
  (reviewers may always step in); without it the roles are who it is for and anyone may
  complete it. Restricting needs at least one role.
- **What a task shows** comes from its stored status (open, done, not applicable, can't complete)
  and its times: Later, To do, Overdue, Missed (an earlier day), Done, Done early, Done late,
  Awaiting approval, Approved, Not applicable, Can't complete (`TASK_STATE_META`, each with an icon).
- **The score** is 0 to 100: done on time or early counts in full, late half, missed, overdue and
  can't complete nothing; not applicable and anything not yet due are left out. A period's score
  averages its days' scores.

## Making tasks and freezing scores

A task keeps a copy of what its template asked for (`Task.definition`), so changing a template
never rewrites what someone already did. Tasks are made from the published scheduled templates
up to each site's today, from the day each was first published, only at live sites and never on
a closed date, the first time anything needs them: opening the day, the home page, a report, or
the nightly cron (`/api/cron/tasks`, 01:30 UTC). Each is unique by template, site, day and
schedule, so making them twice is harmless. The cron then **freezes** yesterday's score at each
site (`TaskScoreSnapshot`); a frozen day keeps its score when a task is reopened later, and
today stays provisional.

## Sites' settings

`TaskSite` holds each site's Tasks status, area, time zone (`TIMEZONES`), opening and closing
and closed dates. A site without a row is live, open 06:00 to 22:00, in Europe/Dublin. Hours
apply to tasks made from then on; tasks already made keep their times.

## Home page

Tasks to do today that are yours, overdue tasks, tasks to approve (reviewers) and open
follow-ups; for reviewers, today's completions and completions with readings out of range from
templates that ask to tell them (Manage tasks, Report).

## Access

| Level | Permissions | Lets you |
| --- | --- | --- |
| Do | `tasks.complete` | See your sites' tasks; complete the ones you may; comment, add photos, raise follow-up actions, say a task can't be done |
| Review | `tasks.review` | Also approve (never your own), reopen, mark not applicable, resolve actions, Reports, Activity |
| Manage | `tasks.manage` | Also Manage tasks (templates), sites' settings, the export |

Reach is the person's sites (`sitesFor`); a task at another site is a 404. Every change checks the
version it was made from ("Someone else changed this task. Reload…") and is audited in the same
transaction (module Tasks; tasks, actions and sites' settings with their site, templates with
none). Photos and files are PNG, JPEG or PDF up to 5 MB, checked by their first bytes, and served
only to people who do tasks at that site (`/tasks/files/[id]`).

## Files

- Schema: `prisma/schema/tasks.prisma`; migrations `20261025120000_tasks` and
  `20261026120000_tasks_parity` (additive, with a backfill that keeps existing templates as they were)
- `src/lib/tasks/`: `rules.ts` (pure), `access.ts`, `data.ts`, `actions.ts`, `home.ts`
- UI: `src/app/tasks/`, `src/components/tasks/` (the trend chart is `score-trend.tsx`, in
  `--pc-chart-1`); the site picker is the shared `src/components/workspace/site-switcher.tsx`
- Cron: `src/app/api/cron/tasks/route.ts`, `vercel.json`
- Help: `src/lib/help/guides-modules.ts` (`do-task`, `review-tasks`, `manage-task-templates`)
- Sandbox: `scripts/sandbox-tasks.ts` (sites' settings, five templates, two weeks of invented history)
- Tests: `rules.test.ts`, `tasks.test.ts` (end to end on an isolated database)

## Not built yet

What the prototype also left for later: delivering notifications by email or push (they show on
reviewers' home pages), offline use on a tablet, real triggers for automated templates, conditional
questions and a reusable question library, and a printable or PDF report.
