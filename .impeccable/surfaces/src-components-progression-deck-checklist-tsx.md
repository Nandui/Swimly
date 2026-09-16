---
version: 1
slug: "src-components-progression-deck-checklist-tsx"
primary_target: "src/components/progression/deck-checklist.tsx"
related_targets: ["src/components/instructor/class-session.tsx"]
---

# Instructor competencies by swimmer

Mode: Operate. Instructors at the pool need to review all of one swimmer's
class-level competencies, with large controls and preserved drafts.

The user approved option 3 on 16 September 2026: the expanding roster in
`.impeccable/mocks/instructor-swimmer/03-inline-expansion.png`.

Keep the existing instructor frame, Figtree, Neutral surfaces, ui-* tokens,
shadcn controls and named permissions. No change to the desk workspace.
Instructor opens directly into the swimmer list, with no view switch or
class-wide competency selector. The desk checklist retains its existing layout.
Clicking a name expands that swimmer. The selected row's pale blue header contains a scoped
Mark all achieved action. Numbered competency rows stack their controls on
phones and align them to the right on tablets. The class-wide Save bar persists.
The row header owns the hover background; its name trigger stays transparent
in both themes, so the expanded blue surface spans the name and action area.

All swimmers use the same marks and class/date draft store. Changing the
open row never writes or discards marks. Mark all achieved changes only the
selected swimmer. Failed saves retain changes, and level completion remains a
separate confirmation. Absent swimmers stay in their own expandable group.
Existing confirmed-owner, active-enrolment, level and audit checks apply.

Adaptations from the image: use incumbent semantic radio controls and their
existing status styling; controls stay at least 44px, focus rings remain visible
outside row borders, and the header bulk button wraps on phones. No novel colours,
icons or raster UI are introduced. Six skills in screenshots are fictional.

Verification: synthetic browser flow, both themes at 375/768/1024/1280,
focused server boundary tests, typecheck, lint and production build.
