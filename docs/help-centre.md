# Staff help centre

`/help` is the signed-in staff manual, in its own v2 frame (the fin, "Help
centre" and the way back; DESIGN.md "Forms, search and confirmation"). Every
module frame has a Help link: at the bottom of the module bar on a desktop, and
under More in the bottom bar on phones and touch screens (not in the account
menu). The pool deck has a Help icon to `/help/instructor` in its top bar. Both
open a new tab so an in-progress form stays open.

The manual has 53 authored guides: 51 in the desk library and 10 on the pool
deck, including shared guides with workspace-specific steps. Topics cover every
part of Turnfin: navigation and sites; Home and Turnfin Me; swimmers and
contacts; enrolments, moves, waitlists and sibling times; classes and the
schedule; teaching and progression; assessments; cancellations, billing
handoffs and analytics; Refunds; Docs; Training; Rota; HR; administration
(curriculum, staff, roles and sites); and account or save troubleshooting.
Guidance describes the current app rather than promising email, offline saves
or automatic moves that it does not provide.

The Refunds, Docs, Training, Rota and HR topics (`HELP_CATEGORY_SCREENS` in
`src/lib/help/types.ts`) show only to people whose role can open that module;
their guides, and links to them, are left out for everyone else. Home, Turnfin
Me and the swim school guides show to every desk reader.

Every guide includes screenshots of the current app beside the steps they
illustrate, with descriptive alternative text, captions and a full-size link.
The 63 screenshots are taken from the sandbox's fictional people and records,
show light appearance and the v2 frame, and remain visible when printing a guide.

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
  Its top bar goes "Back to classes" and its guides say "Instructor guide". Desk
  help goes "Back to app", to an allowed desk home.
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
| `guides-management.ts` | Duty manager, cancellation queue, Analytics, curriculum, Staff, Roles (levels), Sites and Activity |
| `guides-agreements.ts`, `guides-parents.ts` | Legend agreements, parent requests, parent access and accounts, assessment publication |
| `guides-modules.ts` (Home) | The home page (`src/app/page.tsx`) and docs/staff-app.md for Turnfin Me |
| `guides-modules.ts` (Refunds) | `src/modules/refunds/components` (request form, finance actions) |
| `guides-modules.ts` (Docs) | `src/modules/docs/components` (home, library, new document, editor, reader) |
| `guides-modules.ts` (Training) | `src/modules/training/components/manage-actions.tsx`, Training pages |
| `guides-modules.ts` (Rota) | `src/components/rota` (day-plan, fill-sheet, plan-dialogs, absences) and `src/lib/rota/actions.ts` |
| `guides-modules.ts` (HR) | `src/components/hr/actions.tsx`, `src/lib/hr/constants.ts` |

Each module guide's "Before you start" names the level it needs, from
`src/modules/registry.ts`. Desk steps describe ModuleShell (page bar, tools bar
with the site picker and swimmer search, account menu, module bar or bottom
bar); pool-deck steps describe the deck's own top bar and menu.

## Updating screenshots

Every image comes from the real app in the local sandbox (`npm run sandbox`),
whose organisation, sites (Riverside and Hillview), people and records are all
invented; `scripts/sandbox-seed.ts` (`seedHelpExamples`) adds the records the
images need, such as competencies, a waitlist place, today's assessment, a
cancelled class, a parent's link request and a refund waiting for finance.
Then run `node scripts/help-screenshots/capture.mjs`. It signs in as the sandbox
people, opens each page, dialog or menu named in its plans (it never submits a
form, apart from one attendance save in the sandbox to show a save conflict) and
writes the PNGs and their measured dimensions into `assets/help/manifest.json`,
merging with the entries it did not capture. It refuses any address but
localhost. Desk pages are captured at 1280 × 800 with the frame's top bar, so
they show the fin, the page bar and the tools bar; pool-deck images at 1024 and
the phone overview at 375.

If Playwright is supplied by the workspace runtime rather than the project, set
`HELP_PLAYWRIGHT_MODULE` to its absolute `index.mjs` path, and `CHROME` to a
Chromium binary if Playwright's own is not installed. `HELP_BASE` points at
another local sandbox port. Optional `HELP_CAPTURE_ONLY` accepts comma-separated
screenshot IDs for a targeted refresh. Failures leave a screenshot in ignored
`.impeccable/review/help-screenshots`. capture.mjs is the only script that writes
`assets/help`; the isolated previews (`scripts/check-*.mjs`) no longer do.

Review regenerated images for legibility and relevant open controls. Keep all
example names, contacts and records synthetic, and never point the script at a
real deployment. `src/lib/help/screenshots.ts`
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
