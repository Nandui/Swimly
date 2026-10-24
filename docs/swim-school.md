# Swim school: the rules that hold the domain up

The swim school app's core rules, and why they are the way they are. The screens are in the docs listed under Swim school in [README.md](README.md); who sees which swimmer fields is in [platform-access.md](platform-access.md#who-sees-which-swimmer-fields); the pool deck is in [instructor.md](instructor.md). Code: `src/modules/activities`.

Programmes hold ordered levels; a level is defined by the competencies a swimmer has to pass; a class (`Course`) teaches one level at a fixed weekly slot; a swimmer (`Student`) is enrolled into a class; a register is taken on the pool deck; and a level is completed when everything is signed off and somebody confirms it.

## The four decisions

**1. "Current level" belongs to a swimmer in a programme, never to a swimmer.** A swimmer can be in Learn to Swim and in Squad at once, so a screen saying "Level 4" without saying which ladder is guessing. `Enrolment` therefore pins `levelId` and `programmeId` at enrolment time. They are not a cache of the class's level: they are the level the swimmer was placed at, which must not move when a class is re-badged. Everything else (eligibility, graduation, the current rung) is derived in `src/modules/activities/shared/progression/rules.ts` and stored nowhere.

**2. Curriculum rows are archived, never deleted** (`archivedAt`). For a competency, when it was retired answers "was this required when the swimmer was assessed?". One rule keeps a curriculum edit from rewriting the past: **`LevelCompletion` is the truth for "done"**, so eligibility is only computed for swimmers who have not completed. Otherwise adding a competency would un-complete a whole cohort. Each completion also freezes `competenciesAchieved` and `competencyCount`, so months later you can still tell whether it was earned.

**3. Capacity is held by a row lock, not a re-count.** A transaction that merely counts again does not fix the race: at READ COMMITTED two transactions both read 11 and both insert. `withCourseSeat` in `src/modules/activities/shared/enrolment/seat.ts` takes `SELECT … FOR UPDATE` on the class row first, which also makes the "already enrolled here?" check race-free. That is why there is no unique constraint on `(studentId, courseId)`, and why repeating a level is possible at all. **Nothing else may create an active enrolment**: a second write path that forgets the lock brings the race back.

**4. Classes are rolling and weekly.** Attendance is keyed on class, date and swimmer: the weekday must match, the date cannot be in the future and the swimmer must belong on the register. Dated cancellations live in `ClassCancellation`, which freezes the class details and affected roster for billing. Cancellation, class starts and teaching saves share the class lock; a cancelled occurrence cannot accept later teaching saves. `ClassNote` stays free text. See [duty-manager.md](duty-manager.md).

## Placing and moving swimmers

**Placement needs `enrolment.manage`, with a reason on the row.** Placing a transfer-in or an adult beginner out of sequence is routine. Putting it behind a rarer permission would either get that permission handed to the front desk, or tempt someone to fake a completion. So `enrolStudent` takes a `placementReason` and stores it on the enrolment, not only in the audit log, because the instructor on the deck is exactly who needs to know why this child is in Level 5.

**Moving up is gated on the completion, not on the last tick.** Passing every competency makes a swimmer eligible; a person still confirms they are done. "Move up to <next level>" appears only once that confirmation exists, on the swimmer's profile and the class assessment screen. The move reuses `transferEnrolment`, so the old place closes and a new one opens: attendance hangs off class, swimmer and date, and re-pointing the enrolment would orphan every register they were on.

**Legend agreement confirmation belongs to the class place.** New enrolments ask an explicit Legend agreement question with nothing pre-selected. Pending agreements do not block enrolment. Existing places read **Needs checking**: missing information never means done. Moves carry the prior state and who confirmed it. Confirming uses `enrolment.manage` and the class lock, and writes the audit row in the same transaction. See [legend-agreements.md](legend-agreements.md).

## Teaching on the deck

**Teaching is confirmed, shared and recorded.** Every instructor confirms Start class before opening a class on the deck, including their own. Confirmation creates a `ClassCover` row for that class and date, with an audit entry, in the same class-locked transaction; the unique class and date key keeps the original start, so repeated or simultaneous confirmations neither overwrite it nor duplicate its audit. Every authorised instructor can then open the started class, even if the original instructor's account has gone. Attendance, competencies and completion recheck the dated start and permissions under the class lock, and each save records its actual author. Desk transcription keeps `attendance.markAny` without giving pool deck access.

**Writes are batched, on purpose.** The register and the assessment checklist each save as one action carrying the whole class. Next runs server actions one at a time per client, so a save per tap would queue on poolside wifi. Batching also means a dropped connection leaves the marks in the tab, ready to retry. The register mirrors itself, with its class note, into `localStorage`, so drafts survive a closed tab where browser storage works (a warning says when it does not). Drafts are scoped to class and date. A save that hangs offers a retry after 15 seconds and says it is unconfirmed, since a timeout does not cancel a server action. Neither save writes an audit row when nothing changed.

**A save carries the version it started from.** That revision is derived from the class, date, saved marks and class note; it needs no column. The action checks it under the class lock and writes the register and audit together. If someone else saved a different version, the action returns the saved values without writing, and the deck shows both so the instructor can keep the saved register or save theirs on purpose. An identical retry succeeds without rewriting records or adding audit rows. Browser drafts keep their original revision through reloads; older drafts must go through the comparison before they can replace a saved register.

## Who may do what on the deck

The deck's permissions are cut fine on purpose: taking your own attendance, taking over a colleague's class, marking competencies, completing a level and running an assessment session are different acts with different records, so each is its own permission. Broader ones contain narrower ones in one map in the permission catalogue (`IMPLIES` in `src/lib/staff/permissions.ts`: `attendance.markAny` gives `attendance.mark` and `attendance.cover`; `progression.override` gives `progression.complete` and `progression.assess`), never at the call site.

Two things are rules inside actions rather than permissions:
- **Whose register.** `attendance.mark` marks the classes you teach; `attendance.markAny` marks anyone's. Which classes are yours is a fact about the row, so it lives in `canMarkRegister` in `src/modules/activities/shared/attendance/access.ts`.
- **Completing a level with gaps** needs `progression.override` and a reason. Placing a swimmer at a level they have not earned is placement, above.

## Smaller rules

- **The timetable opens on today.** `/courses` with no `day` in the URL shows today's classes; the whole week is `day=any`. The filter bar writes that value rather than deleting the key, because an absent key means today.
- **Lists that grow with the club are searched, never sent.** The swimmer picker asks the server for the twenty that match what was typed (`src/modules/activities/shared/students/actions/search.ts`) and never receives the roll. Classes are few enough to travel as options; when that stops being true, they get the same treatment.
- **Sites share swimmers and the curriculum** ([shared-sites.md](shared-sites.md)).
