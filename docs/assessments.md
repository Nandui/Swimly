# Assessments and awaiting enrolment

Assessments has two linked desk pages. Awaiting enrolment is an independent
sidebar destination, covering assessment follow-up and all class waitlists.

| Page | Purpose | Access |
| --- | --- | --- |
| `/assessments` | Today/upcoming sessions, booking counts and swimmer rosters; past sessions remain accessible. | Assessments screen |
| `/assessments/setup` | Create sessions, browse past/cancelled sessions and open setup. | Assessments screen + `courses.manage` |
| `/awaiting-enrolment` | Assessed swimmers awaiting a class, swimmers the desk added by hand, and all class waitlists at the selected site. | Awaiting enrolment screen; actions need `enrolment.manage` |

`/assessments/[id]` remains the booking roster and placement page. Session editing,
cancellation and parent publication are at `/assessments/[id]/setup`. Both reject
the wrong working site. Instructor routes remain separate.

Administrators receive the new screen automatically; other roles need its explicit
screen grant. Profile and assessment links respect their separate screen grants.
Old `/assessments/awaiting-enrolment` bookmarks redirect to the new page, preserving
search and page number and checking the new grant first.

## Awaiting enrolment

The queue combines independent reasons for follow-up for active swimmers:

- An ATTENDED assessment with a saved outcome level and no subsequent class place
  in that shared programme. Use the newest assessment across site aliases; the
  assessment site owns the follow-up. A booking or no-show alone is not a result.
  A recorded outcome survives cancellation of its session.
- A swimmer added by hand (`ManualPlacement`, owner request 20 October 2026):
  **Add a swimmer** (needs `enrolment.manage`) takes an existing swimmer, a live
  level and a required reason, for a swimmer who needs a class without an
  assessment. It belongs to the working site, is treated exactly like an
  assessment placement dated the day it was added (the newest of the two for a
  programme stands, a class place in the programme resolves it), and the row says
  "Added by hand" with who, when and why. Adding the same swimmer again for the
  programme replaces the earlier entry. A swimmer who already has a class in the
  programme is refused (use Awaiting moves). **Take off the list** marks the entry
  removed, with an optional reason; entries are never deleted. Both actions write
  `add-awaiting` / `remove-awaiting` audit rows on the swimmer, so they show in
  the swimmer's history. A hand-added level does not count as earned when
  enrolling: placing above the levels they have earned still asks for a reason.
- Every outstanding WAITLISTED enrolment at the requested class's site. No
  assessment is required. A swimmer can already attend another class, or have
  several waitlist requests. Archived class requests stay visible but cannot be
  promoted here. Inactive swimmers are excluded.

One row per swimmer/shared programme combines pending assessment details with
all their local waitlist requests. An assessment at the other site does not hide
a local waitlist. Swimmer home site does not determine which list they appear in.
The oldest assessment/waitlist request sets the waiting date and sort order.
Search matches name tokens and member numbers; pages contain at most 20 rows.
Only the current page's contact details are selected, never medical notes.

A class place in the same shared programme at either site resolves assessment
follow-up, including future starts. An enrolment started after the assessment or
ended on/after it also resolves that historical follow-up, so leaving a class does
not bring an old assessment back. Enrolments ended before a new assessment do not
hide it. Waitlists do not resolve assessments; withdrawn waitlists use existing
waitlist/enrol audit actions to distinguish an unfulfilled request from a place.
Resolving an assessment never removes outstanding class waitlists.

An assessment placement offers classes at the recorded level across sites, excluding
classes already listed in this row's waitlists. Available waitlisted classes offer
Enrol from waitlist with confirmation. Existing actions recheck permissions,
status, capacity and locks, and write audit rows. Each request disappears only
when its enrolment is promoted, transferred or withdrawn. Queue membership is
derived from these records; only a hand-added entry can be taken off by hand.

Enrolment, assessment, student and class changes invalidate the new page.

## Reception follow-up history

Enrolments and waitlists and Awaiting moves each show the latest outcome, recorder,
recording date and optional next follow-up date for the swimmer. Overdue dates
are labelled explicitly. Follow-up history opens the complete contact/work log;
it is also available from the swimmer profile after a place is arranged.

Staff can record a phone call, email, in-person conversation, text message or
internal work. Each update requires a note and contact/work date, with one of:
Contacted, No reply, Parent not ready, No suitable class, Awaiting parent response,
or Ready to enrol. An optional next date replaces the previous reminder; leaving
it blank clears that reminder. An overdue date is not carried into a fresh form.
This records work already done: it sends no message and does not change any
assessment, waitlist, readiness or enrolment status. The existing enrolment and
move actions still determine when a row leaves the queue.

History is per swimmer, shared across all sites/programmes, and remains available
after enrolment or inactivation. Entries cannot be overwritten/deleted through
the app; corrections are another update. Newest recorded entries appear first
while retaining their original contact date. Reads require the Awaiting enrolment
or Swimmers screen; writes additionally require `enrolment.manage`. Staff with
read-only access can inspect history. Nothing is exposed through the parent API.

Deploy the additive `20260923170000_enrolment_follow_up` migration before the
new reads run. `StudentFollowUp` stores staff and site snapshots, an ordered
sequence and an idempotency key per swimmer. A swimmer row lock plus the expected
latest sequence prevents stale concurrent saves. The follow-up and its Student
audit entry commit in one transaction. Retrying an identical save does not create
a second entry. Reloading after a conflict preserves unsaved form values for
review. Unsaved text is held on the current page only, not across a page reload.

## Verification

- `src/modules/activities/features/enrolment/server/data/awaiting-enrolment.test.ts` uses real Prisma reads in
  isolated PGlite: assessment eligibility, site/programme aliases, historical
  resolution, unassessed waitlists, existing class places, multiple requests,
  deduplication, search, pagination, privacy and authentication.
- Navigation/screen tests cover the independent grant, administrator access and
  the Instructor boundary. Existing enrolment action tests cover capacity/audit.
- `src/modules/activities/shared/enrolment/actions/follow-up.test.ts` uses isolated PGlite for access,
  cross-site history, validation, attribution, atomic audits, concurrent stale
  updates, idempotent retries, history pagination and retention. Queue tests also
  check that contact outcomes never remove an assessment/waitlist request.
- Run typecheck, lint and an optimized build with `VERCEL_ENV=development` to skip
  database migrations. Never seed or mutate live records to test these screens.

### Reception queue layout

Awaiting enrolment and Awaiting moves use compact swimmer rows. Each shows the
swimmer, programme/level, placement status, next follow-up date and a two-line
preview of the latest contact or note, including outcome, contact date, method
and staff member. A shadcn Collapsible opens class placement and family details
alongside an integrated contact timeline. Full notes, outcomes, authors, original
contact dates, recorded dates and next follow-up dates stay visible in that row.

Add contact or note opens the existing form inline, above the timeline. Phone,
email, in-person, text and internal work/notes use the same saved history. Older
entries load with Load earlier updates. Opening a row loads fresh history;
collapsed rows do not request histories. Reload is available after errors and
preserves drafts. Hiding the form or closing the swimmer preserves unsaved text.
The swimmer profile retains its existing history Sheet with focus restoration.
Phone and email links use the device's contact applications.

Queue membership, oldest-first ordering, pagination, permission gates and all
placement actions are unchanged. Follow-up updates still use the original
permission, concurrency and audit checks. No messages are sent by saving.

Check the queues in a branch preview at 375, 768, 1024 and 1280px in both themes.
