# Re-audit: home-rota (PASSED HOME-01, RO-02)
1. [high] /rota week plan "To fill" cells truncated at 1280 and 375 ("Lifeguard: Example…"): block title = role only ("Lifeguard", or "Unfilled" when no role); booking name into aria-label/sheet header; no 2-line clamp cutting the role — roster.tsx:49-56, 204-211
2. [high] Timeline blocks unreadable at 1280 (~105px blocks show "Exa…"): "full" density at >=120px (not 240); at "compact" render only the title (hint+tag to aria-label); narrow dayRange to planned span ±1h (RODay shows 07:00–21:00) — timeline-grid.tsx:121-122,177-185; lib/rota/timeline.ts:107-111; poolside.css .pc-block
3. [medium] /rota at 768/1024: lane names cut ("Ava Exa…"); let roster lane label wrap to 2 lines (roster-scoped override of .pc-timeline-lane nowrap); align lane and Off cells to start, no stretched 180px Off cells — roster.tsx ~88-140; poolside.css:634
4. [OWNER DECISION — DO NOT CHANGE] /rota/absences says nobody off while the week plan shows Riley absent: widening absenceReach changes who a manager can see (access scope). Leave as is; report to owner.
5. [medium] Module overview/home card that fails to load disappears silently: homeCardItems returns failed module ids; ModuleOverview and HomeView show <Notice tone="error"> "Today's figures didn't load." with a Reload link in place of the missing panels — modules/contributions.ts:131-143; lib/home.ts:60-67; module-overview.tsx; home-view.tsx
6. [medium] Add a shift (started week): two fields labelled "Note"; rename the change field "About the change" with hint "Optional. Kept with the reason" — rota/actions.tsx:42
7. [low] Shift plan sheet: "Ends" time input clipped at 1280; footer at 375 drops primary to its own left row; min width for time columns; footer flex-wrap with primary last/right (or full width on phones) — rota/segments.tsx
8. [low] Rota dialogs: paired fields misaligned when one has a hint (Duty/Department; Who it is for/What it is): items-end on the pair — rota/actions.tsx, rota/bookings.tsx ~75-80
9. [low] Now line drawn over block text: .pc-block above .pc-timeline-now (z-index, opaque block bg) — poolside.css
10. [low] Rota terms/colours: Day legend "Duty" -> "Shift"; add "Today, outlined" to week key; booking kind "School lessons" tag purple to match booking blocks — app/rota/day/page.tsx legend; roster.tsx:219; rota status/meta
11. [low] Today tile tags wrap ("1 shift needs cover"): shorten to "1 uncovered" / "n uncovered" — lib/rota/home.ts; cap lone tile width (.pc-stats > :only-child) — poolside.css
12. [low] Home ≤1024: empty "On now and next" panel showing only "Nothing else on today." — don't render it when nothing is left — home-view.tsx
13. [low] /rota viewer lane missing job-title caption that managers see — roster.tsx viewer branch
