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
| Activity | `RotaActivityType` | The organisation's one list: Lifeguarding, Teaching, Reception. Each belongs to a **department** (who plans it), has an icon (`ACTIVITY_ICONS` in src/lib/setup/meta.ts) and may need a **qualification**. One activity may "take the swim classes" (`fromClasses`), giving them its name and department; without one they still show (below). Archived, never deleted. |
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
| Lanes | `SiteArea.lanes`, `RotaNeed.lanes`, `RotaRepeat.lanes` | Owner request, 13 October 2026: an area says how many lanes it has (Admin, Areas; 0 for none), and an activity or booking takes the whole area (no lanes) or any set of them. **Two bookings can't hold the same lane at the same time** (`laneClash`, checked on save). Activities on the Plan may share lanes (lifeguarding covers the whole pool). Swim classes, assessments and short course sessions keep their lanes in their location text after the area ("Main pool, lanes 1, 3 and 5"; owner request, 19 October 2026), ticked on their forms with `PlaceLanesField`, and the Plan names a block's lanes in its label and dialog. Wording and parsing in `src/lib/setup/lanes.ts`; booking rules in `shared/lanes.ts`. |
| Absence | `RotaAbsence` | Kept in the main database so the rota always has them (HR's database is optional); shown on the person's HR file. |

Swim classes are not copied into the rota: the swim school reports each class through the
**commitments** seam (`activities.classes`, with `ref`, `place` and `title`), in the area their
location names (the part before a comma: "Learner pool, lane 3"). Owner decisions, 16 October
2026: **the classes fill the Plan by themselves**, waiting for a teacher, and "no booking option
takes the swim school anymore". They are drawn as **Swim classes** on every department's plan
(`SWIM_CLASSES`, `ANY_DEPARTMENT`), and whoever may change that department's day plans their
teachers. No activity takes the classes: the old "Takes the swim classes" option is gone, an
activity that had it is left out of the Plan and tagged in the activity list, and saving it
makes it an ordinary activity (the column stays). On the Plan each class is its own block on its
area's classes row (level and teacher, amber when nobody teaches it); choosing one opens **Who
teaches it**, to give it to someone, change them or take them off, for that day only. Given from
a department's plan, the class (with the run of classes back to back with it that the person
already teaches) goes on the person's planned shift there: kept when a shift holds it, else the
shift it meets is stretched, else a new shift is made, never overlapping another of theirs
(`shiftForClass`). The rota **plans who teaches** a class on a date through the same seam's
`plan` (`planCommitment`), which always writes the swim school's `ClassPlannedTeacher` (with
nobody, when taken off). The class's start record (`ClassCover`) is untouched: it is still
written when the class starts, and a class that has started, is cancelled or does not run that
day cannot be planned.

**There is no set instructor any more** (owner decision, 16 October 2026: "the instructor is
defined via the plan"). Teacher order for a date: the start record, else the planned teacher
(or nobody), else nobody. Two weeks' grace (his choice): up to and including Sunday 1 November
2026 (`USUAL_INSTRUCTOR_UNTIL` in `src/modules/activities/shared/courses/planned.ts`) a class
nothing is planned for is still taught by the instructor stored on it. The swim school follows
the plan everywhere a day's teacher matters: the pool deck's classes, the schedule, the duty
page, starting a class, **saving its register**, cancellations, the pool deck's swimmer lookup
(medical notes reach that day's teacher) and the lessons parents see. The class forms no longer
ask for an instructor and the class lists no longer show one; the stored `Course.instructorId`
is kept, never deleted or changed.

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

- **Plan** (`/rota`, supervisors): **the day's diary**, rebuilt from scratch on 20 October 2026
  (owner: "a feature that allows a department supervisor to plan the whole day for the staff in
  that department, including breaks, who covers what activities, when they change to others, when
  they cover bookings ... It's the plan, the diary, the actual guide for the day ... readable and
  understood by anyone"; "a REDESIGN ... from the ground up"). New code in
  `src/modules/rota/features/diary` on the same saved records (owner's card: "New Plan, keep saved
  records"); the old `features/plan` code is kept, unused, by his choice. His rules that evening:
  - It opens on the viewer's own department and on today; **Every department** is `dept=all`.
    Under the title: departments, then the week (arrows, Today, a link per day with how much is
    still to fill, or Done).
  - **The model** (`diary/model.ts`, pure, `model.test.ts`): what needs people is each area's own
    need (`areaNeedsOn`, "Lifeguard on duty"), each activity, each booking and each swim class;
    they **add up** (someone on aqua-fit is not one of the pool's lifeguards). Someone's day
    follows from what they are on (**needs first, shifts follow**); a shift planned on its own
    still counts, and a gap of an hour or more splits the day. Someone **on a break or off** is
    not covering, so that time is a hole with the reason. A department's plan shows its own work
    and the area needs its people can do (they hold the qualification, or none is needed). The
    day is **done when every need is filled**; warnings never block.
  - **Not covered yet** first: every hole, soonest first, with why ("Nobody yet", "1 more
    needed", "Riley is off", "Liam is on a break") and **Choose someone**.
  - **Choose someone** (`candidates`): best fits first (free then, able, own department), then
    other departments' people, borrowed straight away (`allowedForPerson`), then who can't and why
    ("Busy: Main pool 11:30–15:00", "Needs NPLQ", "Off today"); each with what it does to their day
    ("On shift then", "Their day becomes …", "A split day …", "Not in today: a shift …") and their
    hours this week against their contract. Part of the time can be given. `fillNeed` saves an
    area place (`RotaAreaAssignment`), an activity or booking place (`RotaAssignment`, past its
    places when they are all taken, for break cover) or the class's teacher (`planTeacher`).
  - **Who's where** (`whoIsWhere`, `nextChange`) at any half hour (now on today): each need running
    then with who is on it and how many more it needs, who is on a break, the next change. Needs
    are grouped by area as department › area › sub-area (`groupWhere`): an area belongs to a
    department and may be part of another (`SiteArea.departmentId`, `parentId`; owner's card,
    20 October 2026, "Department, area, sub-areas"); an area need belongs to its area's
    department, and a sub-area takes its parent's.
  - **Sub-activities** (owner, 20 October 2026: "when we assign that activity, we might also
    assign other sub activities that are available during that"; card "Yes, add them"): each
    activity has a list in Admin, Activities (`SubActivity`, Core): a name, when (at the start, at
    the end, at a set time, any time while on it) and whether it is **usual**. Putting someone on
    the activity (`fillNeed`) copies the usual ones onto their place (`RotaAssignmentSub`; a set
    time only when it falls in their stretch). Their day lists them under the line with times
    (`subsAt`: start and end follow the line's own times, so changing times needs nothing more),
    and **Sub-activities** there ticks, unticks and retimes them for that day (`saveLineSubs`,
    audited). They are done by the person on the activity and never add to what it needs.
    Copy does not carry them yet.
  - **The day, person by person**: from 1024px a track per person (a red and amber Not covered
    line on top); areas blue, activities and classes green, bookings violet, breaks dashed, time
    not given yet dotted, a now line on today; below 1024px each person's day as a short list.
  - **Their day** (a sheet from a name or block, `stepsOf`): what to look at, then each line with
    Change time and Take off (`changeLine`, `removeLine`), free time with what it could cover,
    breaks owed by the house rule and Place breaks (`placeBreaks`), and shifts (`saveShift`,
    `removeShift`). **Add someone** is a shift on its own; **Add to the day** is `saveNeed`.
  - A day that has come asks why for every change (`ChangeFields`). **Export week**
    (`/rota/export`, `diaryExport`): one row per stretch someone works, with paid hours and unpaid
    break minutes. **Copy** and **Share with staff** as before (`copyPlan`, `shareWeek`).
  - Not yet in the diary: other modules' sessions (Academy) as needs.
- **Today** (`/rota/today`, duty managers): the whole site, every department. Five figures
  (gaps left, on now, starting in three hours, off today, to update in Timepoint), then **Gaps to
  fill** first, soonest first, each with its best three fits and a plus that puts them on
  (logged as covering an absence, or filling a gap in the plan) and "Everyone who could".
  Then On now and Coming up (three hours) under them; Off today, Changes today with what is
  still to update in Timepoint, and the day note in a column beside them from 1100px.
- **Bookings** (`/rota/bookings`): **Staff each kind needs** (`RotaBookingKind`, owner, 20 October
  2026: "bookings need staff per booking type", a party yes, lane hire none): per organisation, the
  number a new booking of that kind starts with; 0 means it needs nobody, so it never shows as not
  covered. Three figures (running, days to come, places to fill), then
  running bookings apart from finished ones, a table from 1024px with how much of each is filled.
  **Change** (owner request, 13 October 2026) edits a booking with the same form: only its days
  still to come change, and its first day stays once it has started. Days it no longer runs leave
  the plan (people on them are told), new days are added, and kept days take only the fields that
  changed, so a day changed on its own on the Plan keeps the rest. Times and places shrink only
  past the people already on a day, as on the Plan.
- **5-minute steps** (owner decision, 11 October 2026): bookings, activities, people on them and
  shifts start and end on a 5-minute step, like breaks, so a booking can last 10, 15, 25 minutes or
  any other multiple of 5. The time pickers move in 5-minute steps and the save actions refuse
  anything else (`slotProblem` in `shared/constants.ts`).
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
middle (one), a third and three fifths (two), or quarters (three). With no free time, a
break is suggested during the person's time on an **area's own need** (below) only: where the
area is least short without them, so two people on it are not away at once when that can be
helped, and that time shows as a place to fill. Elsewhere a break never takes someone off an
activity, a booking or a class: the shift says
"Breaks to place" and the planner leaves a gap (which then needs cover) or the duty manager
arranges it on the day. Unpaid breaks come off the paid hours whether placed or not.

## Each area's own needs (owner requests, 16 October 2026)

"In addition to bookings and activities, each area has their needs. For example, the 25 meter
pool has a time to be open, and during that time it will need a specific amount of staff with
specific qualifications." Admin, Areas sets each area's needs: lines of how many, the role it
asks for and who can fill it (`SiteAreaStaffing`: a position from Admin, Positions, and a
qualification they hold, or anyone), every day's opening hours
(`SiteArea.openFrom`, `openUntil`) and any weekday's own hours or closed (`SiteArea.weekHours`;
`hoursOn` in `src/lib/setup/area-staffing.ts`). An area with staff lines and no hours needs
nobody yet.

The need is named by its role, not its certificate (owner request, 20 October 2026: "If its a
pool, i should need cover from lifeguards, not from RLSS National Pool Lifeguard cert, thats the
cert required for an activity"). The qualification still decides who can fill it, and still keys
the need and its people, so roles the same people can fill share one need ("Receptionist or Duty
manager on duty"). A line from before roles (`positionId` empty) takes the open role needing its
qualification that most people hold (`roleFor`); saving the dialog stores what it shows.

On each day it is open, `buildDay` turns each line into an activity on the Plan in its own
right, "Lifeguard on duty" in that area for its hours with as many places as the line asks for, on
every department's plan (`ANY_DEPARTMENT`) and first in its area. Its ids say whose it is
(`area:<area>:<qualification or *>`, plus `:<date>` for the need; `areaNeedOf`). Only the
people put on these places count: staff on a booking, an activity or a swim class in the area
do not fill its need. They are stored in `RotaAreaAssignment` (the area, date, qualification,
place, person and time; the need itself is never stored, so changing Admin, Areas changes every
day ahead). Someone without the qualification shows a warning and is never refused.

Putting people on works as on any activity (`assign`, `unassign`, `handOver` route `area:` ids
to their area versions): click a gap, or take it from someone's open options. From a
department's plan the time also goes on the person's shift there, as a swim class does
(`shiftForClass`), so they show on that plan. Their breaks are spread so the area is least
short (`staffing.ts`); each break leaves that place to fill for its time ("Aoife's break"), on
the Plan and Today's gaps, and choosing someone for it hands that stretch to them. Turnfin Me,
the person's file, double bookings, under-18 rest and "Who can fill it" count this time too.

**Covered from another area** (owner request, 16 October 2026: the main and learner pools share
a hall and the 18 m pool is behind a door; when both are open "we might just need one lifeguard
sitting between both areas by the door"). In an area's Staff needed dialog, "Covered from another
area" names the other area, a type of staff this area needs and how many in all
(`SiteArea.together`, JSON `[{ withAreaId, count, typeId }]`). While both are open that day, this
area's places of that type are not needed (no gaps) and the other area's need of that type has
the joint number of places: extra places only for the joint time, or its own extra places left
off then. Both rows say so on the Plan ("Covered from Main hall 09:00–21:00"). Bookings and
activities still add their own. `areaNeedsOn` in `shared/area-needs.ts` works this out once, for
`buildDay`, break placement (`areaMinimumsOver`) and the actions (`areaNeedFor`).

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
- The swim school's side: `src/modules/activities/module.ts` (`list` and `plan`)
- UI: `src/app/rota/`, which imports only the feature entries;
  Turnfin Me `apps/me/src/app/shifts/page.tsx`
- Tests: `cover.test.ts`, `shifts.test.ts`, `day.test.ts`, `view.test.ts`, `rota.test.ts` (end to end on a throwaway database),
  `src/modules/activities/__tests__/commitments.test.ts`, `src/lib/staff-api/api.test.ts`
- Sandbox: `scripts/sandbox-seed.ts` seeds a planned week at Hillview (sign in as sam@ for
  Plan, maya@ for Run)

## Retired

The roster upload (1 October 2026) and the person-first week sheet and day planner
(3 to 5 October 2026) are gone. Their records are not migrated (owner decision: start
fresh).
