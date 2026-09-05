---
target: today
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\swimly\\src\\app\\(app)\\today\\page.tsx"
target_fingerprint: "sha256:0fff172aa156b48667bab46dc7b59f0425aecba59f2d1ed9342c4ccbac91a4a5"
target_path: "D:\\swimly\\src\\app\\(app)\\today\\page.tsx"
timestamp: 2026-09-05T09-19-24Z
slug: src-app-app-today-page-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector/browser sub-agent)

Target: /today (`src/app/(app)/today/page.tsx`), Operate mode. Reviewed live on Saturday 5 Sep 2026 at 10:10 with 35 classes on the day, at 1280px and 375px, light and dark, plus the class page it opens.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Level view drops the Now/Next marks; marks held unsaved on the device are invisible from Today. |
| 2 | Match System / Real World | 3 | "Group by" is app-speak. "Start class" was the owner's choice; it reads as starting the lesson. |
| 3 | User Control and Freedom | 3 | URL-held state and back links. Opening the fold pushes Now a screen and a half down on a phone. |
| 4 | Consistency and Standards | 3 | Attendance buttons 40px, competency buttons 44px. "Everyone in" is a ghost beside real buttons. |
| 5 | Error Prevention | 3 | The class name is a second, silent tap target that leaves the deck for the desk page. |
| 6 | Recognition Rather Than Recall | 3 | Level view repeats the level name on every row and makes you remember the time. |
| 7 | Flexibility and Efficiency | 3 | Two tabs, two groupings. No jump back to Now once scrolled. |
| 8 | Aesthetic and Minimalist Design | 2 | About 320px of header before the first class on a phone; five identical blue buttons per section. |
| 9 | Error Recovery | 2 | Today never says "you have unsaved marks in X" even though both forms mirror to the device. |
| 10 | Help and Documentation | 3 | One 12px footer sentence under 35 rows. |
| **Total** | | **28/40** | **Good** |

## Design Specificity Verdict

**LLM assessment:** the thinking is authored for a swim school deck. The page knows the clock, speaks the club's words, and aims the blue button at the one person who should press it. The form is still the generic admin kit: header, tab strip, bordered list, right-hand button. On a pool deck in glare the form is what you see first, and it does not yet look like something built for a wet thumb.

**Deterministic scan:** `detect.mjs` over the page, four kit parts, the class page and the deck checklist: exit 0, 0 findings. In-page overlay reported 13 anti-patterns; 9 are false positives (the closed "Earlier today" fold's hidden rows still return rectangles, so the overlay thought they covered visible rows) and 3 are the app shell (sidebar width transition, 10px "Working in" label, truncated club name). Real findings on Today: none.

**Visual overlays:** injection succeeded; the overlay tab was closed afterwards.

**Browser measurements (B):** no console errors, all requests 200, no horizontal scroll at 375 on Today or the class page. Every text pair passes 4.5:1 in both modes. Control edges pass 3:1; the selected Group-by pill is 3.07:1 in dark, right at the bar. Under 44px at 375: tabs 38px, Group-by pills 40px, the fold summary 40px, class-name links 20px, attendance Present/Late/Absent 40px, Save and continue 40px, competency chips 40px. At 44px: Start class, Working on it / Achieved, Previous / Next, Done. Reduced motion is covered globally.

## Overall Impression

Up from 25 to 28 since the first review. The three big gaps then are closed: the tabs no longer clip, Now and Next exist, covered classes no longer shout. What is left is the deck's form. It is still a list built for a desk, worn on a phone. The single biggest opportunity is to make the Now section the screen and demote everything else, including the header.

## What's Working

- **The screen knows the time.** Now, Next, and the fold turn a timetable into a to-do list. That is the deck-specific idea, and it lands.
- **One button per row, aimed at one person.** Full width and 44px on a phone, blue only for the person who should press it, with an accessible label naming the class and time.
- **Colour discipline holds in both modes.** Every pair measured passes; status comes only from two metadata maps.

## Priority Issues

**[P1] Five identical blue buttons per section on a phone.**
Why it matters: the label carries no information. The instructor must read 14px text above each to pick the right one, and every later section shouts as loudly as Now.
Fix: make the row the target (name at 17px semibold, meta on one muted line, verb as a trailing label); keep blue for Now and Next only, outline for later sections. The `primary` switch already exists; add the phase to it.
Suggested command: /impeccable distill, then /impeccable layout

**[P1] The header stack before the first class.**
Why it matters: H1, date, two-line sentence, tabs, Group-by, fold summary. The Now heading sits around y=400 on an 812px phone before any class is visible.
Fix: fold the date into the H1 line, drop the sentence (the tab counts say it), make the segment a compact pair beside the tabs, and move the fold summary below the Now section.
Suggested command: /impeccable distill

**[P1] The class name is a silent link off the deck.**
Why it matters: it is the natural thing to tap, sits 27px above the button, and takes anyone whose role sees Classes to the desk's course page. Roles without that screen already get plain text.
Fix: plain text for everyone on Today; put the course link in the class page header instead.
Suggested command: /impeccable harden

**[P2] Level view loses the clock and repeats itself.**
Why it matters: an instructor in Level view still needs to know which of seven rows is now. Rows read "09:00 Starfish" under a heading that says Starfish.
Fix: row-level Now/Next tag in Level view; omit the name when it equals the section title.
Suggested command: /impeccable clarify

**[P2] Unsaved marks are invisible from Today.**
Why it matters: the dropped-wifi moment is the one the product promises to survive, and Today is where the instructor looks when the connection comes back.
Fix: a small client island per row reads the two storage keys and shows an orange "Not saved yet" tag, with the button reading "Continue".
Suggested command: /impeccable harden

**[P3] Sub-44px targets and the ghost "Everyone in".**
Fix: raise `max-md` heights to 44px on tabs, Group-by pills, attendance buttons and Save; give "Everyone in" and "Everyone achieved" an outline.
Suggested command: /impeccable polish

## Persona Red Flags

**Casey (one-handed phone):** the Time/Level segment sits top right, out of a left thumb's reach. Opening the fold moves Now a screen and a half away. Five same-label buttons mean reading, not recognising. Tapping the class name leaves the deck.

**Sam (keyboard, screen reader):** mostly good: skip link, labelled nav and sections, sr-only commas, aria-current and aria-pressed, a real focus ring. Flags: 70 tab stops on All classes with no jump to Now; the name link and the button are duplicate targets per row; the step strip on the class page is a nav of tabs, so nothing says step 2 follows step 1.

**Niamh (wet hands, glare, English second language):** 12px meta and 13.5px tab text in glare. "Group by" and "attendance is still to take for" are app phrasing. Step 1 opens as a column of red "Absent" buttons, which looks like she did something wrong. "Everyone in" looks like a caption, not the one tap she needs. "Working on it" is an idiom.

## Minor Observations

- "Next" is grey and nearly indistinguishable from the muted count beside it; Now blue vs Next grey is a weak pair in glare.
- The Play icon on "Start class" suggests media playback.
- The date line and the count sentence are the same kind of muted line and read as one.
- The footer sentence sits under 35 rows at 12px.
- Selected Group-by edge is 3.07:1 in dark, right at the bar.
- On step 2 the "One swimmer at a time" link looks like a subtitle on a phone.
- The dev banner adds about 200px on a phone; dev only, but it distorts every fold judgement while on.
- On this data the dev admin teaches every class, so the covered-by-another state never rendered; judged from source.

## Questions to Consider

- At 10:10 the instructor has one class on now and one next. Why is Today a list of 35 at all, rather than a Now card, a Next line, and everything else behind one fold?
- Should the button say what it does ("Take attendance") rather than what it feels like ("Start class")? The owner chose the second; worth a look with a real instructor.
- If the deck comes first, why does the deck share the desk's 14px list kit? What would a glare-first scale look like: time at 20px, name at 17px, nothing under 14px?
