# Today: level-led booking sheet

Date: 10 September 2026

final result: passed

Implemented selected option 2 in the existing Today page. No actionable P0/P1/P2 findings remain in the reviewed component.

## Comparison evidence

- Source visual truth: D:/swimly/.impeccable/review/today-booking-sheet/selected-concept.png (the second displayed generated design).
- Browser-rendered implementation: D:/swimly/.impeccable/review/today-booking-sheet/concept-implementation.png.
- Both images: 1487 × 1058 pixels. Browser viewport: 1487 × 1058 CSS pixels, effective screenshot density 1. No resizing or cropping was required.
- State: Today, expanded navigation, light theme, all filters, 16:10 on 10 September 2026, ten synthetic classes corresponding to the selected mock. The fixture renders the real TodayCalendar and AppShell, with mocked data and navigation refresh.
- The source and implementation were opened together in the same comparison input. Level rows, class details, capacity, status and controls were readable at this size; no separate magnified crop was necessary.
- Responsive evidence: {light,dark}-{375,768,1024,1280}.png in the same directory, at the named CSS width and 1000px height. long-1280.png and long-375.png cover long level, programme, location, class and instructor names.

## Comparison history

1. Initial browser inspection found the level stub collapsed to 16.4px in Astryx's children-mode table, forcing names into single-letter lines. A native colgroup now supplies structural widths; the corrected stub measured 144px. Table cells and controls still use Astryx.
2. The first complete sheet had taller entries than the selected design and clipped the last level below the viewport. Compacting description spacing and using balanced Item density moved the last row's bottom to 947px. The final capture shows all six levels and time columns in one viewport.
3. Long-name inspection confirmed wrapping in the row header and class entries. Four-width checks in both modes retained all 17 classes in the larger fixture, without horizontal overflow, duplicated IDs or invalid cell-header references.

## Fidelity surfaces

- Typography: installed Figtree, Astryx headings and 14px body text; 17px level labels. Established shell and type scale retained rather than reproducing generated typography variations.
- Spacing/layout: levels down the left, exact starts across the top, shared grid dividers, muted programme bands, compact filters alongside the date. Wider schedules continue below in chronological bands; under 640px of content width they become a time-ordered schedule. No separate class cards.
- Colours/tokens: Astryx Neutral in both modes. Shared status metadata feeds Token colours. Muted backgrounds use the existing theme token. No custom palette, CSS file or global style changes.
- Assets/icons: no new raster asset is needed. Existing wordmark, shell and Astryx Icon/Lucide controls remain in use.
- Copy/content: entries retain actual time range, pool area, instructor or cover, places and attendance state. Empty cells say “No class”. Mock header counts were corrected to actual fixture counts. “Finished” labels and permission-sensitive navigation are preserved.

## Verification

- npm run typecheck: passed.
- npm run lint: passed.
- npm test: all 127 tests passed, including three new booking-sheet tests.
- git diff --check: passed.
- Browser: 375, 768, 1024 and 1280 in light and dark; one H1 and main landmark, all classes retained, no horizontal overflow, no nested controls, valid table-header references and no duplicate IDs. Visible touch controls and class links meet the existing 44px minimum.
- Combined filters, My classes with declared cover, refresh preserving filters, clearing filters, no-match recovery and missing details passed.
- Jump to now focuses 16:00; keyboard Escape returns focus to Instructor. Astryx's selector retains its focus treatment.
- Calendar-only users have no inaccessible links; desk-only users get class-detail destinations. Two classes sharing one cell remain individually reachable.
- Empty day, empty refresh, mixed durations and Dublin midnight were checked. Sidebar collapse recalculates the available columns.
- Browser console: no errors or warnings during completed checks.
- Evidence details: layout-results.json, touch-results.json, functional-results.json and scenario-results.json in the review directory.

## Limits and accepted differences

The preview uses synthetic data; live database rendering, production build and deployment were not run. Actual attendance writes were not exercised. No database queries, schema, permissions, mutations or Instructor screen code changed. Full-application navigation targets remain the existing routes; the synthetic fixture verifies their destinations rather than rendering the attendance workflow.

The prior Swimmers review was preserved at .impeccable/review/today-booking-sheet/previous-design-qa.md before updating this latest-review file.
