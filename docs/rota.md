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
  whose **return to work** is still to record, and who came back in the last 30 days. **Report absence** records a person, a
  reason (sickness, family emergency, bereavement or other), the first day off and,
  if known, the last. **Extend** runs a current absence on to a later last day
  (or to "return not known"). **Back at work** sets the last day off; the bin
  removes one recorded in error.
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

- Schema: `RotaShift` (`prisma/migrations/20261001120000_rota`), `RotaAbsence` (`prisma/migrations/20261005120000_rota_absence`), `RotaAbsenceUpdate` and `continuesId` (`prisma/migrations/20261007120000_rota_absence_updates`), return to work (`prisma/migrations/20261009120000_rota_return_to_work`)
- `src/lib/rota/`: `access.ts`, `data.ts` (the week, absences, returns due), `mine.ts` (own shifts), `actions.ts`, `constants.ts`, `file.ts` (the personal file)
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
