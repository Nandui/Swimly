---
version: 1
slug: "src-app-rota-page-tsx"
primary_target: "src/app/rota/page.tsx"
related_targets: ["src/modules/rota/components/planner.tsx","src/modules/rota/lib/planner.ts","src/modules/rota/components/day-planner.tsx"]
---

# Rota week planner (Week plan, `/rota`)

Mode: Operate. Audience: department supervisors planning their department's staff and bookings weeks ahead (owner, 5 October 2026). Shifts come first; bookings sit inside them and are staffed from people on shift. A booking repeats as defined: weekdays, a first and last day, and dates it does not run. Highlight every gap: a booking short of staff, the wrong qualification, a person off or double-booked, fixed cover with nobody on it.

Constraints: Poolside Clear v2, shared `TimelineGrid`, 15-minute steps, nothing scrolls sideways, an agenda below 1280px, 44px targets, every change audited, a reason asked once the week has started.

## Direction contract

THESIS: One day at a time, read as supply against demand: what needs people above, who is on shift below, and a 15-minute shortfall meter heading the demand. It refuses the category default of a people-by-days grid where bookings and gaps are invisible.

OWN-WORLD: Poolside Clear v2 unchanged: cool canvas, white 24px panels, rows as 16px rounded lanes, the fin blue for actions and selection, the gap tone (amber) for short, the danger wash for off, unqualified or double-booked. Quarter-hour ticks inside each track.

STORY: The supervisor picks the week and their department, sees which days have gaps (counts on the day tabs), opens a day, drags across the booking lane to add a booking, fills its places from the people on shift, and watches the meter go flat.

FIRST VIEWPORT: Header (Week plan, week picker, department, Add booking, Add a shift). Day tabs Week · Mon to Sun with gap counts. Panel "What needs people": the shortfall meter first, then the drag lane "Add a booking", each booking's places and fixed cover lanes. Needs you shows three rows and the rest on request. Panel "Who is on": each person's shift with their bookings inside. "Needs you" beside them on wide screens, above them otherwise.

FORM: Needs over people, second of seven on my ordered list; seed key de8e8353.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
