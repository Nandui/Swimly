# FINAL-01 — Final type sweep: no off-scale utilities or 500 weight left anywhere
Severity: low | Scope: system

## Files (expected)
- DESIGN.md
- apps/me/src/app/globals.css
- apps/me/src/app/layout.tsx
- src/app/(activities)/assessments/[id]/setup/page.tsx
- src/app/(activities)/students/parents/page.tsx
- src/app/(core)/layout.tsx
- src/app/(core)/roles/page.tsx
- src/app/docs/docs.css
- src/app/docs/editor.css
- src/app/docs/integration.css
- src/app/docs/layout.tsx
- src/app/docs/poolside.css
- src/app/hr/layout.tsx
- src/app/layout.tsx
- src/app/refunds/layout.tsx
- src/app/rota/layout.tsx
- src/app/shadcn.css
- src/app/training/layout.tsx
- src/app/workspace/module-workspace.css
- src/components/help/guide-screenshot.tsx
- src/components/rota/roster.tsx
- src/components/shadcn/badge.tsx
- src/components/shadcn/button.tsx
- src/components/shadcn/command.tsx
- src/components/shadcn/dropdown-menu.tsx
- src/components/shadcn/item.tsx
- src/components/shadcn/label.tsx
- src/components/shadcn/sidebar.tsx
- src/components/shadcn/table.tsx
- src/components/shadcn/tabs.tsx
- src/components/staff/role-preview.tsx
- src/components/training/manage-actions.tsx
- src/components/ui-kit/page-header.tsx
- src/modules/activities/components/analytics/dashboard.tsx
- src/modules/activities/components/analytics/instructor-report.tsx
- src/modules/activities/components/analytics/reception-report.tsx
- src/modules/activities/components/courses/class-browser.module.css
- src/modules/activities/components/enrolment/follow-up-history.tsx
- src/modules/activities/components/parents/assessment-publication.tsx
- src/modules/activities/components/progression/assessment.tsx
- src/modules/activities/components/students/student-directory.module.css
- src/modules/activities/components/students/student-search.tsx
- src/modules/activities/components/students/swimmer-profile.module.css
- src/modules/activities/components/students/swimmer-profile.tsx
- src/modules/activities/components/students/workspace-search.tsx
- src/modules/activities/components/today/calendar.module.css
- src/modules/activities/components/today/day-navigation.tsx
- src/modules/activities/components/together/combination-list.tsx

## Problem
After the module tasks, a tail of off-scale type utilities will remain. The audit counted 41 tracking-* uses, 30 leading-* uses, 135 font-medium uses in 73 files, 23 text-base and 32 text-xl, plus literal font sizes, line heights and letter-spacing in CSS modules and editor.css (13px, 12px, 1.4, em heading scales, rem values) and shadcn.css:257 (1rem). Weight 500 is still loaded by the root layout, so font-medium keeps rendering.

## Change (original)
grep src and apps/me for tracking-, leading-, text-base, text-xl, text-3xl, text-4xl, text-5xl, text-[ , font-medium, and for literal font-size, line-height or letter-spacing in *.module.css, editor.css and shadcn.css. Replace them: text-sm or text-lg, font-semibold for names, titles and labels (nothing for body), --pc-text-* and --pc-leading-* tokens in CSS. Delete tracking and leading utilities. Fix the remaining files in this list and any other match. Then delete '@fontsource/plus-jakarta-sans/500.css' from src/app/layout.tsx so 500 cannot return. Add the greps to the DESIGN.md screen checklist.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep the sweep and the deletion of the 500 import, with these adjustments.

1. Utilities (src and apps/me/src):
- Replace font-medium with font-semibold for names, titles, labels, tabs and tags, and drop it for body text. This includes the shadcn primitives badge.tsx, button.tsx, label.tsx, tabs.tsx, table.tsx, item.tsx, sidebar.tsx, dropdown-menu.tsx, command.tsx, popover.tsx, empty.tsx and alert.tsx.
- Delete every tracking-* and leading-* utility.
- Replace text-base with text-sm and text-xl with text-lg.
- Replace text-4xl and text-5xl in analytics/dashboard.tsx:29,33,37,65, instructor-report.tsx:33 and reception-report.tsx:28-29 with the shared figure style: `.pc-stat-figure`, or text-3xl font-bold (28px/700, matching SSAnalytics).
- Replace roster.tsx:172 text-[13px] with text-xs.
- Remove `uppercase tracking-wide` at swimmer-profile.tsx:76, which is a sentence-case violation.
- Limit the arbitrary-value grep to sizes (`text-\[[0-9]`). Leave arbitrary colour values such as text-[var(--pc-*)], text-[CanvasText] and text-[inherit] to the status-colour task.

2. CSS: replace literal font-size, line-height and letter-spacing with --pc-text-* and --pc-leading-* tokens, and font-weight 500 with 600 (labels) or 400 (body). Cover all of these files, not only the three listed:
- the *.module.css files (calendar.module.css:3,16,18,23,35; swimmer-profile.module.css:96,153,180,207)
- editor.css: :13 and :19 become body; :24 becomes caption; prose h1-h2 become title tokens and h3-h6 body/600
- src/app/docs/integration.css:31: delete the badge 500 rule so poolside.css:354's 600 applies
- src/app/docs/poolside.css:218 and :348 (500 becomes 600), :199 and :365 (remove -0.01em from h2 and dialog titles; keep it only on the H1)
- src/app/workspace/module-workspace.css:48
- src/app/docs/docs.css (weight 500, letter-spacing and literal px)
- apps/me/src/app/globals.css: :56 h2 spacing; :78 and :113 weight 500

3. Keep these deliberate exceptions and document them next to the rule:
- the 16px field text on touch at shadcn.css:257 and apps/me globals.css:109 (DESIGN.md:30), which must not become 14px
- document prose body at 16px/26px, set from the approved V2Document and DCEdit `.prose` (today it renders 18px/32.4px)
- the brand wordmark lockup
- the OTP `.code` letter-spacing in apps/me

4. Only after steps 1-3, delete '@fontsource/plus-jakarta-sans/500.css' from both src/app/layout.tsx:17 and apps/me/src/app/layout.tsx:4. Otherwise anything still asking for 500 falls back to the 400 face.

5. Add the narrowed greps to the Layout check bullet at DESIGN.md:202-203. That is the screen checklist, since no section has that name. Also note in DESIGN.md:170 that the page H1's -0.01em is the only letter-spacing.

Acceptance:
- The greps return nothing except the documented exceptions and print styles.
- A computed-style sweep at 1280 light over the audited routes finds no weight 500 (tags at 600), no letter-spacing except the H1's, and no size outside 12/14/18/28 except 16px fields on touch and 16px document prose.
- typecheck and lint pass.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep the goal. Apply it with these safer instructions.

1. Fonts. Delete all four '@fontsource/plus-jakarta-sans/*.css' imports from the six nested layouts: src/app/(core), docs, hr, refunds, rota and training layout.tsx. They duplicate the root layout, which is the only one rendering <html>. Then delete only '500.css' from src/app/layout.tsx. Leave apps/me alone in this task. It has its own layout, its own 13/15 scale and no class matches. If you do touch it, change globals.css:78 and :113 to 600 in the same commit as removing its 500 import.

2. Before removing the 500 face, replace every CSS 'font-weight: 500'. That covers poolside.css:218 and :348 (use 600), calendar.module.css:16 (600) and all 18 lines in docs.css. Write the replacement explicitly as 600 for names, labels, nav, buttons, legend and strong, or 400 for body text and selects. Never just delete it on strong, th, b or legend selectors, because the browser default there is bold. Delete the integration.css:31 rule '.turnfin-docs [data-slot=badge] { font-weight: 500 }' so poolside's 600 applies.

3. Use class-only regexes in .ts/.tsx files.
   - (^|[\s"'`:])(tracking|leading)-[a-z0-9]: delete these. In swimmer-profile.tsx:76, also delete 'uppercase'.
   - \bfont-medium\b: use font-semibold for names, titles and labels, and nothing for body text. On strong, th or b elements use font-normal or font-semibold, never nothing.
   - \btext-(base|xl)\b: change to text-sm or text-lg.
   - \btext-(3xl|4xl|5xl)\b: these are summary figures in analytics dashboard.tsx:29, 33, 37 and 65, reception-report.tsx:28 and 29, and instructor-report.tsx:33. Use the existing .pc-stat-figure class and drop tracking-tight. Don't use text-sm or text-lg.
   - text-\[[0-9.]+(px|rem|em)\]: the only match is roster.tsx:172 text-[13px]. Change it to text-xs, not text-sm.
   - Leave every colour arbitrary value alone: text-[var(--…)], text-[CanvasText] and text-[inherit].

4. CSS modules. Change var(--text-base) to var(--pc-text-body) in class-browser.module.css:54 and student-directory.module.css:47. Change var(--text-xl) to var(--pc-text-title) in swimmer-profile.module.css:33. Convert swimmer-profile.module.css:96, 153, 180 and 207 from rem to --pc-text-* with the matching --pc-leading-*. In calendar.module.css, delete letter-spacing at lines 3 and 23, and change line-height 1.25 (line 18) and 1.3 (line 35) to --pc-leading-title and --pc-leading-body. Keep poolside.css:89–102, the --text-* to --pc-text-* mappings, as the safety net.

5. editor.css. Fix only the editor chrome: delete font-size at line 13 so poolside's field rule (16px on phones, 14px on desktop) applies, and use var(--pc-text-caption) with --pc-leading-caption at lines 19 and 24. Leave .document-prose alone (lines 26–32, 37 and 45). It is document content that scales with the reader's Text size control and with authored font sizes.

6. shadcn.css:257 'font-size: 1rem'. Do not change it. It is the iOS focus-zoom guard for touch and narrow screens, and the only 16px rule for [data-slot=command-input]. Add a comment saying so. poolside.css:370's 16px and apps/me's .input 16px are the same exception.

7. Letter-spacing. Keep the H1 rules (poolside.css:195, refunds.css:11, module-workspace.css:12). Delete letter-spacing from poolside.css:199 (h2) and :365 (dialog, alert-dialog and sheet titles), module-workspace.css:48, and every non-zero letter-spacing in docs.css (37 declarations, including h2 -0.5px at line 4356, which applies on / and /docs). The brand wordmark (poolside.css:211, 212, 415, 416, 425) is the logo. Exempt it.

8. DESIGN.md screen checklist. Add the regexes from step 3, plus 'font-weight: 500' and literal font-size, line-height and letter-spacing in *.css. List the exceptions: the H1 rules, .brand-wordmark, .document-prose, the 16px field and command-input touch rules, and print.

9. Acceptance:
   - The class regexes return nothing.
   - No CSS font-weight: 500 remains anywhere.
   - The 500 import is gone from every Work layout.
   - A computed sweep at 1280 light over the audited routes finds no weight 500, no size outside 12/14/18/24/28, and no letter-spacing except on the H1 and its children. Exclude .document-prose, .brand-wordmark and Next's built-in not-found page (re-check any route id that 404s).
   - Spot-check at 375 with touch emulation that /students search and the sidebar swimmer search compute to 16px.
   - Check /rota at 1024 that cells are no worse than today.
   - typecheck and lint pass.

## Acceptance
The greps return no matches (except print styles and the H1 -0.01em rule). A computed-style sweep at 1280 light over the 68 audited routes finds no font-weight 500, no font size off 12/14/18/24/28, and no letter-spacing other than the H1's. typecheck and lint pass.

## Verification notes
- KEEP: The problem is real today, and the direction is right. A few parts of the change are wrong and the file scope is too narrow.

Evidence in code: grep over src and apps/me/src matches the audit exactly: 135 font-medium uses in 73 files, 41 tracking-* and 30 leading-*. src/app/layout.tsx:17 still imports @fontsource/plus-jakarta-sans/500.css, and so does apps/me/src/app/layout.tsx:4.

Evidence live: a computed-style sweep at 1280 light found the following.
- /analytics: figures render at 48px and 36px, semibold, letter-spacing -1.2px. The source is text-5xl and text-4xl in analytics/dashboard.tsx:29,33,37,65, instructor-report.tsx:33 and reception-report.tsx:28-29. The SSAnalytics mockup shows 28px/700 figures. Screenshots: shots/audit2/final01/live-an-top.png vs mock-an-top.png.
- Card titles on /analytics render at 14px/500 with -0.5px letter-spacing.
- Weight 500 also shows on /staff/sbx_ava, /roles, /help, /students and the swimmer profile tabs.
- Every status tag (Active, Built in, Draft) renders at 500. The cause is src/app/docs/integration.css:31 `.turnfin-docs [data-slot='badge'] { font-weight: 500 }`, which beats the 600 in poolside.css:354. The V2System .tag is 600.
- h2 headings carry negative letter-spacing everywhere. poolside.css:199 and :365 set -0.01em on h2 and dialog titles, and calendar.module.css:3 sets -0.025em on the /schedule H1 (renders -0.7px).
- swimmer-profile.tsx:76 uses `text-xs uppercase tracking-wide`, a capitals label.
- On a live document, the prose body is 18px/32.4px and the h2 is 27px. The source is the em heading scale at editor.css:26-32.

The mockups use only weights 400/600/700, and letter-spacing only on the page H1. That matches DESIGN.md:166-170. So the sweep moves the app toward the direction.

Corrections needed:
(1) shadcn.css:257 `font-size: 1rem` on input, textarea and command-input is the deliberate 16px-on-touch rule. DESIGN.md:30 says "Fields keep 16px text on touch so phones do not zoom on focus", and poolside.css:432-436 already brings fields back to 14px on fine-pointer desktops. Changing it to a 14px token would make phones zoom on focus. The same applies to apps/me globals.css:109 `.input` 16px.
(2) The approved V2Document and DCEdit mockups set `.prose{font-size:16px;line-height:26px}`, so document prose legitimately sits off the 12/14/18/28 app scale.
(3) The CSS grep is limited to *.module.css, editor.css and shadcn.css, so the acceptance sweep would still find 500 weights and letter-spacing in other files: integration.css:31; poolside.css:218, :348 (weight 500), :199, :365 (-0.01em); module-workspace.css:48; docs.css (18 font-weight:500, 44 letter-spacing, 66 literal sizes, although DESIGN.md:205 says docs.css uses tokens only); apps/me globals.css:56, 78, 113. Deleting 500.css before these are fixed makes the browser fall back to the 400 face, so every tag and the Docs nav would get lighter, which moves away from the 600 tag rule.
(4) 45 of the 48 `text-[` matches are arbitrary colour values (text-[var(--pc-warning)] in rota), text-[CanvasText] in native-select and text-[inherit]. Only roster.tsx:172 `text-[13px]` is a type problem. A blanket "no matches" rule would push type fixes onto colour code.
(5) text-base, text-xl and text-3xl already resolve on-scale through poolside.css:93-102, so replacing them is hygiene with no visual change. The visible defects are text-4xl/5xl, the tracking utilities, weight 500 and the uppercase label.
(6) DESIGN.md has no section called "screen checklist". The nearest is the Layout check bullet at DESIGN.md:202-203.
- KEEP: The change is the right direction, but as written it would miss its own goal, cause four regressions, and set an acceptance target that can't be met. All of these can be fixed by amending the change. Evidence from repo greps and live sandbox probes at 1024 and 1280 light:

(1) Weight 500 would keep loading. '@fontsource/plus-jakarta-sans/500.css' is imported by 7 layouts, not one: src/app/layout.tsx:17 and the nested (core)/layout.tsx:12, docs/layout.tsx:10, hr/layout.tsx:15, refunds/layout.tsx:12, rota/layout.tsx:13 and training/layout.tsx:13. The root layout is the only one that renders <html>, so the nested imports are duplicates.

(2) Some text would silently thin to 400. 23 CSS rules still declare font-weight: 500: poolside.css:218 and :348, integration.css:31, calendar.module.css:16, and 18 lines in docs.css. Once the 500 face is gone these render at 400, yet computed style still reports 500, so acceptance fails. Live, the badge on / already computes to 500 because integration.css:31 overrides poolside's 600. Several docs.css 500 rules target strong (lines 750, 955, 1349, 1364, 1593, 1939). Simply deleting those declarations would turn the text bold (700), not normal.

(3) The text-[ grep is unsafe. 47 of its 48 matches are colour utilities, not sizes: text-[var(--pc-warning/danger/success…)] status colours shown with icons in Rota, text-[CanvasText] in native-select.tsx:39 and :49, and text-[inherit] in swimmer-profile.tsx:58. Replacing them with text-sm would wipe out the colours. Only roster.tsx:172 text-[13px] is a font size. I measured "18:00–21:00" in that cell at 73, 80 and 86px for 12, 13 and 14px, against 39–74px of room, because poolside adds 16px padding to the button. So the cell already overflows at 13px, and text-sm would make it worse.

(4) Field text on touch devices would drop below 16px. shadcn.css:257 (font-size: 1rem) sits inside @media (max-width: 48rem), (pointer: coarse). It is the only rule that gives [data-slot=command-input] 16px. That input is the swimmer and instructor search in student-search, workspace-search, course-filters, instructor-picker and searchable-picker. poolside.css:370's 16px field rule doesn't cover it. Below 16px, iOS Safari zooms in when the field gets focus, including on Instructor tablets. The acceptance sweep runs only at 1280, so it would never catch this.

(5) Document headings would break. The editor.css:26–32 em heading scale is authored document content (.document-prose), not app chrome. It scales with the reader's Text size control (reader.tsx:82 and :274, --reading-size 16–24px) and the editor's per-run font sizes (formatting.ts:6, 12–48px, tested in content.test.ts:20). Fixed tokens would stop headings scaling and squash h1–h6 into four sizes.

(6) The literal greps can never come back empty. 'leading-' matches 110 --pc-leading-* token uses in CSS, including apps/me/src/app/globals.css, and 'text-base'/'text-xl' match poolside.css:93–98. Deleting those mappings would bring back the defaults from globals.css @theme (text-lg 17px, base 16px, xl 20px, 3xl 30px).

(7) The acceptance can't pass for reasons outside the listed files. Live h2s compute letter-spacing -0.5px on / and /docs from docs.css:4356. poolside.css:199 and :365 and module-workspace.css:48 also add letter-spacing to h2 and dialog titles. Brand wordmark sizes of 20px and 13px are in poolside.css:211, :212, :415, :416 and :425.

(8) The change offers only text-sm or text-lg, but the summary figures in analytics use text-4xl and text-5xl. Shrinking them to text-sm or text-lg would visibly downgrade them.

Not affected: the import boundaries and lint rules, since there are no import or data changes; typecheck; and tests, since no test or e2e file refers to these classes.