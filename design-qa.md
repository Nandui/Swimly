# Today: approved shadcn booking sheet

Date: 11 September 2026

Result: passed. The owner approved the revised preview, including availability
icons, and requested a push to dev.

## Implementation

Today uses the approved programme/level rows and exact start-time columns,
with distinct booking blocks, quiet empty cells, sticky headers and level
labels. Scrolling stays within the sheet. Agenda is selectable on larger
screens and automatic when the working surface is narrower than 600px.

A circled check means spaces available; a circled X means full. Both have
accessible labels and a visible legend, including on phones. Uncapped classes
are available; over-capacity classes remain full and show the excess count.
Attendance completion does not drive icons and is not shown in the calendar.
Counts, cover, actual end times and existing class destinations are retained.

The table is derived from shadcn/ui. A CSS Module isolates the approved
calendar styles. Shared Neutral tokens, Figtree, the shell, Astryx filters
and shared buttons remain. DESIGN.md and AGENTS.md record this scoped
exception. No global stylesheet, dependency, database query, permission,
mutation or Instructor workflow changed.

## Evidence

- Approved visual: `.impeccable/review/today-refined/availability-preview.png`.
- Integrated component: `.impeccable/review/today-refined/integrated.png`.
- Both captures use a 1487 × 1058 CSS viewport and synthetic classes. The
  fixture now imports `src/components/today/calendar.tsx` and includes its
  compiled CSS Module, rather than rendering the disposable prototype.
- Responsive captures: `integrated-{light,dark}-{375,768,1024,1280}.png` in
  the same ignored review directory. JSON results are in `integrated-results.json`.
- The previous Astryx review is preserved as `previous-astryx-design-qa.md`
  in that directory.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: all 127 passed.
- `npx next build`: passed, including compilation, TypeScript, and page generation.
- `git diff --check`: passed.
- At 375, 768, 1024 and 1280 in both modes: all 10 concept classes retained,
  7 available icons and 3 full icons, one H1 and main, valid table-header
  references, no overflow outside the sheet, and 44px touch targets.
- Agenda retains the classes. Lane 3 filters to 4; refresh retains 4;
  combining My classes gives 1; clearing returns all 10. Jump focuses 16:00.
  Keyboard focus on the scroll region has a visible outline.
- Empty data shows the empty state. Calendar-only access has no booking
  links; Classes access has class-detail links. Long/missing labels, parallel
  classes, uncapped capacity and over-capacity retain the correct records
  and availability signals.
- Availability icons use the primary theme foreground. Secondary text and
  icons were checked against their surfaces in both colour modes.
- Browser errors and warnings: none during the completed checks.

## Limits

Browser checks use synthetic data and mocked navigation refresh. Real class
destinations are verified as links; live database rendering and attendance
writes were not exercised. The migration-running `npm run build` wrapper
was not invoked; the optimized Next.js build ran directly.
