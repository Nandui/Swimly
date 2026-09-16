# Instructor swimmer competency concepts

Exploration requested 16 September 2026. The user approved option 3 (expanding
swimmer rows) for implementation. These images are design examples. All people and
competency wording in the examples are synthetic.

After implementation, the user requested removing the By competency view from
Instructor entirely. The delivered workspace opens directly into swimmer rows,
with no view switch. This supersedes the view-switch ideas in the exploration below.

- Job: during a claimed class, tap a swimmer and review or mark that swimmer's
  competencies for the class level, while retaining the existing class-wide view.
- Visual authority: DESIGN.md, instructor teaching components and the synthetic
  assets/help/competencies.png and assets/help/instructor-home.png screenshots.
  Mode: Operate. Existing Figtree, Neutral shadcn surfaces and blue actions.
- Examples: 01-side-panel.png keeps the class visible; 02-focused-view.png gives
  the swimmer a dedicated within-class view; 03-inline-expansion.png expands a
  swimmer in the roster. Selected: 03-inline-expansion.png, implemented with the
  existing shadcn controls, responsive stacked marks and a class-wide Save action.
- Interaction: linked swimmer names, previous/next swimmer, individual Not
  achieved/Achieved controls, optional Mark all achieved for the selected swimmer,
  and explicit Save marks. Class and swimmer views must share one draft state and
  preserve changes when switching. Save should clearly identify its class-wide
  scope if changes also exist for other swimmers. No automatic level completion.
- Boundaries: preserve confirmed class/date ownership, progression.assess and
  progression.complete checks, current-enrolment and level validation, audit,
  timeout/retry and local draft recovery. No desk profile, global search or staff
  navigation. Attendance stays separate; absent swimmers remain identifiable.
- Implementation states: empty competencies/roster, absent or off-level swimmer,
  completed level, read-only access, unsaved marks, offline/failed save, and lost
  claim/cancelled class. Use 44px controls, visible focus, light/dark themes and
  accessible modal focus/close behavior where a sheet is used.
- Treat the generated images as composition examples. Use the existing semantic
  controls and real curriculum when building. In the side-panel mock the selected
  competency's ordinal should be 5 of 6; the generated background says 2 of 6.
  Do not copy that mismatch, invented fixture counts, or changed button colours
  literally. Preserve the existing class-wide marking controls behind the sheet.

Each PNG was generated using the built-in image generation tool. The exact prompt
is kept in its adjacent .prompt.txt and embedded in the PNG metadata. No app source
or live records were changed for this design exploration.
