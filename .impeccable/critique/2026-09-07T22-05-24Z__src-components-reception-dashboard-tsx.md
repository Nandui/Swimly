---
target: Reception desk dashboard
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-09-07T22-05-24Z
slug: src-components-reception-dashboard-tsx
---
Method: dual-agent (A: /root/design_review; B: /root/evidence_review).

Reception is a good foundation, but its composition still slows a busy desk. The tools fit swim-school work; the next improvement should prioritise task switching and class management over visual decoration. Astryx Neutral is appropriate.

Heuristic review: 28/40, Good. These are expert judgments, not usability-study results.

| Heuristic | Score /4 | Finding |
|---|---:|---|
| System status | 3 | Snapshot time is clear; running classes are not marked in rows. |
| Real-world match | 4 | Swimmers, levels, cover, contacts and sibling bookings match desk work. |
| User control | 3 | Cancellable dialogs and retained selection; dialog close loses focus. |
| Consistency | 3 | Astryx is coherent; action sizes and unenrolment wording vary. |
| Error prevention | 3 | Named confirmations, inactive guards and placement checks. |
| Recognition | 3 | Useful swimmer summary; staff still compare times to find current classes. |
| Efficiency | 2 | Search works, but switching dashboard tasks requires scrolling. |
| Minimalist design | 2 | Large shortcuts and repeated action clusters compete for attention. |
| Error recovery | 3 | Failures explain next steps and forms retain input. |
| Contextual help | 2 | Basic guidance exists; some enrolment choices remain ambiguous. |

Strengths: identity, contacts and places are together; mutations name the swimmer/class and preserve history; restrained Astryx surfaces and status tokens suit sustained desk work.

Priority issues:

1. [P1] Today's classes is buried on narrow screens. At 375px the selected swimmer's first enrolment occupies nearly the entire saved frame. Remaining places and Quick Links precede the timetable. At the current 1280x720 fixture size, Quick Links consumes about 348px and pushes Today to y456. Keep a compact route to Swimmer, Today and Quick Links at narrow widths; reduce shortcut height so Today is visible beside lookup on desktop. Preserve selection during switching. Use Astryx tabs/section navigation and its region budgets. Suggested command: impeccable adapt. Evidence: src/components/reception/dashboard.tsx:65,153,173 and synthetic captures.

2. [P2] Enrolment actions have too little hierarchy. Move, Unenrol, Schedule unenrolment and Class details have similar prominence and wrap into several rows. Keep Move and Unenrol as obvious buttons; put Now/On a date inside the unenrol flow, and make class navigation quieter. Keep scheduled dates visible. Align control sizes within each row, as Astryx layout guidance requires. Suggested command: impeccable distill. Evidence: dashboard.tsx:130; src/components/enrolment/enrolment-actions.tsx:167,203.

3. [P2] The timetable does not identify the classes staff need now. A running count does not identify its rows; '5 of 10' also requires interpretation. Label current rows, identify the next group and say '5 places free' where useful. Keep access to the whole day and refresh the snapshot on return to the dashboard. Suggested command: impeccable clarify. Evidence: dashboard.tsx:48,182,202. Snapshot refresh concern is source-based, not a demonstrated stale-data incident.

4. [P2] Waitlist management cannot be completed at the desk. Reception shows waitlisted places but has no promotion action. The class page already uses PromoteFromWaitlist; reuse that guarded workflow beside the waitlisted place with a clear 'Enrol from waitlist' button. Suggested command: impeccable shape. Evidence: dashboard.tsx:106-135; src/components/enrolment/enrolment-actions.tsx:230; src/app/(app)/courses/[id]/page.tsx:270. This is an additional source-confirmed synthesis finding.

5. [P2] Keyboard users lose their place after closing a dialog. The synthetic browser check found BODY focused after both Cancel and Escape in the enrol dialog. Restore focus to its opening button. Also give repeated Schedule unenrolment/Change end date buttons accessible names identifying their class and swimmer. Suggested command: impeccable harden. Evidence: src/components/form-dialog.tsx:88,131; src/components/enrolment/enrolment-actions.tsx:209.

Cognitive load is moderate: five similarly weighted shortcuts and repeated action clusters make users scan choices without a strong ranking. The confidence peak is finding the correct swimmer and their contacts; the low point is switching away to answer a timetable question. Named confirmation dialogs provide reassurance at consequential steps.

Persona risks: experienced desk staff face excess task-switching scroll; keyboard users lose dialog focus; interrupted mobile staff have no immediately visible path to the other dashboard regions.

Minor observations: standardise Unenrol/End place/roster wording; use sentence-case Quick links; retained closed dialogs contain duplicate toCourseId/finished IDs, which need investigation but are not a proven screen-reader failure.

Evidence synthesis: detector scanned 10 relevant TSX files and returned zero findings. No rule names, locations or false positives. Fresh synthetic browser evidence at 1280x720 showed no horizontal overflow, labelled search and dialog controls, and no warning/error logs. Saved synthetic captures at 375/768/1024/1280 informed responsive review; they are not a fresh full breakpoint pass. No live records were changed, and no contrast-ratio or screen-reader certification is claimed. The static detector does not assess these workflow problems or prove accessibility.

Questions for next work: prioritise faster task switching or completing swimmer actions? Address all five issues or the three highest-impact items (dashboard access, waitlist promotion and dialog focus)?
