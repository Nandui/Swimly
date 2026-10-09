# Turnfin Rota

*Rebuilt on owner decisions of 6 October 2026, from approved mockups. It replaces the
person-first week sheet of 3 to 5 October, which was confusing to read and plan with.*

The rota says **who is on which activity, where and when**, and counts every gap in cover.
It is built from **activities**, not shifts: a supervisor plans what each day needs
("Lifeguarding, Main pool, 07:00 to 21:30, 2 people at once") and puts people on its places.
A person's **shift is worked out** from what they are on, with their breaks. Timepoint still
holds hours and pay; the rota keeps a log of every change to a day that has come, with an
"Update Timepoint" follow-up.

## The model

| Concept | Table | What it is |
| --- | --- | --- |
| Activity | `RotaActivityType` | The organisation's one list: Lifeguarding, Teaching, Reception. Each belongs to a **department** (who plans it), has an icon (`ROTA_ACTIVITY_ICONS`) and may need a **qualification**. One activity "takes the swim classes" (`fromClasses`). Archived, never deleted. |
| Need | `RotaNeed` | One activity at a site on a day: where (one of the site's **areas**, Admin, Areas: "Main pool"), from and to, and how many **places** (people at once). Each place is a lane on the timeline. |
| Assignment | `RotaAssignment` | A person on one place for all or part of the need's time. One person at a time on a place (`placeProblem`). |
| Gap | worked out | Any time a place has nobody on it, or the person on it is off that day (`needGaps`, `needsCover`). Back-to-back swim classes nobody teaches count as one gap. |
| Planned shift | `RotaPlanShift` | Someone put on a shift on a department's plan before their activities (owner decision, 8 October 2026): "add a staff member to a shift, then assign activities". Two of theirs at one site may not overlap. |
| Shift | planned, else worked out | A planned shift is the shift. Without one: first start to last finish of their activities that day; an hour or more with nothing on splits it in two (`dayShift`, `SPLIT_AFTER`). Work outside a planned shift makes a worked-out one beside it. |
| Placed break | `RotaBreak` | A break the manager placed for a person's day at a site (handbook: "all breaks will be allocated by the Manager on shift"). |
| Breaks | placed, else suggested | The house rule (below). The manager's are kept where they put them, even during an activity (that time then needs cover); the rest are suggested in free time. When there is none, the shift says "Breaks to place". |
| Shared week | `RotaWeekShare` | A department's week at a site, shared with its staff. Until then it is a draft they cannot see. |
| Change log | `RotaLog` | Every change to a day that had come (today or earlier): what, who it moved, the reason, the absence it covers, and Timepoint. |
| Booking | `RotaRepeat` | A booking that repeats (school lessons, lane hire): it adds its need on each of its days ahead, each then planned on its own. |
| Absence | `RotaAbsence` | Kept in the main database so the rota always has them (HR's database is optional); shown on the person's HR file. |

Swim classes are not copied into the rota: the swim school reports each class through the
**commitments** seam (`activities.classes`, with `ref`, `place` and `title`), and they appear
as the Teaching activity, one lane per teacher (`intoLanes`), in the area their location
names (the part before a comma: "Learner pool, lane 3"). The rota **plans who
teaches** a class on a date through the same seam's `plan` (`planCommitment`), which writes
the swim school's `ClassPlannedTeacher`. Planning the class's usual instructor clears it. The
class's start record (`ClassCover`) is untouched: it is still written when the class starts,
and a class that has started, is cancelled or does not run that day cannot be planned.
Teacher order: the start record, else the planned teacher, else the usual instructor.
Owner decision, 8 October 2026: **the plan defines who teaches a class that day**, and the
swim school follows it everywhere a day's teacher matters: the pool deck's classes, the
schedule, the duty page, starting a class, **saving its register** (the usual instructor of a
class planned to someone else no longer counts as its teacher that day), the pool deck's
swimmer lookup (medical notes reach that day's teacher) and the lessons parents see. The
class's instructor in the swim school is only its usual teacher.

Everything is laid out by one pure function, `buildDay` (`src/modules/rota/shared/day.ts`), so Plan,
Today, the home card and Turnfin Me agree. The rules are in `cover.ts`, `shifts.ts` and
`fit.ts`, each tested on its own.

## Levels and permissions

| Level | Permission | Lets you |
| --- | --- | --- |
| View | `rota.view` | See the rota at the sites the role covers |
| Plan | `rota.plan` | Change the **days after today** for the **departments you belong to** (`UserDepartment`): add activities, put people on, copy, share the week, add bookings |
| Run | `rota.manage` | Change **any day** for **every department**, today and earlier included; report absences and returns to work; keep the day note and mark Timepoint done. Run at every site also keeps the activity list |

Run keeps the stored level key `manage`, so roles that held Manage now hold Run. Levels are
cumulative (Run includes Plan). `canChange` (`access.ts`) is the one rule, used by every
page and action. Everything is site-bound (`sitesFor`, `mayFor`, `requireCapFor` with a
`siteId`); absences are person-bound (`subjectUserId`). The activity list is the
organisation's, so only someone who runs the rota at every site keeps it; others who run
it see it.

## Warnings, never blocks

Owner decision, September 2026, kept: the rota warns and never refuses. On a block and on
"Who can fill it", from `ROTA_FIT_META`, each with its icon:

- **Qualification expired** / **not recorded**: the activity needs one, and on that day
  every one they hold has expired, or they never held one. Withdrawn ones don't count.
- **Double-booked**: they are on something else at the same time, here or at another site,
  rota or swim class.
- **Off**: recorded as off that day. Their place then **needs cover** (a gap).
- **Long day**: putting them on makes a day of 9 hours or more.

"Who can fill it" (`rankFits`) lists everyone who works at the site, best fit first:
qualified and free, then fewest hours planned that week. Warnings push a name down by
severity (long day, then double-booked, then a qualification, then off) and never remove
it.

## The screens

- **Plan** (`/rota`, supervisors): one department's week. A strip of the days with each
  one's gap count (Nothing planned, Covered, or "3 gaps"); the open day as a timeline
  across the full width, **by area** (the site's list, in its order; a place not on it last,
  "Not an area yet"), each area's activities under a slim heading with a lane per place, people
  in blue (`data-block="next"`), gaps in amber (`cover`), someone off in red (`absent`). An
  area's plus adds an activity there. **Show** zooms to the whole day, morning, afternoon or
  evening; the wheel zooms around the pointer down to an hour, and dragging moves the day
  (`view.ts`); a block shows as much as
  its width allows (name and times, then first name, then initials), and back-to-back
  classes merge until there is room for each. Choosing a gap opens **Who can fill it** as
  a sheet; choosing a person changes their time or takes them off; a single activity's
  label opens it to change or remove. **Who's working** shows each person's worked-out
  shift, paid hours, breaks and warnings. **Copy** fills empty days from an earlier day or
  week (people optional); **Share week** shares it. Below 1024px the day is an agenda.
- **Today** (`/rota/today`, duty managers): the whole site, every department. **Gaps to
  fill** first, soonest first, each with its best three fits and a plus that puts them on
  (logged as covering an absence, or filling a gap in the plan) and "Everyone who could".
  Then On now, Coming up (three hours), Off today, Changes today with what is still to
  update in Timepoint, and the day note.
- **Bookings** (`/rota/bookings`): repeating bookings and how many places are still to fill.
- **Absences** (`/rota/absences`, Run). The activity list and each site's areas are kept in Admin (docs/admin-setup.md); the plan and bookings pick from them.
- **Turnfin Me** (`/shifts`): each day the person's department has shared, as their
  activities in order with the breaks placed for them, the shift and paid hours, a
  Changed tag when something of theirs moved after sharing, and breaks still to arrange.
- **Home and overview**: who is on today at the working site and the gaps still to come;
  for Run, who is off, Report an absence, and returns to work due.

## Days that have come

A change to today or an earlier day (adding, changing or removing an activity; putting
someone on, moving or taking them off; planning a class's teacher) asks **why**
(`ROTA_CHANGE_REASON_META`: covering an absence, filling a gap in the plan, swap agreed,
extra hours approved, correcting a mistake) and an optional note. It goes in `RotaLog` with
an "Update Timepoint" follow-up until someone marks it **Done in Timepoint**, and on the
personal file of the person it moved. Covering someone who is off swaps the person on their
place (the assignment changes hands), and the log links the absence. Days ahead change
freely. Once a week is shared, the people a change moves are told by email
(`notifyShiftChange`, their Turnfin Me preference).

## Absences

An absence belongs to a person, so recording, ending and removing one needs Run over that
person (`requireCapFor` with `subjectUserId`). The reason is health-adjacent, so it is kept
small: only people who run the rota see it, the shared log names the person and the days,
never the reason, and the note's hint says never to record medical details. Reasons come
from `ABSENCE_REASON_META`. One absence at a time per person.

**Extensions and "off again"** (`followOn`): still off is an extension of the same absence
(`extendAbsence`, its story kept in `RotaAbsenceUpdate`); back within 28 days asks whether it
is the same thing again (`continuesId`).

**Return to work** (`returnStage`, `recordReturnToWork`): due from the person's first day
of work back (rota activities or swim classes), or the day after their last day off with
nothing planned; it records the conversation, whether they are fit to work or back with
changes, and the fit note for sickness over seven days (`needsFitNote`), and closes the
absence.

## Breaks

The house rule (Employee Policies and Procedures Handbook 2026, rest periods; owner,
3 October 2026), `breakEntitlement`: over 4 and under 6 hours, one 15-minute unpaid break;
6 to under 8, 30 unpaid and 15 paid; 8 to 10, 30 unpaid and two 15 paid; over 10, 45 unpaid
and two 15 paid, by the length of each part of a shift. **Under-18s** (Protection of Young
Persons (Employment) Act 1996) get at least 30 minutes unpaid after 4.5 hours at 16 and 17,
or 4 hours under 16 (`youngBand`, from the optional date of birth; the rota reads only the
band). Breaks are placed on quarter hours in time the person has nothing on, aimed at the
middle (one), a third and three fifths (two), or quarters (three). A break never takes
someone off an activity: with no free time, the shift says so and the planner leaves a gap
(which then needs cover) or the duty manager arranges it on the day. Unpaid breaks come off
the paid hours whether placed or not.

## Shifts first (owner decision, 8 October 2026)

Plan's **Who's working** is a timeline by person: each row is their shift (solid outline when
planned), what they are on, and their breaks (solid when placed, dashed while suggested).

- **Add to shift**: times, then who, best fit first (`whoForShift`, the same ranking as "Who can
  fill it" without a qualification). Saved by `savePlanShift`.
- **Open a person**: their shift (change, remove, or turn a worked-out one into a planned one),
  their breaks (`saveBreaks` places them all; "Use suggestions" clears them), what they are on,
  and **Activities they could take**: every gap inside their shift on this department's day, at
  the longest stretch they are free (placed breaks count, suggestions do not), with why not
  ("Needs NPLQ", "Off that day", "Busy then"). Putting them on uses `assign` or, for a swim
  class, `planTeacher` (`ShiftOption`, worked out in `buildDay`).
- **Under-18 rest** (`youngRest`): 12 hours off between shifts at 16 and 17, 14 under 16, and two
  days off a week, from their work at any site (activities, planned shifts, classes). Warnings
  only: the plan says so and the manager decides.
- Copying a day with its people copies planned shifts too; sharing a week tells the people on
  planned shifts; Turnfin Me shows the planned shift and the placed breaks. Removing a shift
  removes the breaks placed in it; activities stay, with a worked-out shift.

## The personal file

Rota registers two sections with the personal-file seam (`src/modules/rota/features/person-file/server/file.ts`):
`rota.absences` (every absence with its story and return to work, and days off in the last
12 months) and `rota.changes` (changes to their activities on days that had come, from
`RotaLog`). HR never imports Rota.

## Files

- Schema: `prisma/migrations/20261022120000_rota_plan_shifts` (planned shifts and placed breaks);
  `prisma/migrations/20261019120000_rota_rebuild` (additive: the activity list,
  needs, assignments, shared weeks, the log, bookings, and the swim school's
  `ClassPlannedTeacher`). The tables of the retired rota (`RotaShift`, `RotaShiftSegment`,
  `RotaShiftChange`, `RotaActivity`, `RotaBooking`, `RotaBookingNeed`, `RotaPerson`,
  `RotaDepartment`, `RotaImport`, `RotaChange`) are no longer read; they stay until
  development has its own database, then go in one migration. Absences
  (`RotaAbsence`, `RotaAbsenceUpdate`) and the day note (`RotaDayNote`) carry on.
- `src/modules/rota/` (module README there): `shared/` holds the pure rules (`cover.ts`, `shifts.ts`,
  `fit.ts`, `day.ts`), `constants.ts` (absences, reasons, bookings, breaks, dates), `meta.ts`
  (statuses and icons), `access.ts`, `data.ts` (sites, the activity list, days, who fits),
  `actions.ts` (needs, assigning, who can fill a gap, copying and sharing a week), `writes.ts`,
  `areas.ts` and the plan dialogs, fill sheet and change fields. Each feature keeps its own
  reads, actions and screens: `features/plan` (`planWeek`, plan shifts and breaks, `view.ts`,
  `day-plan.tsx` the timeline, `people-plan.tsx` who's working and their shifts),
  `features/today` (`todayAt`, the day note, timepoints), `features/bookings`,
  `features/absences`, `features/me` (Turnfin Me), `features/person-file` and
  `features/workspace` (the frame). `module.ts` registers the home card, person file and area rename.
- The swim school's side: `src/modules/activities/contributions.ts` (`list` and `plan`)
- UI: `src/app/rota/`, which imports only the feature entries;
  Turnfin Me `apps/me/src/app/shifts/page.tsx`
- Tests: `cover.test.ts`, `shifts.test.ts`, `day.test.ts`, `view.test.ts`, `rota.test.ts` (end to end on a throwaway database),
  `src/modules/activities/commitments.test.ts`, `src/lib/staff-api/api.test.ts`
- Sandbox: `scripts/sandbox-seed.ts` seeds a planned week at Hillview (sign in as sam@ for
  Plan, maya@ for Run)

## Retired

The roster upload (1 October 2026) and the person-first week sheet and day planner
(3 to 5 October 2026) are gone. Their records are not migrated (owner decision: start
fresh).
