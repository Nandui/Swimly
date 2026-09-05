---
target: the class page after Today
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:D:\\swimly\\src\\app\\(app)\\courses\\[id]\\class\\page.tsx"
target_fingerprint: "sha256:f1a3b4ab8e168bbb50b470641851591656e8b003ff75ac8ac57b7b55bde46120"
target_path: "D:\\swimly\\src\\app\\(app)\\courses\\[id]\\class\\page.tsx"
timestamp: 2026-09-05T09-59-18Z
slug: src-app-app-courses-id-class-page-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent)

Target: the class page reached from Today, `/courses/[id]/class?date=…` step 1 (attendance) and `&step=competencies` step 2. Source `src/app/(app)/courses/[id]/class/page.tsx`, `register-form.tsx`, `deck-checklist.tsx`, `take-over.tsx`. Operate mode. Reviewed live on Saturday 5 Sep 2026 on a class running at 10:10, at 1280 and 375, light and dark. Nothing was saved.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Marks restored from the phone arrive silently as "Not saved yet"; the status line has no live region. |
| 2 | Match System / Real World | 3 | "One swimmer at a time" reads as a mode, not a link; "Up to date" is abstract. |
| 3 | User Control and Freedom | 2 | "Everyone in" and "Everyone achieved" have no undo. |
| 4 | Consistency and Standards | 2 | Step 1 buttons 40px at 13px, step 2 44px at 14px; the unselected button has a 4.6:1 edge, the selected one 1.1:1. |
| 5 | Error Prevention | 2 | Step 2 lets an absent child be marked Achieved; "Done" is offered before anything is marked. |
| 6 | Recognition Rather Than Recall | 2 | Step 2 does not show who was in the water; chips are digits only. |
| 7 | Flexibility and Efficiency | 3 | Bulk buttons, chip jump, Previous/Next, steps in the URL. |
| 8 | Aesthetic and Minimalist Design | 3 | Step 2 intro sentence repeats the title and the card; two "n of N achieved" counters compete. |
| 9 | Error Recovery | 2 | A rejected save promise is uncaught; a dropped connection shows a spinner or an error boundary, not "your marks are safe". |
| 10 | Help and Documentation | 2 | Nothing says a second tap clears, or that marks are kept on the phone. |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** authored in the flow, generic on the surface. Everyone starts absent and you tap who is in; "Everyone in"; one competency at a time with "Everyone achieved"; the take-over question with "No, just looking"; one save for the class mirrored to the phone. No other product has that shape. But strip the labels and the surface is a stock admin list: 26px title, 14px names, 12px meta, 13px buttons at 40px, hairline cards, a selected state that is a pale tint with no edge. Swap Present/Late/Absent for Yes/No/Maybe and it ships as a survey tool. The deck is in the brief, not yet in the type scale, the targets, or the weight of the selected state.

**Deterministic scan:** `detect.mjs` over all six files: exit 0, 0 findings. The in-page overlay found 4 items on each step, all in the app shell (sidebar width transition, 10px "Working in", truncated club name, body transition). None in the page.

**Visual overlays:** injection succeeded; the overlay tab was closed afterwards.

**Browser measurements (B):** every text pair passes 4.5:1 in light and dark (selected pairs 6.4 to 6.8 light, 8.5 to 10.6 dark). Every selected mark pill's edge is 1.05 to 1.2:1 against the page in both modes; the unselected edge is 4.55 light, 3.75 dark. At 375: step 1 Present/Late/Absent 103x40 at 13px, "Everyone in" 105x40, Save and continue 174x40, tabs 38px, back link 54x20, chips 40x40; step 2 marks 156x44, Previous/Next 44x44, Save 131x44. Marks mirror to the phone on first tap and come back after a reload on both steps. No console errors, all requests 200, no page-level horizontal scroll; the chip strip scrolls inside itself with the 8th chip 3px clipped.

## Overall Impression

The model is right and the plumbing is right. The screen does not yet look like the deck it was designed for, and one promise in PRODUCT.md is not kept in code: a save that survives a dropped connection. The marks survive, but a thrown fetch escapes the transition and the instructor is not told the marks are safe.

## What's Working

- **The model.** Absent by default and tap who is in; "Everyone in"; competency at a time with "Everyone achieved"; second tap clears; one save; mirrored to the device and confirmed restored after a reload.
- **Screen-reader scaffolding.** A named group per swimmer, `aria-pressed`, `aria-current` on chips, chips labelled with the competency name, a visible focus ring.
- **Text contrast** is well above the bar everywhere measured, both modes.

## Priority Issues

**[P0] A dropped connection can throw out of Save.**
Why it matters: `await markRegister(...)` and `await saveClassAssessment(...)` run inside a transition with no catch. A returned failure is handled; a rejected promise is not. This is the one condition PRODUCT.md names. The marks are safe on the phone, but the instructor sees a spinner or an error page and does not know it.
Fix: catch, and render "Could not reach the server. Your marks are kept on this phone. Try again." with Save still enabled; a timeout on the spinner.
Suggested command: /impeccable harden

**[P1] Step two does not know who was in the water.**
Why it matters: the six absent swimmers get Working on it / Achieved buttons like everyone else; "Everyone achieved" marks them too. Working memory and error prevention both fail.
Fix: pass the register's statuses through; present and late first; absent folded under "Not in today (6)" at the bottom, dimmed but still markable; "Everyone achieved" applies to those in.
Suggested command: /impeccable distill

**[P1] The selected state has no edge, and step 1 targets are under the floor.**
Why it matters: DESIGN.md's own bar is 3:1 on control edges; in glare the tint is the whole signal for "this child is present". Step 1 buttons are 40px at 13px; the brief says 44 and 14.
Fix: selected = tag fill plus a 2px border in the pair's ink colour plus a check glyph; step 1 to 44px and 14px to match step 2; chips to 44px.
Suggested command: /impeccable bolder

**[P1] "Done" before anything is done.**
Why it matters: step 2 lands with "Up to date" and a blue "Done, back to Today" with 0 of 8 marked. An unconfident instructor reads blue as "press this" and leaves with no marks; after a save the end looks identical, so nothing is earned.
Fix: zero marks → outline "Back to Today" and "Nothing marked yet"; after a save → "Saved · 6 in · 14 marks" then the blue Done. Say when marks were restored: "Marks from earlier on this phone, not saved yet."
Suggested command: /impeccable clarify

**[P2] The whole class opens as a red wall.**
Why it matters: the record must start absent; the screen need not shout it. Eight filled red "Absent" pills and "8 absent" read as alarm.
Fix: unsaved default absent as outlined, not filled, until the row is touched or saved; the count line says "8 not marked yet" until the first tap.
Suggested command: /impeccable quieter

## Persona Red Flags

**Casey (one-handed phone):** "Everyone in" is top right, the furthest point from the thumb. The chip row needs a sideways scroll and chip 8 is clipped. A second tap clears a mark with no feedback beyond colour, so a double-tap silently undoes it. The Today back link is 54x20.

**Sam (keyboard, screen reader):** the only live region is the toaster; "8 marks not saved yet" and "1 present, 1 late, 6 absent" change silently. "Everyone in" flips eight pressed states with no announcement. The Medical summary is a tag with nothing saying it expands. Positives: real `disabled` on Previous, named groups, links with `aria-current`.

**Niamh (wet hands, glare, English second language):** the selected/unselected difference is a 1.1:1 tint. 40px buttons with 4px gaps. Words: "Working on it", "Up to date", "One swimmer at a time", "Anything about the class itself", and the take-over paragraph holds three ideas in one breath. The complete dialog says "signed off", a third word beside "achieved" and "marks". The note placeholder "Pool closed — no class this week" reads as a filled-in value.

## Minor Observations

- Tab strip is 38px at 13.5px; the brief's floors are 14px and 44px.
- Step 2 intro sentence duplicates the title and "Competency 1 of 8"; the "Covered" tag and the cover label in the description say the same thing twice.
- Swimmer meta and both sticky status lines are 12px.
- The empty attendance state offers "Competencies" as its action, a step with nobody to mark.
- "This level has no competencies yet" is a dead end with no way back to Today.
- Medical notes render at 12px in red ink.
- The "Ready to complete" dialog has an optional note field the deck will never fill.
- Loading state not seen in this run.

## Questions to Consider

- If a lesson is "run the drill, then mark who got it", why is step two a separate page? Could the competency card rise over the present swimmers on one screen?
- Should "Absent" be a button at all? Everyone starts absent and the instructor taps who is in. Two buttons, In and Late, and red only after Save.
- At seven in the evening with twelve rows, which should be 26px: the class name the instructor already knows, or the child's name they are about to mark?
