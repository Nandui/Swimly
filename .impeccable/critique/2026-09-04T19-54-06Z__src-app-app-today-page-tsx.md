---
target: /today
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\swimly\\src\\app\\(app)\\today\\page.tsx"
target_fingerprint: "sha256:e91288522693f26394f6ca7441ac27d49979d0d4c8b2c8061423b3afc8fc4ffb"
target_path: "D:\\swimly\\src\\app\\(app)\\today\\page.tsx"
timestamp: 2026-09-04T19-54-06Z
slug: src-app-app-today-page-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent)

Target: /today (`src/app/(app)/today/page.tsx`), Operate mode. Reviewed live at http://localhost:3000/today at 1280px and 375px, light and dark.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Nothing marks the class running now or next; nothing says whether the list is current on dropping wifi. |
| 2 | Match System / Real World | 3 | One thing, two names: "register" (summary, footer, next page) vs "attendance" (tags, buttons). |
| 3 | User Control and Freedom | 3 | State lives in the URL and back works. No way back from a take-over on this screen. |
| 4 | Consistency and Standards | 2 | Class name links to the course page; the button goes to the register. Group-by pills do not grow on a phone as buttons do. |
| 5 | Error Prevention | 2 | A class of mine that a colleague has covered still shows a blue "Take attendance" under "Your class" (page.tsx:290, :318-328). |
| 6 | Recognition Rather Than Recall | 3 | Tab counts are hidden on mobile (tab-strip.tsx:48), so which list you are in is remembered, not seen. |
| 7 | Flexibility and Efficiency | 2 | No jump to now/next, no "outstanding only" view; 20 rows means a scroll every time. |
| 8 | Aesthetic and Minimalist Design | 2 | 19 identical yellow tags; class name repeated in the meta line; "Your class" on every row of the Mine tab. |
| 9 | Error Recovery | 2 | No error states of its own; a failed take-over is a toast on the next screen. |
| 10 | Help and Documentation | 3 | The footer sentence and empty-state hint are the right in-place help, placed at 12px below a 20-row list. |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** the words are authored for this club (register, cover, competencies, Learner Pool, level names). The layout is not. Strip the strings and what remains is a generic admin "today list": H1, two tabs, a segmented control, a bordered list with two buttons per row. Nothing in the composition knows it is poolside at 15:45. There is no "now", no "next", and no difference between a class that has run and one still to come.

**Deterministic scan:** `detect.mjs` over page.tsx and the four ui-kit components: exit 0, 0 findings. In-page overlay found 3 anti-patterns, all in the app shell, none in the Today page: a 10px "Working in" label in the sidebar, `transition: width` on the sidebar `aside`, `transition: height` on `body`.

**Visual overlays:** injection succeeded (the page has no CSP). The overlay tab was closed at the end of the run, so no overlay is left open.

**Browser measurements (B):** no console errors, all 101 requests 200, no page-level horizontal scroll at 375px. Fonts load as designed (Outfit headings, Work Sans body). Every text pair passes 4.5:1 in dark. In light, the active tab count pill is 4.31:1 (fail). Control edges: outline button border 1.13:1 light, group-by container and selected state 1.13:1 light / 1.72:1 dark (all fail the 3:1 bar DESIGN.md sets). No element in `main` reaches 44px in either viewport: buttons are 28px desktop / 40px mobile, group-by pills 28px both, tab strip 38px.

## Overall Impression

A correct, calm list that does its job on a desktop and gets in its own way on a phone. The strongest thing on the page is the summary sentence. The biggest opportunity: make the screen know what time it is. An instructor with four classes and one thumb should see "Next: 16:20" at the top, not scan 20 equal rows.

## What's Working

- **The sentence.** "20 classes of yours today, and 19 registers are still to take." Club's words, one idea, count in the orange tag ink token. The most authored thing on the page.
- **URL-held state, server-rendered.** Tabs and grouping are links. Back works, a link can point at "All classes by level", and `loading.tsx` paints the shell first.
- **The mobile row.** Full-width 40px buttons split 50/50, blue only while the register is outstanding. All tag pairs measure 6.4:1+ light and 8.2:1+ dark.

## Priority Issues

**[P1] The tab strip clips "All classes" to "All class" at 375px.**
Why it matters: All classes is the route to covering, the one thing PRODUCT.md says must be right, and it is the tab that gets cut on the target device. Both reviewers found it (nav scrollWidth 174 > clientWidth 148).
Fix: stack Group-by below the tabs under `sm` (page.tsx:91-120). A two-tab strip must never scroll.
Suggested command: /impeccable layout

**[P1] There is no "now".**
Why it matters: the primary task is "find my next class, open its register". Today that is a scan of 20 rows and a mental clock.
Fix: compute the time in `SCHOOL_TIMEZONE`, label the running and next sections, pin them to the top, fold earlier sections behind "Earlier today (n)" (page.tsx:198-210).
Suggested command: /impeccable layout

**[P1] Blue "Take attendance" on a class someone else has covered.**
Why it matters: two people each see a blue button saying "take it" for one class. That is how two registers get taken or the wrong name lands on the row.
Fix: when `cover && !covering`, use the outline variant, replace "Your class" with "<name> is covering", sort those rows last (page.tsx:281-291, :318-328).
Suggested command: /impeccable harden

**[P2] Say each thing once, in one word.**
Why it matters: repetition slows the scan, and "register" vs "attendance" breaks the "consistent terms" rule for staff whose first language is not English.
Fix: omit the level from meta when it equals the course name (page.tsx:287 vs :302); drop "Your class" on the Mine tab; tag only exceptions; pick "register" everywhere ("Take register", "Register taken").
Suggested command: /impeccable distill

**[P2] Targets and edges miss the project's own bar.**
Why it matters: PRODUCT.md asks for a thumb's height; DESIGN.md asks for 3:1 control edges. Nothing in `main` reaches 44px; group-by pills are 28px on a phone; outline button borders are 1.13:1 in light; the active tab count pill is 4.31:1 in light.
Fix: give Group-by the same `max-md:h-10` treatment as buttons; consider `size="lg"` (44px) for the deck's one primary button; raise `--border` on outline buttons to the `--input` slate; darken the active count pill ink.
Suggested command: /impeccable adapt

## Persona Red Flags

**Casey (one-handed phone):** "All class" truncated with a scrollbar under it reads as broken. The 17:30 class is four thumb-scrolls down with no "now" marker. A fat-finger on the class name opens the course page, not the register. Time/Level pills at 28px sit beside the tabs; a miss flips the tab.

**Sam (keyboard, screen reader):** 20 identical "Take attendance" / "Competencies" links with no aria-label naming the class (page.tsx:324-333), against DESIGN.md's own checklist. The H2 reads as "15:103 classes" (page.tsx:143-149, no separator). Tags are bare spans inside the title, so the row runs together. Focus ring is real and visible in both modes; skip link present.

**Niamh (wet hands, glare, not confident, English second language):** "Amend attendance", "Competencies", "across the pool" are not short common words. A yellow "not taken" on every class before the afternoon starts reads as "you are in trouble". The only explanation of cover is 12px muted text at the bottom. 12px meta and tags in glare pass contrast but size does the damage.

## Minor Observations

- Rows have `hover:bg-accent/40` with nothing clickable on the row itself (page.tsx:294): a hover-only promise.
- Tab count pills hidden below `sm`; on a phone that is where "26 vs 20" would say six classes are not hers.
- Tags wrap onto a second line on mobile covered rows, leaving the title ragged.
- Level grouping puts the time at the same weight as the name.
- The loading skeleton draws a table-header bar the real page does not have.
- Empty-state hint and footer sentence say the same thing in different words.
- `prefers-reduced-motion` covers only `.shimmer` and toasts; tab, button and row transitions are not under it.
- Shell (out of scope here): 10px "Working in" label; `transition: width` on the sidebar and `transition: height` on body.

## Questions to Consider

- If the only thing an instructor does here is open the next register, why is the class name the link and the register the button? What if the whole row were the register?
- Is "Attendance not taken" a status, or the default? What if only exceptions carried a tag and the button carried the verb?
- Should Today show 20 classes at all? One "Now / Next" card, everything else a tap away?
