# Turnfin Staffing

*Built 4 November 2026 from the swim teacher rostering specification ([D27](decisions.md)); lifeguards from 9 November 2026.*

Staffing rosters the centre's part-time pool staff, swim teachers and lifeguards, on their contracts (owner, 9 November 2026: the specification was written for swim teachers, but lifeguards are part-time pool staff too, rostered the same way; [D28](decisions.md)). Contracted hours go where the centre needs them; preferences guide but never limit. Every change to a published shift goes through one route (a swap, an absence or a manager with a reason), and attendance breaches become strikes on the handbook's ladder, the same way every time.

**Warnings, never blocks** (owner's choice, 4 November 2026). A missing qualification, short rest, the weekly cap, an overlap or a place their contract does not cover (a lifeguard place for a swim teacher, a teaching place for a lifeguard) shows as a warning, and the supervisor decides. The process rules do refuse, because they are the process:

- a published shift changes only through a swap, an absence or Manage with a reason (BR-2.4);
- nothing is published under the minimum notice of 24 hours (BR-2.3);
- swaps close 48 hours before the shift; after that, they phone the duty manager (BR-5.2);
- publishing with people below their contracted hours needs a note saying why (BR-3.8).

## The model

| Concept | Table | What it is |
| --- | --- | --- |
| Staff | `StaffingTeacher` | Someone on the rota, offered for places: their college (UCC, MTU or none) and contract type (swim teacher, lifeguard, or swim teacher and lifeguard). The table keeps its first name. Contracted hours, date of birth and qualifications stay on the platform (Staff page, Qualifications). |
| Slot | `StaffingSlot` | A weekly place to fill at a site: weekday, role (teaching, lifeguard, float), times, how many. Archived, never deleted. |
| Block | `StaffingBlock` | Two weeks at a site, Monday to Sunday. Draft, then published. |
| Shift | `StaffingShift` | One place on one day, for one person or nobody. Its status: on, approved absence, called off, late, sent home, no call no show. A cover is its own shift (`coversId`), so the away record is kept. |
| Acknowledgement | `StaffingAck` | Each rostered person's acknowledgement of a published block, and the supervisor's phone call. |
| Swap | `StaffingSwap` | Requester, taker (or "Looking for cover"), the supervisor's decision and the warnings the taker had. |
| Attendance | `StaffingAttendance` | What the duty manager logged: a call-off (time, method, reason, on time), a late arrival, a no-show. |
| Strike | `StaffingStrike` | A breach: semester, number, cause, stage, whether it counts, when the owner's step is due, and the note when it is done. Withdrawn, never deleted. |
| Exam season | `StaffingExamSeason` | A college's exam period. The absence deadline is worked out (start minus 21 days). |
| Exam absence | `StaffingExamAbsence` | Someone off a shift for an exam, with the date on the college's notice, and its outcome. |
| Settings | `StaffingSettings` | Every number marked (config) in the spec, for the organisation; only Manage changes them, never below the legal 11 hours' rest or 24 hours' notice. |

The rules are pure functions in `src/modules/staffing/shared/rules.ts`, tested on their own (`rules.test.ts`, including the spec's acceptance criteria): semesters, publish deadlines, call-off judgement, the strike ladder, exam outcomes, swap timing, acknowledgement states, the warnings on a shift and who could take one.

## Levels and permissions

| Level | Permission | Who | Lets you |
| --- | --- | --- | --- |
| View | `staffing.read` | anyone | see blocks, today's shifts, swaps and exam absences at their sites |
| Run | `staffing.run` | duty manager | log call-offs, late arrivals and no-shows, cover gaps, see strikes and record return-to-work chats |
| Supervise | `staffing.supervise` | pool deck supervisor | keep slots and the staff on the rota, build and publish blocks, record acknowledgements, swaps and exam absences, hold second strike conversations |
| Manage | `staffing.manage` | centre manager | change published shifts with a reason, record formal and no-show referrals, withdraw a strike, keep exam seasons and settings |

Everything belongs to a site: pages limit themselves to the sites the level covers (`sitesFor`) and every write checks the record's site (`atSite`, `mayFor`). Strikes are disciplinary records: only Run and above at the site see them.

## The screens

- **Blocks** (`/staffing`): the next publish deadline with its countdown or overdue alert, starting a block on one of the next Mondays, and every block with how full it is and how many acknowledged. A new block takes every slot on each day, with the people from the same place in the block before when they are still on the rota.
- **A block** (`/staffing/blocks/[id]`): one day at a time (the strip counts empty places), each place with who is on it and their warnings; **Choose** lists everyone on the rota best first: nothing serious in the way, then below their contracted hours that week, then those wanting extra hours with no strikes, then the rest. Then **hours against contract** for each week, **Publish**, and once published **acknowledgements** with Reminder due at 24 hours and Phone them at 48.
- **Today** (`/staffing/today`): places that need cover first (nobody on them, or their person away with no cover), with **Cover**; every published shift with **Log** (called off with the time and how, late with minutes and sent home, or no call no show); and the return-to-work chats due.
- **Requests** (`/staffing/requests`): swaps to decide (flagged after 24 hours or over the giveaway limit), swaps looking for cover, exam absences (flagged at the third short-notice clash in a semester), the exam seasons ahead with their deadlines, and decided swaps.
- **Strikes** (`/staffing/strikes`): what is due, soonest first, with the owner's step; then each person's strikes this semester or last.
- **Set up**: Slots and Staff (`/staffing/staff`: who is on the rota and their contract; Supervise, per site), Exam seasons and Settings (Manage).

## The rules, as built

- **Contracts** (D28): a swim teacher contract covers teaching places, a lifeguard contract lifeguard places, and swim teacher and lifeguard both. A float is anyone's, and needs the qualification of the work their contract is for (a lifeguard's float, the lifeguard qualification). Anything else is the "Not on their contract" warning.

- **Call-offs** (BR-6.2, 6.3): only a phone call to the landline counts. A late shift's call is due by 09:30 that day, an early shift's by 18:00 the day before; in exceptional circumstances (the duty manager ticks it) a call an hour or more before the shift is in time. A shift starting at or after 12:00 is a late shift (an assumption until open question 2 is answered; it is a setting).
- **Strikes** (BR-6.4 to 6.8, 8): an on-time sick call is never a strike. A late call-off, a short-notice absence that is not sickness, arriving over an hour late, an exam absence after the deadline or under 48 hours, a no-show and a no-show on a shift taken in a swap are. The number counts this semester's counted strikes: 1 a return-to-work chat on the next shift (Run), 2 a second informal with a note signed by both within 7 days (Supervise), 3 a formal referral to HR (Manage). A no-show, or an exam absence with no college notice, goes straight to a serious misconduct referral. Strikes before the counting date (25 January 2027) are logged, not counted.
- **Swaps** (BR-5): the shift stays with the requester until approved; on approval the taker owns it, strikes included. An open request expires 48 hours before the shift.
- **Exams** (BR-7.4): on time with the notice, or the college's own short notice: approved, unpaid, no strike. After the deadline but 48 hours or more ahead: approved, strike. Under 48 hours: approved, strike. No notice: refused, referral.

## Not built yet

- **Turnfin Me**: staff acknowledging, asking for swaps and exam absences, and seeing their own shifts and strikes themselves. Work records them for staff until then.
- **Preferences and mismatch meetings** (BR-9), partial availability and split lanes (BR-3.10 to 3.12), the second float in exam season (BR-7.7), annual leave and medical certificates (BR-6.1, 6.5).
- **Notifications** by email, the Google Chat post (BR-5.9), the Monday checklist and the monthly report.
- **The spec's open questions** stand: Timepoint, early versus late shift, programme block times and other centres' grids, teaching ratios, under-18 limits (the warning only says "Under 18" and uses 12 hours' rest), MTU's timetable timing, clock-in data and HR's sign-off.

## Files

- Schema: `prisma/schema/staffing.prisma`; migration `20261214090000_staffing` (additive: eleven `staffing_*` tables, and the 2026-27 exam seasons for each organisation).
- `src/modules/staffing/`: `shared/rules.ts` (pure), `shared/server.ts` (sites, the pool staff, settings, recording a strike), `shared/access.ts`; features `blocks`, `today`, `requests`, `strikes`, `setup`, `workspace`.
- Routes: `src/app/staffing/`.
- Tests: `shared/rules.test.ts`, `__tests__/staffing.test.ts` (end to end on a throwaway database).
