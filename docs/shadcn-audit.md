# Staff UI audit and conversion

18 September 2026. Scope: the Swimly staff repository, including the Turnfin
portal, desk workspace, isolated Instructor workspace, help centre and staff
controls for parent accounts. LeisureWorld Aquatics, the separate parent app,
is outside this conversion. These counts describe the audit before the Docs
integration. Docs also uses the shared shadcn primitives, with its separate
source theme and verification recorded in [turnfin-docs.md](turnfin-docs.md).

## Result

The source audit covered **201 TSX files and 40 page entry points**, including
the **30 installed shadcn primitive files**. Most of the staff app was already
converted. The remaining visible native controls have now been replaced:

| Finding | Conversion |
| --- | --- |
| Native daily breakdown in reception analytics | Collapsible with a Button trigger and keyboard expanded state |
| Native mobile help topic disclosure | Collapsible with a Button trigger; topic and search URL behaviour retained |
| Native placement-reason disclosure | Controlled Collapsible; the textarea remains mounted while closed so FormData retains its value |
| Custom swimmer journey chapter button | Button composed with CollapsibleTrigger; preserved chapter metadata and focus |
| Two native search labels | Label in Help and Awaiting enrolment |
| Custom help result rows | Item composed with the guide link |
| Custom staff parent-request and assessment-publication panels | Card, retaining their article/region semantics |
| Custom different-site chip | Neutral Badge |
| Inconsistent empty states | Empty/EmptyState across analytics, duty/billing, staff parent management, swimmer records, class selection and Instructor |
| Custom portal/duty/Instructor error feedback | Alert through the shared Notice composition |
| Small desktop controls on swimmer profiles and Instructor retry | Minimum 44px height |

The AST inventory originally found three `details`/`summary` pairs, two labels
and one button outside the primitive directory. It now finds **zero visible
native controls** there. Twelve native hidden-input declarations remain for
posted IDs, filter state and the Select form bridge.

## What was already compliant

- Portal, desk and Instructor navigation compose Sidebar, Sheet, DropdownMenu,
  Button and Tabs. Instructor remains a separate workspace.
- Class and swimmer directories, schedule, assessments, curriculum, staff,
  roles, sites, agreements and activity use the local shadcn controls or shared
  compositions. Schedule geometry and swimmer-history layout remain CSS.
- Form dialogs, confirmations, searchable pickers, attendance and competency
  controls already compose Dialog/AlertDialog, Command/Popover, RadioGroup,
  Checkbox, Input, Select and Textarea.
- `components/ui` and `components/ui-kit` are **shadcn compositions**, not a
  second UI library. Their form bridges retain native validation, required
  fields, reset behaviour and server feedback.
- Theme colours/radii come from `src/app/shadcn.css`; Figtree and the approved
  Neutral surfaces with blue actions remain. Domain status tones use metadata
  with Badge/Tag. There are no competing UI-library dependencies.

Semantic headings, paragraphs, links, lists, landmarks, forms, fieldsets and
layout containers intentionally remain HTML. Lucide icons, live announcements,
inline field errors and data visualisation geometry are not separate control
implementations. This conversion does not replace them with unnecessary cards.

## Preventing drift

`npm run lint` now rejects visible raw controls, hand-built interactive roles
and imports of competing UI libraries outside `components/shadcn`. Literal
hidden inputs are allowed for FormData. A rule smoke check verified that the
hidden-input exception works and that visible input/button/disclosure controls
and a custom button role fail.

When a form field sits inside CollapsibleContent, keep it mounted and hide its
closed state. Unmounting it discards entered text and removes it from FormData.
The enrolment check covers collapse/reopen, course changes, failed saves and
opening a fresh dialog.

## Verification

- `npm run typecheck`, `npm run lint`, and an optimized `npm run build`.
- `npx tsx --test src/lib/help/help.test.ts src/lib/enrolment/class-picker.test.ts`:
  16 tests covering help scope/access, content/search and cross-site class filters.
- `node scripts/check-shadcn-ui.mjs`: 48 layouts covering the changed Help,
  swimmer profile, duty, billing, Instructor error and enrolment surfaces at
  375, 768, 1024 and 1280, in light and dark. Keyboard disclosures, visible focus,
  search/filter recovery, move/enrol FormData and failure preservation pass.
- `node scripts/check-analytics.mjs`: 24 layouts plus navigation, daily
  breakdown, staff search, instructor/status filters and empty states.
- `node --import tsx scripts/check-parent-admin.mjs`: 56 layout/dialog checks
  plus staff approval/revocation, lookup, suspension, publication, permission,
  duplicate-submit and retry checks against its isolated in-memory fixture.
- `node scripts/check-instructor-overview.mjs`: responsive overview, saved
  totals and empty states, with synthetic swimmers.

Browser scripts accept `PLAYWRIGHT_MODULE` (Instructor scripts also accept
`INSTRUCTOR_PLAYWRIGHT_MODULE`) for the installed Playwright runtime. Captures
and machine-readable evidence are under ignored `.impeccable/review/` folders.
The source inventory covers every page; browser verification is focused on
changed compositions and affected workflows, not an authenticated production
tour of all 40 routes.

Build verification uses `VERCEL_ENV=preview` and an unreachable dummy database
URL, so production migrations are skipped. No live records, emails, permissions,
database schema or backend actions were changed. No deployment was performed.

Composition references: [shadcn Collapsible](https://ui.shadcn.com/docs/components/radix/collapsible)
and [shadcn Empty](https://ui.shadcn.com/docs/components/empty); the installed
component source is the API and styling authority for this repository.
