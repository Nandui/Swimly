# Turnfin Rota

Who is on shift, where and when, with a warning when someone's qualification
won't cover the shift. It lives in the main database and uses the platform
access model (docs/platform-access.md).

## Surfaces

- **Rota workspace** (`/rota`, Poolside Clear on the shared `ModuleShell`). This
  is a week view, Monday to Sunday, for one site at a time. It opens for anyone
  with the Rota screen and `rota.view` at any scope. It shows only the sites that
  capability covers; any other site is a 404.
- **Absences** (`/rota/absences`, rota managers only). Who is off now or soon,
  and who came back in the last 30 days. **Report absence** records a person, a
  reason (sickness, family emergency, bereavement or other), the first day off and,
  if known, the last. **Back at work** sets the last day off; the bin removes one
  recorded in error.
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
come from `ROTA_WARNING_META` and `RotaWarningTag`, each with its own icon:

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

Reasons come from `ABSENCE_REASON_META`, each with its own icon in `AbsenceReasonTag`.
One absence at a time per person: overlapping days are refused. Reporting your own
absence from Turnfin Me is not built yet.

## Files

- Schema: `RotaShift` (`prisma/migrations/20261001120000_rota`), `RotaAbsence` (`prisma/migrations/20261005120000_rota_absence`)
- `src/lib/rota/`: `access.ts`, `data.ts` (the week), `mine.ts` (own shifts), `actions.ts`, `constants.ts`
- Self-service: `src/lib/rota/mine.ts` (staff API); UI: `src/app/rota/`, `src/components/rota/`; shift-change emails from `src/lib/staff-api/reminders.ts`
- Tests: `src/lib/rota/rota.test.ts`

## Uploading the week's roster (29 September 2026)

Rota managers upload the payroll system's weekly export (RosterBrowser, `.xlsx`, one sheet
"Roster for <year>-W<week>") at **Upload roster** (`/rota/import`). One file covers both sites.

- **Reading it** (`src/lib/rota/roster.ts`, pure and tested): EmpNo, EmployeeName, then a time
  range or a code and a department code per day. A second shift on a day is a second row.
  `FHOP` is a full holiday, paid; any other code is kept as leave with its code. An overnight
  shift ends the next morning. Anything unreadable is listed and left out, never guessed.
- **Check, then import.** Checking writes nothing: people (new, and how many have a login),
  shifts per site, holidays, and for a re-upload what changes. Importing reads the file again.
- **Departments** (`/rota/departments`): each code belongs to a site and has a name the rota
  shows. An upload with a new code waits until someone says where it works. Moving a code moves
  its imported shifts.
- **Everyone by name.** `RotaPerson` holds each employee number and name, login or not. It links
  to an account when exactly one active account has the same name (the roster writes the
  surname first and "O Halloran" for O'Halloran), so that person sees their shifts in Turnfin Me.
- **Re-uploading a week** replaces its imported entries (the old ones are cancelled, not
  deleted) and records each person-day that was added, removed or changed as `RotaChange` rows,
  shown at **Roster changes** (`/rota/changes`). Shifts added by hand are never touched, and
  imported ones are changed by uploading again, not edited.
- **Absences** can be reported for anyone on the roster, login or not (an absence names an
  account, a roster entry, or both). Their shifts show Absent on the week. Roster holidays show
  on Absences as "On holiday in the next two weeks": planned, so nothing to report.
- Needs `rota.manage` at every site the file's departments map to. Holiday and leave days are
  not shifts: they never count as on shift, as unfilled, or in Turnfin Me.
