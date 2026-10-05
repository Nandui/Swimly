# Turnfin Rota

The deployment plan: who does which duty, where and when, planned by the week
and run by the day, with a warning when someone is off, double-booked or not
qualified for the duty. Timepoint keeps the roster itself (hours, clocking,
payroll exports); Turnfin keeps who does what and why it changed. It lives in
the main database and uses the platform access model (docs/platform-access.md).

## Surfaces

- **Week plan** (`/rota`, Poolside Clear on the shared `ModuleShell`). The week as a
  roster sheet (owner decision, 3 October 2026: the duty grid was "extremely confusing
  to use, to read and not practical"): **people down the side**, grouped by the
  department they work most that week, **days across**, paid hours at the end
  (`buildRoster`, `src/lib/rota/roster.ts`, pure and tested). It follows V2Rota: one white
  panel with no gridlines; day tiles across (today filled, each opening its Day plan), a
  lane tile per person (initials, name, job title), and each shift a block in its state
  from `ROTA_SHIFT_META` (the key shows them as tags): **Shift** (blue), **Check this
  shift** (amber, with the warning's icon), **Absent** (danger, keeping its time) and
  **Unfilled** (hatched). Today's blocks carry a primary outline. A **To fill** row
  above everyone lists each day's unfilled shifts, booking places and cover for someone
  off; a manager chooses one to give it to someone. A day with nothing for a person reads
  **Off**; for managers it is dashed, with a **+**, and gives them a shift. Hours show a
  muted "–" when nothing counts. The description gives the dates, the site and the
  counts (on the plan, to fill, off) and, for managers only, the week's state as a tag
  (`WEEK_STATE_META`: **Planning ahead**, or **Under way: changes ask for a reason**).
  The header holds the week picker (previous and next around a **Week** menu of nearby
  weeks that always has This week), the **Department** menu, **Copy a week** and **Add a
  shift** (both menus are lists of links, so arrowing never loads a page). Below 768px
  the week is an agenda, a list per day for all seven days (DESIGN.md "Phones use
  Agenda"); this departs from V2Rota's phone mockup, which scrolls the sheet sideways.
  **Choosing a shift** opens that person's day in the side panel (`ShiftPlanSheet`, the
  one editor for a shift's plan, also opened from the Day plan's blocks): its warnings,
  their activities and breaks (Suggest breaks included, saved with **Save plan**; a
  failed save keeps the panel and its rows open with the error inside), **Change shift**
  and **Cancel shift**. Viewers see the plan read-only, without the week's state.
  Department supervisors plan upcoming weeks here. **Site picker**: Week plan, Day plan,
  Today and Bookings show one site, chosen in the frame's tools (`RotaSiteSwitcher`); it
  changes only `?site=` (the week and date stay) and the page bar carries it between
  those pages. Overview (the working site) and Absences (every site covered) have none.
  **Words**: the plan item is a **shift** in every control (Add a shift, Change shift,
  Cancel shift, Save shift), following V2Rota and ROOverview rather than ROToday and
  RODay's "Add duty"; **Duty** stays only as the field naming what the shift is for.
  **Copy a week** starts a week that has not started from any earlier week (owner request, 3 October 2026: "plan each day by hand but have the option to start from a copy of a previous week"); the Day plan's **Copy a day** does the same for one day onto another (`copyPlan`). The supervisor chooses **the same people** or **the shape only** (every duty unfilled). Duties come with the activities and breaks inside them, plus the activities to cover and the day notes; booking places come from their bookings, not copies. Only days with nothing planned yet are filled, so a copy never doubles or overwrites a plan.
  It opens for anyone with the Rota screen and `rota.view` at any scope, and
  shows only the sites that capability covers; any other site is a 404.
- **Swim classes** come from the Swim school through the commitments seam
  (`commitmentsFor` in `src/modules/contributions.ts`; docs/architecture.md): the
  plan shows a read-only "Swim classes" row per day (how many classes, how many
  instructors, any without one, linking to that day's Schedule), Today shows them
  on its timeline, a duty whose person is teaching a class then warns **Teaching a
  swim class then**, and Today never suggests someone teaching as cover.
  Instructors and cover are still set in the Swim school.
- **Bookings** (`/rota/bookings`). School lessons, parties, lane hire and events that
  need staff (owner request, 1 October 2026). A booking says what it is
  (`BOOKING_KIND_META`), who it is for, where, its department, the weekdays, the
  times, the first and last day (the same day for a one-off) and the staff each
  session needs: roles, how many, and the qualification each needs. Saving it puts
  a place for each role at each session on the week plan, unfilled, under the duty
  "School lessons: Example National School", each place showing its role. Filling
  places is planning like any other duty. Cancelling a booking cancels its sessions
  still to come; when people this week are already on one, it asks for the reason
  and logs each person taken off. A booking can create up to 600 places. **New
  booking** starts its first and last day on the next ticked weekday, and each row
  names a qualification by its short code ("1 lifeguard (NPLQ)", `qualificationShort`),
  with **Cancel booking** and then **Plan who**.
- **Day plan** (`/rota/day`; a day heading on the week plan opens it). Owner request, 2
  October 2026: the information in the duty managers' weekly pool breakdown (shifts and how
  many each needs, lessons and schools with their instructors, pool positions and handovers,
  bookings, breaks, notes) planned on a timeline, not copied as a document. One row per
  person with their shift; a manager opens a shift to plan **what they do when inside it**:
  activities ("25m pool lifeguard", "Reception") and **breaks**, saved together
  (`RotaShiftSegment`, `saveSegments`; inside the shift, never overlapping, `segmentProblem`).
  Time with nothing planned is the shift's own duty. Breaks come off the hours shown.
  **Activities** across the top (owner request, 2 October 2026: "the activity to be on the
  planner and on click allow assigning staff that is available with the correct needs"):
  **Add activity** plans something the site needs covered that day (`RotaActivity`: "25m
  pool lifeguard" 06:30–21:30, how many people at once, the qualification it needs,
  optionally every day to Sunday). Its row shows who is on it and, in red, each stretch
  when fewer are on it than it needs (`coverGaps`). Opening a gap, or the activity, lists
  everyone on shift for that stretch (`fitsFor`): free for all of it first, then free for
  part of it (the longest free stretch), then busy and why (an activity, a break, teaching
  a swim class, another duty, off); anyone without the qualification is marked, never
  refused. **Assign** makes that stretch an activity inside their shift
  (`assignActivity`). Activities seen only inside shifts still show, with the time between
  people as their gaps. The day's **bookings** show with how many
  places are staffed; the **Swim school** classes someone teaches show as a teaching tag on
  the shift block they fall in, and instructors with classes and no duty get their own lanes,
  their back-to-back classes as one block (`teachingSpans`). The plan is drawn on the shared
  `TimelineGrid` (DESIGN.md): from 1280px a grid with lane tiles (the activity's edit, remove
  and "Put someone on" actions, a person's change-duty pencil), blocks whose state and tag
  come from `ROTA_BLOCK_META`, and a dashed line at the time now on today; narrower, the same
  blocks and actions as an agenda in time order, so nothing is hidden in a sideways scroller. **Add a shift** takes
  **Places**, so "2 lifeguards necessary" is one step: the extra places start unfilled.
  Each day has a **note** (`RotaDayNote`) in a full-width **Notes** panel with an
  always-visible **Save note**, ready once the note changes. Activities used at the site in the last 12 weeks
  are offered first. Timepoint holds shift times, not activities, so planning activities
  never asks for a reason. Pure and tested: `buildTimeline` (`src/lib/rota/timeline.ts`).
- **Today** (`/rota/today`). The duty managers' day: every department's duties on
  one `TimelineGrid` with a dashed line at the time now (below 1280px the same duties
  as an agenda in time order, each still opening its duty), and a link to today's Day plan;
  **Needs you**, the duties still to come whose person is off or that are
  unfilled, each with up to three people who are free (not off, not on another
  shift then, at any site) and hold its qualification, each as **Give cover to
  <name>**; and **Changes today**, each with its reason as a tag, who made it and, in
  its caption, whether Timepoint has it, with **Done in Timepoint**.
- **Absences** (`/rota/absences`, rota managers only). Who is off now or soon,
  whose **return to work** is still to record, and who came back in the last 30 days. **Report absence** records a person, a
  reason (sickness, family emergency, bereavement or other), the first day off and,
  if known, the last. **Extend** runs a current absence on to a later last day
  (or to "return not known"). **Back at work** sets the last day off; **Remove**
  (a red confirm) removes one recorded in error. Each section is a panel of rows with
  the person's initials; with nobody off it says **Nobody you look after is off** and
  names the sites the manager's role covers. Cancelling a shift or a booking and
  removing an absence confirm with a red button, and in a started week still ask for
  the reason.
- **My shifts** in Turnfin Me (the staff app). Each
  person sees their own shifts for the coming weeks. No permission is needed.

## Capabilities

| Key | Lets you |
| --- | --- |
| `rota.view` | See the rota at the sites the role covers |
| `rota.manage` | Add, change, fill and cancel shifts at those sites. Includes seeing it |

Shifts belong to a site, so scope resolves with `sitesFor` and `requireCapFor`
with a `siteId`. A duty manager's role scoped to one site plans that site only.
A department scope reaches its department's site. Moving a shift between sites
needs the permission at both. Every change is audited with the shift's own site.

## Warnings, never blocks

Owner decision, September 2026: the rota **warns** and never refuses. Warnings
come from `ROTA_WARNING_META`, each with its own icon, shown with `<Tag meta={…} />`:

- **Qualification expired**: the shift needs a qualification type, and every one
  the person holds had expired by the shift's day. Withdrawn ones don't count.
- **Qualification not recorded**: the shift needs one they have never held.
- **Double-booked**: the person has an overlapping shift that day, at any site.
- **Absent**: the person is recorded as off that day. Nothing is cancelled or
  reassigned automatically; the planner finds cover.
- **Unfilled**: an open shift with nobody on it.

The rules live in one pure function, `shiftWarnings` (`src/lib/rota/constants.ts`),
tested on its own. A person's own qualification warning also shows in Turnfin Me,
so they can sort it out before the shift. Renewing is Training's job (the
expiring-qualifications view, docs/training.md).

## Absences

Owner request, 28 September 2026. An absence belongs to a person, not a site, so
recording, ending and removing one needs `rota.manage` over that person
(`requireCapFor` with `subjectUserId`): a site-scoped planner covers the people who
work at their site (their main site or "Works at"). The Absences page lists only
those people.

The reason is health-adjacent, so it is kept small:
- Only rota managers see it, on the Absences page. The week says only **Absent**.
- The shared activity log names the person and the days, never the reason.
- The note is short and its hint says never to record medical details. Anything
  more belongs in HR (docs/hr.md).

Reasons come from `ABSENCE_REASON_META`, each with its own icon in the meta.
One absence at a time per person: overlapping days are refused. Reporting your own
absence from Turnfin Me is not built yet.

### Extensions and "off again"

Owner request, 1 October 2026. Managers report with what they know, and it
changes: "off two days" becomes two weeks, or someone is back a few days and off
again. `followOn` (constants.ts, tested) decides what a new report for the same
person might be, and **Report absence** asks:

- **Still off** (open-ended, or their last day off is on or after the day before
  the new first day): "Is this an extension of that absence?" Yes extends the
  same absence (`extendAbsence`): a later last day, or the return not known. It
  stays one absence and counts once. When the new days are already covered,
  extending is the only answer; something different means Back at work first.
- **Back within 28 days** (`ABSENCE_AGAIN_DAYS`): "Is it the same thing again?"
  Yes records a new absence linked to the earlier one (`continuesId`); no records
  it on its own.

Each absence keeps its story in `RotaAbsenceUpdate` (reported, extended, back,
with the last day each time, who, and the note). The page shows "Extended twice;
first reported until 2 Oct" and "Off again after an absence ending 24 Sep", with
the extensions listed under it. Extending is refused for an absence that ended
before yesterday (report a new one and link it), for a day not later than the
current last day, and when it would run into another absence of theirs.

### Breaks

The house rule (Employee Policies and Procedures Handbook 2026, rest periods; owner,
3 October 2026), in `breakEntitlement`: over 4 and under 6 hours, one 15-minute
unpaid break; 6 to under 8, 30 unpaid and 15 paid; 8 to 10, 30 unpaid and two 15
paid; over 10, 45 unpaid and two 15 paid. The manager on shift allocates them:
**Suggest breaks** in a shift's plan (`suggestBreaks`, tested) replaces its breaks
with the entitlement, the unpaid one near the middle and paid ones before and
after, on quarter hours in time with nothing planned, so a break never takes
someone off an activity; only a shift planned full has a break cut out of an
activity, which then shows as a gap (warn, never block). Each break is **Paid
break** or **Unpaid break**; unpaid ones come off the hours shown, paid ones stay
(an older plain "Break" counts as unpaid). On-the-day changes affect that day
only. **Under-18s** (handbook; Protection of Young Persons (Employment) Act 1996) get
at least 30 minutes unpaid after 4.5 hours of work at 16 and 17, or after 4 hours under
16, the standard breaks extended to meet it (`youngBand`, `breakEntitlement`). It
needs the person's **date of birth**, an optional field on their profile (Staff, Edit
profile; staff managers only, migration `20261015120000_user_date_of_birth`). The rota
reads only the band on the day (under 16, or 16 and 17), never the date.

### Changes once a week has started

Owner request, 1 October 2026. From a week's Monday Timepoint holds it, so any
change to one of its duties (adding, moving, changing the person or the time,
cancelling) asks for its reason (`ROTA_CHANGE_REASON_META`: covering an absence,
swap agreed, extra hours approved, correcting a mistake), an optional note, and
whether Timepoint is already updated. Each is kept as a `RotaShiftChange` with
what it was and is now, the people it took off and put on, and the absence it
covers (found for "covering an absence" when the person taken off is off that
day). An unticked Timepoint stays open until **Done in Timepoint**, and the
change goes on the personal file of each person it moves. Changing only the note
asks nothing. Before its Monday a week is a draft and changes freely
(`weekStarted`, constants.ts, tested).

### Return to work

Owner request, 1 October 2026: an absence goes into a return to work once the
person has their first shift back, and all of it goes on their personal file.

- Once an absence's last day has passed, it moves from "Off now or soon" to
  **Return to work**. `returnStage` (constants.ts, tested) says where it stands:
  **due** from their first rostered shift after the absence (or, with no shift on
  the rota, from the day after their last day off), **waiting** before that shift,
  **recorded** once done. Due ones are a "Returns to work to record" tile on the
  home page (`returnsToWorkDue`).
- **Return to work** (`recordReturnToWork`) records the conversation: the day you
  talked (after their last day off, not in the future), whether they are **fit to
  work** or **back with changes** (`RETURN_FIT_META`; changes must be said), whether
  their fit note came in (asked only for sickness over 7 days, `needsFitNote`),
  and a note. It is stored on `RotaAbsence` (`return*` columns) and closes the
  absence: it can no longer be extended or re-dated, and a new absence is
  reported instead. The shared log says only that it was recorded.
- Unrecorded returns stay on the list whatever their age; recorded ones show
  under "Back in the last 30 days" with their answer.

### The personal file

Rota registers `rota.absences` with the personal-file seam
(`registerPersonFileSection` in `src/modules/contributions.ts`, from
`src/lib/rota/file.ts`). The HR record (docs/hr.md) and its subject export show
every absence of the person (their account, or their roster entry once linked to
it), with its story and return to work, and their absences and calendar days
off in the last 12 months. HR never imports Rota. Turnfin Me can later show the
person their own absences through the same seam, with an allowlisted response.

## Files

- Schema: `RotaShift` (`prisma/migrations/20261001120000_rota`), its department and `RotaShiftChange` (`prisma/migrations/20261011120000_rota_plan`), `RotaBooking` and `RotaBookingNeed` (`prisma/migrations/20261012120000_rota_bookings`), `RotaAbsence` (`prisma/migrations/20261005120000_rota_absence`), `RotaAbsenceUpdate` and `continuesId` (`prisma/migrations/20261007120000_rota_absence_updates`), return to work (`prisma/migrations/20261009120000_rota_return_to_work`)
- `src/lib/rota/`: `access.ts`, `data.ts` (the week, today, absences, returns due), `plan.ts` (the week plan's rows, pure and tested), `mine.ts` (own shifts), `actions.ts`, `constants.ts`, `file.ts` (the personal file)
- Self-service: `src/lib/rota/mine.ts` (staff API); UI: `src/app/rota/`, `src/components/rota/`; shift-change emails from `src/lib/staff-api/reminders.ts`
- Tests: `src/lib/rota/rota.test.ts`

## Roster upload: retired (1 October 2026)

Owner decision, 1 October 2026: Timepoint keeps the roster (who works which hours,
clocking and the payroll exports); Turnfin does not import it. Upload roster
(`/rota/import`), Roster changes (`/rota/changes`) and their code (the RosterBrowser
reader, the payroll department list and name matching) are removed. Turnfin's Rota
becomes the deployment plan instead: department supervisors plan who does what at
their site's departments for the week, and duty managers run and adapt the day's
plan (being designed; mock-ups first).

What stays, so nothing recorded is lost: imported shifts still show on the week they
belong to; `RotaPerson` entries still name the people on old shifts and absences, and
someone with a recently imported shift can still be reported absent until those
shifts age out (56 days); the `RotaImport`, `RotaChange` and `RotaDepartment` tables
are kept (the shared database only takes additive changes) but nothing writes to them.
