# Re-audit: swim-school (PASSED SS-01,02,03,05,06,07,08,09,10)
1. [medium] Review cancellation dialog: two .pc-note boxes invisible in dark dialogs; attendance note should be <Notice tone="warning" title="{n} attendance records already existed." description="Check these before deciding on a billing change." />; "Billing notified" a plain section (h3, caption "By … · date", note) — billing-review.tsx:34-35
2. [medium] Parent accounts request row prints raw ISO date of birth; use formatDate(parseDateOnly(...)) — access-requests.tsx:75
3. [medium] Programme detail at 375: competency row actions wrap to two lines (~180px rows); below md put reorder+Edit/Archive on one wrapping line or in a DropdownMenu (Move up/Move down/Edit/Archive), 44px targets — programmes/[id]/page.tsx:288-300, curriculum/level-actions.tsx
4. [low] Programme detail header: pass programme description to PageHeader; keep only the count sentence as caption — programmes/[id]/page.tsx ~90-100
5. [low] Class detail roster: caption "No member number · Age 8" filler; build [#number, age].filter(Boolean).join(" · "); drop min-h-11 gap on inline name link; same no-filler rule in duty-view.tsx:83, billing-review.tsx:36, legend-agreements.tsx:36 — class-detail.tsx:376-392
6. [low] Classes ?q no-match: three reset controls; show "Clear filters" only when a picker filter is set; hint depends on q vs pickers; hide "Today only" when empty — course-filters.tsx:56, class-browser.tsx:70-71
7. [low] Enrol in a class dialog: "Search classes…" placeholder; use SearchField (controlled); below sm make Level/Day/Time compact so the list stays reachable — class-enrolment-dialog.tsx:79
8. [low] Legend list match dialog copy "at both sites" -> "at every site" — legend-list-match.tsx:54
9. [low] Wrong-site screen says "club"; use "Switch site to continue" / "Nothing from one site…" — src/components/clubs/wrong-club.tsx:27,31
10. [low] Class session cancelled branch: reuse the live header (description `${formatSlot} · ${date}` + week actions) — attendance/class-session.tsx:117-118,158-185
11. [low] Duty quick view swimmer list: use .pc-rows (title + hint) — duty-view.tsx:83
12. [low] Swimmer profile Details tab rows at 375 uneven (link min-h-11); make rows even — swimmer-profile.tsx:141-145, swimmer-profile.module.css
