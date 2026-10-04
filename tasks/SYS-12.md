# SYS-12 — Page structure parts: PageHeader, one back link, one pagination
Severity: medium | Scope: system

## Files (expected)
- DESIGN.md
- docs/classes.md
- scripts/parent-admin-preview/fixture.jsx
- src/app/(activities)/assessments/[id]/page.tsx
- src/app/(activities)/assessments/[id]/setup/page.tsx
- src/app/(activities)/cancellations/page.tsx
- src/app/(activities)/programmes/[id]/page.tsx
- src/app/(activities)/students/parent-changes/page.tsx
- src/app/(activities)/students/parents/page.tsx
- src/app/(core)/activity/page.tsx
- src/app/(core)/staff/[id]/page.tsx
- src/app/(core)/staff/details-requests/page.tsx
- src/app/(core)/staff/devices/page.tsx
- src/app/(core)/staff/organisation/page.tsx
- src/app/docs/docs.css
- src/app/docs/poolside.css
- src/app/hr/reviews/[id]/page.tsx
- src/components/docs/document-editor.tsx
- src/components/docs/history.tsx
- src/components/docs/new-document.tsx
- src/components/docs/reader.tsx
- src/components/refunds/queue.tsx
- src/components/shadcn/breadcrumb.tsx
- src/components/ui-kit/back-link.tsx
- src/components/ui-kit/link-pagination.tsx
- src/components/ui-kit/page-header.tsx
- src/lib/help/guides-classes.ts
- src/modules/activities/components/attendance/class-session.tsx
- src/modules/activities/components/courses/class-browser.tsx
- src/modules/activities/components/courses/class-detail.tsx
- src/modules/activities/components/enrolment/awaiting-queue.tsx
- src/modules/activities/components/enrolment/legend-agreements.tsx
- src/modules/activities/components/instructor/assessment-session.tsx
- src/modules/activities/components/instructor/class-session.tsx
- src/modules/activities/components/parents/access-requests.tsx
- src/modules/activities/components/students/swimmer-browser.tsx
- src/modules/activities/components/students/swimmer-profile.tsx

## Problem
BackLink renders a muted breadcrumb ('Programmes › Learn to swim') that repeats the H1, while other pages hand-roll '← Swimmers', a blue 'Your classes', an outline 'Back to requests' or a ghost Button with a -ml-3 hack. HRPerson, V2Profile and DeckAttendance show one blue '‹ Parent' link. The breadcrumb's current item is a span with role=link and aria-disabled, under a landmark labelled 'breadcrumb'. PageHeader carries a dead text-2xl/tracking-tight on the H1, has no slot for status tags (so pages put tags inside the H1, giving 'OttersCovered'), and on phones its actions do not share the width as the mockup's .phead does. LinkPagination shows '2 / 5' at body size, and four other paginations exist.

## Change (original)
1) page-header.tsx: remove the h1 utility classes (poolside styles the H1). Keep items-end with actions on the right and the primary last. Below 640px the actions row is full width with each child flex:1. Add a 'meta' prop that renders a row of tags under the description. The description is one text-sm muted line. 2) back-link.tsx: a single Link with ChevronLeft and the parent label in --pc-primary, min-height 44px, aligned to the page edge; props {href, label}. Drop 'current' and the Breadcrumb dependency, and update the 11 importers in this file list. Delete breadcrumb.tsx once it has no importer. 3) link-pagination.tsx: Previous (outline pill with ChevronLeft) on the left, a centred caption 'x to y of z' (or 'Page n of m' when no total is given) and Next on the right. Add an optional onPage for client-state lists. It sits at the foot of the list panel. Module tasks replace their hand-rolled headers, back links and pagers with these.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) page-header.tsx
- Remove the H1 classes (text-2xl font-semibold tracking-tight); poolside styles the H1.
- Add an optional `back?: {href: string; label: string}` prop. It renders BackLink at the top of the title column, 4px above the H1, as in the mockup's .phead. This removes each page's wrapper div and the gap-2, gap-3 and gap-6 drift.
- Do NOT add a 'meta' prop. Status tags go first in the `actions` slot, before the buttons, as in the RFDetail, HRReview, DeckAttendance and V2Home mockups. Move the Taken and Covered tags in class-session.tsx out of the H1 and into actions, ahead of Week before and Week after.
- Keep items-end, with actions on the right and the primary action last. The description stays one text-sm muted line.
- At max-width 767px (the existing phone breakpoint), the actions row takes the full width. Shared Buttons ([data-slot=button] and .ui-motion-press) get flex:1, tags keep their width (V2PhoneDuty and V2PhoneHome). Put the rule in poolside.css or as max-md: utilities.

2) back-link.tsx
- Render `<Button variant="ghost" asChild className="-ml-3 self-start"><Link href={href}><ChevronLeft aria-hidden="true" />{label}</Link></Button>`. This reuses the themed ghost pill: blue text, primary-soft hover, 44px, focus ring.
- Props are {href, label}. Drop `current` and the Breadcrumb dependency.
- Move the 11 importers to `<PageHeader back={...}>`. In class-session.tsx:117, the cancelled branch's raw h1 becomes a PageHeader too.
- Delete src/components/shadcn/breadcrumb.tsx, plus the now-dead `.workspace-breadcrumb [data-slot='breadcrumb-link']` rules at poolside.css:240-242.
- Module tasks then replace the hand-rolled versions: swimmer-profile.tsx "← Swimmers", hr/reviews/[id]/page.tsx:21, instructor class-session.tsx:47, assessment-session.tsx:19, and the docs reader, history, document-editor and new-document .breadcrumb blocks.
- Leave refunds/detail.tsx "Back to requests" as its approved RFDetail mockup shows.

3) link-pagination.tsx
- Previous on the left, as an outline Button with ChevronLeft (disabled on page 1). Next on the right with ChevronRight.
- A centred text-xs muted tabular-nums caption between them: "x to y of z" when a total is known, else "Page n of m".
- Add an optional onPage(n) for client-state lists such as access-requests.tsx.
- It renders inside the list panel, at its foot.
- On /activity, drop the range from the "Entries 1–50 of 812, newest first" lead, keeping only "Newest first.", so the range isn't stated twice.
- The other 7 pagers move to it in module tasks: cancellations/page.tsx, refunds/queue.tsx, class-browser.tsx, swimmer-browser.tsx, awaiting-queue.tsx, legend-agreements.tsx, access-requests.tsx.

Acceptance
- /programmes/<id>, /staff/sbx_ava, /students/parents, /staff/devices and /courses/<id>/class at 1280 light and 375 dark each show one blue 44px "‹ Parent" ghost pill, 4px above the H1, with no crumb.
- No H1 contains a tag; its accessible name is the title only.
- Actions are bottom-aligned at 1280. At 375, buttons fill the row and tags do not.
- grep finds no import of shadcn/breadcrumb.
- Check the pager caption on a list with more than one page. The sandbox /activity has 6 entries, so its pager is hidden.

Related, for the typography owner: also apply the 767px media override in poolside.css:178-179 to `.turnfin-docs` and `.turnfin-refunds`. Otherwise the H1 stays 28px on phones inside ModuleShell.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) page-header.tsx
- Remove `text-2xl font-semibold tracking-tight` from the h1. poolside.css:195 is unlayered and already styles it.
- Keep items-end, with actions on the right and the primary action last.
- Give the actions div the class `pc-phead-actions`. In poolside.css, inside the existing `@media (max-width: 767px)` block, add:
  `.turnfin-app .pc-phead-actions{width:100%} .turnfin-app .pc-phead-actions > .ui-motion-press:not([data-size^='icon']){flex:1}`
  This mirrors the mockup's `.phead .actions .btn{flex:1}` and `.btn.icon{flex:none}`. Use the 767px breakpoint, not 640, and stretch buttons only, not every child. Tags, the home NeedsSummary and the analytics refresh wrapper keep their natural width.
- Do not add a meta row under the description. Add a `status?: ReactNode` prop that renders first inside the actions group, as the RFDetail and DeckAttendance mockups do. The description stays one text-sm muted line.
- Move the tags out of the H1 into `status` in the touched files:
  - assessments/[id]/page.tsx:99-111
  - class-session.tsx:184-205
  - class-detail.tsx:107-117 (the separate tag row)
  - staff/[id]/page.tsx:58-61 (the tag row under the header)
  This also removes the invalid `<div>` inside `<h1>`. `title` stays ReactNode so the programme and level images still work.

2) back-link.tsx
- Use props `{href, label}` and reuse the shared Button instead of a new link style:
  `<Button asChild variant="ghost" className="-ml-3 min-h-11 self-start"><Link href={href}><ChevronLeft aria-hidden="true" /><span className="sr-only">Back to </span>{label}</Link></Button>`
- Why each class matters:
  - `self-start`: every parent is `flex flex-col`, and the link would otherwise stretch across the row.
  - `-ml-3`: matches the ghost button's `has-[>svg]:px-3` and the mockup's margin-left:-12px, so the chevron lines up with the page edge.
  - Explicit `min-h-11`: keeps 44px in the preview harnesses that have no poolside.css (check-parent-admin.mjs:28).
  - sr-only "Back to ": gives a clear accessible name, and keeps check-instructor-assessments.mjs:37 passing when the module task later swaps assessment-session.tsx:19 for BackLink.
- Update all 11 importers and scripts/parent-admin-preview/fixture.jsx:26-27.
- In class-session.tsx, use one label expression at both line 117 and lines 154-158: `returnTo.source ? returnTo.label : "Class details"`. Never use courseName and never the lowercase "class". On desk, drop the UiLink wrapping the H1 (lines 186-194), because the back link now goes to /courses/<id>. Replace the hand-rolled `<h1 className="text-2xl font-semibold">` at line 117 with PageHeader.
- Delete src/components/shadcn/breadcrumb.tsx. Also delete the dead `.workspace-breadcrumb` rules at poolside.css:240-242 and docs.css:4695-4704.

3) link-pagination.tsx
- Props: `{label, page, pageCount?, totalItems?, pageSize?, pathname?, query?, onPage?}`.
- Layout: Previous (outline, ChevronLeft) on the left, a centred text-sm muted tabular-nums caption, and Next on the right.
- Caption: "x to y of z" when totalItems and pageSize are given; otherwise "Page n of m" from pageCount.
- With onPage, render `<Button type="button" variant="outline" onClick>`. `type="button"` stops it submitting an enclosing form. Put `aria-live="polite"` on the caption, because there is no navigation to announce the new page.
- Keep the component free of hooks and without "use client". Only client components can pass onPage.
- On /activity (page.tsx:46-52), cut the Lead down to "Newest first." so the range is not shown twice.

4) Copy and docs
- guides-classes.ts:13 and docs/classes.md:30: change "Classes breadcrumb" to "Classes back link".
- DESIGN.md:200: say that the back link is BackLink (a ghost pill above the H1), status tags sit first in the actions group, and LinkPagination is the only pager.
- Do not regenerate assets/help images from the instructor-swimmer-preview harnesses until they load poolside.css and put .turnfin-app on body. Without that, the H1 will render unstyled there.

5) Extra acceptance checks
- Home at 375 keeps the "things need you" tag at its natural width.
- The analytics refresh icon stays 44×44.
- /courses/<id>/class shows "‹ Class details" above the H1 "Otters", with no repeat.
- grep finds no `shadcn/breadcrumb`, `current=` on BackLink, or `workspace-breadcrumb`.
- `npm run lint`, typecheck, `node scripts/check-parent-admin.mjs` and `node scripts/check-assessment-workspace.mjs` all pass.

## Acceptance
/programmes/<id>, /staff/sbx_ava, /students/parents, /staff/devices and /courses/<id>/class at 1280 light and 375 dark show one blue 44px '‹ Parent' link above the H1 and no repeated crumb. PageHeader actions are bottom-aligned at 1280 and fill the row on phones. /activity pagination shows the caption layout. grep finds no import of shadcn/breadcrumb.

## Verification notes
- KEEP: The problem is real, and most of the proposed change matches the direction. Three parts need adjusting to fit the approved mockups.

Confirmed in code and live (shots in scratchpad/shots/audit2/sys12):
- back-link.tsx wraps the shadcn Breadcrumb. Live /programmes/<id> at 1280 light shows a muted "Programmes > Learn to swim" crumb that repeats the H1. /staff/devices at 375 dark shows "Staff > Work devices". The current item is a span with role=link and aria-disabled=true (checked through CDP on 5 routes).
- Other pages hand-roll their own back links:
  - swimmer-profile.tsx: a muted "← Swimmers" with ArrowLeft.
  - hr/reviews/[id]/page.tsx:21: a ghost Button with -ml-3 and ArrowLeft.
  - instructor/class-session.tsx:47 and assessment-session.tsx:19: a ghost Button with -ml-3 and ChevronLeft.
  - docs reader, history, document-editor and new-document: their own "← Library / ref" .breadcrumb.
- The gap from back link to H1 varies by page: gap-2 on programmes and assessments, gap-3 on class-detail, gap-6 (24px) on staff/[id], devices and parents. The mockup uses 4px.
- Every mockup with a back link (HRPerson, V2Profile, DeckAttendance, SSProgramme, ADDevices, ADPerson, SSParents, SSClassRegister, TRPerson and more) uses one ghost-blue pill: chevron-left plus the parent label, margin-left -12px, inside the .phead title column.
- PageHeader's H1 has text-2xl font-semibold tracking-tight. These are dead: computed letter-spacing is -0.28px, from the poolside.css:195 rule, not tracking-tight.
- Tags sit inside the H1. The live accessible name on /courses/<id>/class is "OttersCovered" (class-session.tsx:180-200).
- LinkPagination shows "{page} / {pages}" at text-sm. The mockups use a 12px caption: V2Swimmers "1 to 25 of 1,102", ADActivity "1 of 17", placed inside the list panel.
- The duplicate pagers number 7, not 4: cancellations/page.tsx:21, refunds/queue.tsx:38, class-browser.tsx:71, swimmer-browser.tsx:76 (also "x / y"), awaiting-queue.tsx:84, legend-agreements.tsx:98, and access-requests.tsx:86 (client state).

Corrections against the mockups:
1. The proposed 'meta' prop conflicts with the mockups. All 7 mockups that show a status tag in the header put it in the actions slot, before the buttons: DeckAttendance, DeckCompetencies, DeckOverview, HRReview, RFDetail, V2Home, V2PhoneHome. So no new prop is needed.
2. The phone breakpoint is 767px in poolside.css:178 and in the mockup CSS, not 640px. Only the phone frame (V2PhoneDuty, `.phone .phead .actions .btn{flex:1}`) stretches buttons, and tags keep their own width (V2PhoneHome sets width:auto). The per-page mockups at 375 (ADDevices, ADPerson) show buttons at content width. So stretch buttons only, never tags.
3. The theme already makes Button variant="ghost" blue with a primary-soft hover pill (poolside.css:346-347). That is exactly the mockup's .btn.ghost, so BackLink should reuse it, not a hand-styled Link.

Also:
- If the pager also says "x to y of z", /activity would state its range twice, because the page has its own "Entries 1–50 of 812" lead.
- The /activity pager can't be checked in the sandbox: it has 6 entries, so the pager is hidden.
- Out of scope but related: the 24px phone H1 never applies inside ModuleShell. poolside.css:10-12 re-declares the tokens on .turnfin-docs, and the :178-179 override targets only .turnfin-app. Computed H1 at 375 is 28px.
- Refunds' outline "Back to requests" matches its approved RFDetail mockup, so it is not a defect here.
- KEEP: The change is sound and nothing in it is impossible to fix. Lint boundaries are fine: ui-kit is Core, and the three components import only shadcn, lucide and next/link, never Activities. As written, though, five parts would cause regressions.

1) Phone actions. "Each child flex:1" on PageHeader actions is too broad, because not every child is a button.
- home-view.tsx:30 passes NeedsSummary, which is a Tag (home-parts.tsx:51-54). In shots/audit2/sys12-regr/home-375-light-top.png it is the small amber "5 things need you" tag. With flex:1 it would stretch into a full-width amber strip on the home page.
- analytics/refresh.tsx:11-12 passes a wrapper div around a 44px icon button.
- The mockup stretches only buttons: `.phead .actions .btn{flex:1}`, with `.btn.icon{flex:none}`. It applies `width:100%` at `max-width:767px`, which is the app's phone breakpoint (poolside.css:178/412/509), not 640px.
- Dialog triggers such as EditProgramme, AddLevel and EnrolIntoCourse use Radix asChild, which replaces data-slot="button" (DESIGN.md:185-187). So the selector has to key on `.ui-motion-press`.

2) Back link stretching. Every BackLink importer wraps it in a `flex flex-col` parent (programmes/[id]:69, staff/[id]:46, class-detail:90, and the others). Today it survives because the breadcrumb `<nav>` is a block. A bare inline-flex Link or Button would stretch to full width, so the hover pill and the hit area would cover the whole row. It needs `self-start`.

3) Rebuilding the ghost button. A hand-made "Link in --pc-primary" rebuilds what the shared ghost Button already does. poolside.css:340 and 346-347 give `[data-variant=ghost]` a 44px pill, primary text and a primary-soft hover. That is exactly the mockup's back link: `<a class="btn ghost">` inside `margin-left:-12px` in HRPerson, V2Profile, SSProgramme and DeckAttendance.
- The preview harnesses do not load poolside.css. scripts/instructor-swimmer-preview/build.mjs:36-39 loads only globals.css, and there is no .turnfin-app class.
- check-parent-admin.mjs:28 fails any control under 43.5px.
- So BackLink must keep an explicit `min-h-11`.

4) A 12th importer is missed. scripts/parent-admin-preview/fixture.jsx:17,26,27 uses `<BackLink current=…>children</BackLink>`. It is .jsx, so typecheck will not flag it, and it would quietly render an empty link.

5) Labels that read wrong after the change.
- class-session.tsx:154-158 uses courseName as the label when returnTo.source is null. On /courses/<id>/class that becomes "‹ Otters" right above the H1 "Otters", so the acceptance check fails. Today it renders "Otters › Class" (courses_…_class-375-light-top.png).
- class-session.tsx:117 (the cancelled-session path) passes returnTo.label, which is lowercase "class" when source is null (navigation.ts:47). It would render "‹ class".

Smaller points:
- The 'meta row under the description' goes against DESIGN.md:200 ("H1 and one line on the left"). The owner-approved mockups put the status tag first inside `.actions` instead (RFDetail: `<div class="actions"><span class="tag">In review</span>…`, and DeckAttendance does the same).
- /activity (page.tsx:46-52) already shows "Entries x–y of z", which would duplicate the new pager caption.
- Help copy still says "breadcrumb": guides-classes.ts:13 and docs/classes.md:30.
- `.workspace-breadcrumb` CSS is already dead: no tsx or jsx renders it (poolside.css:240-242, docs.css:4695-4704).

Checked with no impact found:
- No src tests import these components.
- apps/me does not import them.
- The poolside h1 rule (poolside.css:195) is unlayered and already overrides text-2xl and tracking-tight, so removing those classes changes nothing in the product. It only affects the poolside-less harnesses.

Evidence: shots/audit2/sys12-regr/{home-375-light,programmes_…-375-dark,courses_…_class-375-light}-top.png.