---
version: 1
slug: "instructor-class-overview"
primary_target: "src/components/instructor/class-competency-overview.tsx"
related_targets: ["src/components/instructor/class-navigation.tsx", "src/components/instructor/class-session.tsx"]
---

# Instructor class overview

Mode: Operate. Pool-deck instructors need to see competency achievement totals
across the class and decide what to teach without opening individual rows.

Extend the established Instructor workspace: Figtree, Neutral ui-* surfaces,
shadcn controls and a blue selected navigation item. The separate overview route
shares the existing confirmed-start and site guards. It has no desk links or
swimmer profiles and performs no mutations.

The owner specified a simple bento grid: a card for each competency, containing
its full name and “Y out of Z achieved”. Keep curriculum order and use two columns
from 360px, three from 1024px, one below 360px. Cards have neutral borders and no
shadows. There is no ranked focus list, matrix, disclosure or swimmer breakdown.
Long names wrap naturally; no horizontal scrolling is needed at any width.

Every currently enrolled swimmer remains included regardless of attendance.
Missing saved marks count as not achieved. Competency progress is current and
shared. Unsaved drafts persist in the teaching
views but do not affect this overview until saved.

Verification uses synthetic records: both themes at 375/768/1024/1280, a large
class, long names, saved/draft navigation, empty and fully
achieved states, plus existing loader/action boundary tests. No live records.
