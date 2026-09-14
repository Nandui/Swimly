# Staff help centre

`/help` is the signed-in staff manual. The desk sidebar (including its collapsed
rail) and phone toolbar have a Help centre link. Instructor has a Help link to
`/help/instructor`. Both open a new tab so an in-progress form stays open.

The manual has 36 authored guides: 34 available in the desk library and 9 in
Instructor, including shared guides with workspace-specific steps. Topics cover
navigation and sites; swimmers and contacts; enrolments, moves, waitlists and
sibling times; classes and Schedule; teaching and progression; assessments;
cancellations and billing handoffs; analytics; staff, roles, curriculum and sites;
and account or save troubleshooting. Guidance describes the current app rather
than promising email, refunds, offline saves or automatic moves that it does not
provide.

Every guide includes screenshots of the current app beside the steps they
illustrate, with descriptive alternative text, captions and a full-size link.
The 39 screenshots use synthetic people and records and show light appearance.
They remain visible when printing a guide.

## Access and navigation

- The help layout, page and metadata path all require `pageSession()`. Direct
  article requests are authenticated. The help routes are dynamic and carry
  `noindex, nofollow` metadata. There is no public documentation endpoint.
- Help is a utility like Account and needs no additional screen grant. Reading
  a guide does not grant any operational permission.
- Instructor help requires the Instructor screen and its attendance permission.
  An Instructor-only account visiting desk help is redirected to its own library,
  preserving an article only if it exists in that scope. Legacy grants use the
  existing screen resolver.
- Instructor search, related guides and task links remain scoped to teaching.
  Its return link is Classes. Desk return links resolve to an allowed desk home.
  Open-in-app links check screen grants and their required permissions, including
  inherited administrator access.
- Search and topic selection are stored in bounded `q` and validated `topic`
  parameters. Search ranks title and task vocabulary above incidental mentions
  in the full text. Enrol/enroll, transfer/move, register/attendance and the common
  sibling spelling variant are normalized. There is an explicit empty state.
- Article return links preserve search state. Copy link strips search text and
  filters; recipients still need to sign in. Printing includes instructions and
  troubleshooting while removing navigation and tools.
- Screenshots are stored outside `public` in `assets/help`. Their
  `/help/images/[id]` handler independently checks authentication, allows only
  catalogue IDs and returns private, non-cacheable images. Next Image uses
  `unoptimized` so requests retain the staff session. The route's file tracing
  explicitly includes the PNGs in deployments.

## Updating a guide

Content is typed data in `src/lib/help/guides-*.ts`. Add each guide to a catalogue
group with a unique stable slug, title, summary, topic, scope, keywords,
prerequisites, numbered steps, expected result, troubleshooting and related slugs.
An optional action identifies an existing screen; never store an arbitrary
external destination or assume that a role has access. Scope individual steps
when desk and Instructor instructions differ. `catalogue.ts` filters the body and
related links before building an index or article for that workspace.

When changing a workflow, update its guide in the same change. Verify labels
against the component and behaviour against the server action. Use only synthetic
examples; never place customer data in the manual. Keep the app's brand name out
of prose so a rename does not require rewriting guides.

| Content source | Check against |
| --- | --- |
| `guides-start.ts` | Workspace shells, site switcher, Account, permissions and save/draft handling |
| `guides-swimmers.ts` | Swimmer profile and edit form, enrolment dialogs/actions, Together |
| `guides-classes.ts` | Classes and Schedule, desk/Instructor teaching forms, progression, assessments |
| `guides-management.ts` | Duty manager, cancellation queue, Analytics, curriculum, Staff, Roles, Clubs and Activity |

## Updating screenshots

`scripts/help-screenshots/fixture.jsx` renders the real app components with data
from `data.mjs`. The isolated bundle replaces server actions, authentication and
routing; mutations throw, data reads use synthetic fixtures and browser requests
are restricted to the local fixture. It does not connect to the database.

Run `node scripts/help-screenshots/capture.mjs` with Playwright and Chrome
available. If Playwright is supplied by the workspace runtime rather than the
project, set `HELP_PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. Optional
`HELP_CAPTURE_ONLY` accepts comma-separated screenshot IDs for a targeted refresh.
The script builds into ignored `.impeccable/review/help-screenshots`, then writes
PNGs and their measured dimensions to `assets/help/manifest.json`.

Review regenerated images for legibility and relevant open controls. Keep all
example names, contacts and records synthetic. `src/lib/help/screenshots.ts`
attaches images by guide slug, exact step title and optional workspace scope;
update these anchors when renaming a step. Write captions around the user's task
and alt text around the visible controls. Never capture a live customer session.

## Verification

`npx tsx --test src/lib/help/help.test.ts` checks catalogue integrity, scope,
search vocabulary, URL state, authentication boundaries and permitted task links.
It also checks that every scoped guide has a screenshot, step anchors exist,
asset dimensions match their PNGs and image delivery requires a session.
Run typecheck and lint as usual. Use `npx next build` for an isolated compile;
the release build script also runs migrations and is not needed for help edits.
Browser checks use the actual components with synthetic staff and isolated
actions; cover search, filters and recovery, browser history, article links,
copy success/failure, print, full-size screenshots, keyboard operation, shell entry points and both
themes at 375, 768, 1024 and 1280 pixels. No database writes are needed.
