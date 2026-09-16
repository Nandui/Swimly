# Assessments and awaiting enrolment

Assessments has two linked desk pages. Awaiting enrolment is an independent
sidebar destination, covering assessment follow-up and all class waitlists.

| Page | Purpose | Access |
| --- | --- | --- |
| `/assessments` | Today/upcoming sessions, booking counts and swimmer rosters; past sessions remain accessible. | Assessments screen |
| `/assessments/setup` | Create sessions, browse past/cancelled sessions and open setup. | Assessments screen + `courses.manage` |
| `/awaiting-enrolment` | Assessed swimmers awaiting a class and all class waitlists at the selected site. | Awaiting enrolment screen; actions need `enrolment.manage` |

`/assessments/[id]` remains the booking roster and placement page. Session editing,
cancellation and parent publication are at `/assessments/[id]/setup`. Both reject
the wrong working site. Instructor routes remain separate.

Administrators receive the new screen automatically; other roles need its explicit
screen grant. Profile and assessment links respect their separate screen grants.
Old `/assessments/awaiting-enrolment` bookmarks redirect to the new page, preserving
search and page number and checking the new grant first.

## Awaiting enrolment

The queue combines two independent reasons for follow-up for active swimmers:

- An ATTENDED assessment with a saved outcome level and no subsequent class place
  in that shared programme. Use the newest assessment across site aliases; the
  assessment site owns the follow-up. A booking or no-show alone is not a result.
  A recorded outcome survives cancellation of its session.
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
when its enrolment is promoted, transferred or withdrawn. No new database table,
migration or manual completion flag is needed.

Enrolment, assessment, student and class changes invalidate the new page.

## Verification

- `src/lib/enrolment/data/awaiting-enrolment.test.ts` uses real Prisma reads in
  isolated PGlite: assessment eligibility, site/programme aliases, historical
  resolution, unassessed waitlists, existing class places, multiple requests,
  deduplication, search, pagination, privacy and authentication.
- Navigation/screen tests cover the independent grant, administrator access and
  the Instructor boundary. Existing enrolment action tests cover capacity/audit.
- `node scripts/check-assessment-workspace.mjs` exercises real UI components with
  synthetic data and blocked server actions: navigation, dialogs, search/pagination,
  empty/restricted views, keyboard access, touch targets and four widths in both
  themes. Set `PLAYWRIGHT_MODULE` to the bundled Playwright module if needed.
- Run typecheck, lint and an optimized build with `VERCEL_ENV=development` to skip
  database migrations. Never seed or mutate live records to test these screens.
