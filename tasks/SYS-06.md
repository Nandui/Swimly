# SYS-06 — One segmented control (links and choices) that wraps instead of scrolling
Severity: high | Scope: system

## Files (expected)
- DESIGN.md
- src/app/docs/docs.css
- src/app/docs/integration.css
- src/app/docs/poolside.css
- src/app/shadcn.css
- src/components/docs/appearance-menu.tsx
- src/components/hr/actions.tsx
- src/components/rota/absences.tsx
- src/components/rota/actions.tsx
- src/components/shadcn/README.md
- src/components/shadcn/checkbox.tsx
- src/components/shadcn/dropdown-menu.tsx
- src/components/shadcn/radio-group.tsx
- src/components/shadcn/tabs.tsx
- src/components/staff/role-actions.tsx
- src/components/theme-toggle.tsx
- src/components/ui-kit/link-segments.tsx
- src/components/ui-kit/segmented-links.tsx
- src/components/ui-kit/tab-strip.tsx
- src/components/workspace/account-menu.tsx
- src/modules/activities/components/attendance/class-session.tsx
- src/modules/activities/components/attendance/register-form.tsx
- src/modules/activities/components/duty/duty-view.tsx
- src/modules/activities/components/enrolment/enrolment-actions.tsx
- src/modules/activities/components/instructor/class-navigation.tsx
- src/modules/activities/components/instructor/instructor-shell.tsx
- src/modules/activities/components/instructor/teaching-ui.tsx
- src/modules/activities/components/progression/assessment.tsx
- src/modules/activities/components/progression/deck-checklist.tsx
- src/modules/activities/components/students/class-enrolment-dialog.tsx
- src/modules/activities/components/students/swimmer-profile.module.css
- src/modules/activities/components/students/swimmer-profile.tsx

## Problem
There is one v2 pattern (.pc-seg) and about ten implementations. LinkSegments (link-segments.tsx) has no importers. TabStrip (tab-strip.tsx) is an underline tab bar used once, for the desk steps, with numbered labels ('1. Attendance', '2. Competencies'). The swimmer profile uses TabsList variant='line': underline, weight 500, inactive labels at 4.39:1, broken when wrapped at 375. ThemeToggle has blue unselected labels, a shadow on the selected item and 36px items. MarkChoices uses 16px bordered boxes with a reserved check slot, and in dark mode RadioGroupItem's base classes (dark:bg-ui-input/30) fill the unselected items grey. The role level picker is built from Labels whose text is pushed to the top. The enrolment radio cards copy the same classes. .pc-seg itself scrolls sideways with a hidden scrollbar (poolside.css:609), so at 375 /activity hides five modules, /courses hides 'Archived', the assessment and analytics pages hide the current page, and the deck class steps hide 'Class overview'. Radios and checkboxes are 16px with shadow-xs, against 20px in the sheet.

## Change (original)
1) segmented-links.tsx exports SegmentedLinks (links with aria-current, as today), SegmentedChoice (Radix RadioGroup with role=radio, each item .pc-seg-item, CircleCheck shown only on the checked item) and a button mode (aria-pressed) for client-state switches. Counts use .pc-seg-count. 2) poolside .pc-seg: flex-wrap: wrap; row-gap: 4px; overflow: visible (never scroll). Below 768px use border-radius var(--pc-radius-card) so a wrapped bar is not a stadium. The selected rule becomes .pc-seg-item:is([aria-current],[aria-pressed='true'],[data-state='checked']). Let tabs-list[data-variant=default] wrap the same way. 3) Delete link-segments.tsx and tab-strip.tsx. In class-session.tsx:218-233, use SegmentedLinks with label 'Steps' and the items 'Attendance' and 'Competencies' (no numbers; counts in the count slot). 4) tabs.tsx: delete the 'line' variant and its after: underline classes; trigger font-semibold; remove the focus-visible ring classes. In swimmer-profile.tsx:63, use the default TabsList. 5) radio-group.tsx:30: apply the dot styles (aspect-square, text-ui-primary, shadow-xs, dark:bg-ui-input/30) only when the item has no children. Default radio and checkbox (checkbox.tsx:16) become size-5 with no shadow, and the checkbox uses a token radius instead of rounded-[4px]. 6) ThemeToggle becomes SegmentedChoice System/Light/Dark with icons; remove rounded-ui-lg, shadow-sm, font-medium and the blue unselected text. 7) MarkChoices (teaching-ui.tsx) becomes SegmentedChoice, full width under 640px; delete teaching-ui's own SegmentedChoice and the reserved check slot. 8) The role-actions LevelRow (86-103) and the enrolment-actions radio cards (329, 337) become SegmentedChoice. Module tasks convert their own view toggles.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep SYS-06 as written, with these corrections:

1. Desk steps (class-session.tsx:218-233): use SegmentedLinks with label 'Class steps' and the items '1. Attendance' and '2. Competencies'. These match the approved SSClassRegister mockup and the deck's InstructorClassNavigation (class-navigation.tsx:10-11). Keep the numbers, and use the count slot only for counts. Then delete tab-strip.tsx and link-segments.tsx as planned.

2. SegmentedChoice: no CircleCheck. The selected state is only .pc-seg-item:is([aria-current],[aria-pressed='true'],[data-state='checked']): --pc-surface fill, an inset 1px --pc-line-strong edge and --pc-ink text, as in ADAccount, ADRoles, DeckAttendance and V2System. Give it an optional leading icon per option; Appearance uses Monitor, Sun and Moon, as in the V2System menu. Build SegmentedChoice directly on RadioGroupPrimitive. That way the shadcn RadioGroupItem goes back to being only a dot radio: remove its `children ??` branch instead of adding conditional classes. After the conversions, nothing passes it children (new-document, hr/actions, rota/*, legend-agreement-field and class-enrolment-dialog all self-close it). Make it size-5 with no shadow-xs. The checkbox (checkbox.tsx:16) becomes size-5 with no shadow and a token radius in place of rounded-[4px].

3. .pc-seg in poolside.css:609: replace `overflow-x:auto; scrollbar-width:none` with `flex-wrap:wrap; row-gap:8px; overflow:visible`. Use 8px, not 4px, so the items' 44px hit areas (margin -4px 0) don't overlap between rows. Set `border-radius: var(--pc-radius-panel)` at every width instead of a rule below 768px. On a single 44px row the corner radii clamp to 22px, so it still renders as the pill. On wrapped rows the corners stay concentric with the 36px inner pills, with no breakpoint rule. Give [data-slot='tabs-list'][data-variant='default'] (poolside.css ~600) the same wrap, row-gap and radius.

4. MarkChoices (teaching-ui.tsx:23-44): replace its inline RadioGroup, the reserved Check slot and the invisible bold-width spacer with SegmentedChoice, full width under 640px. The callers are register-form.tsx:355 and deck-checklist.tsx:399 and 466. (teaching-ui has no SegmentedChoice of its own to delete.)

5. Also convert assessment.tsx:213-226 (the MARK_ORDER RadioGroupItems with the copied radio-card classes) to SegmentedChoice, along with role-actions LevelRow (86-103) and the enrolment-actions radio cards (~326-345).

6. Account menu (account-menu.tsx:40-45): keep DropdownMenuRadioGroup and DropdownMenuRadioItem, because role=menu may only own menuitemradio items, not a radiogroup. Lay the group out as .pc-seg, full width, with each DropdownMenuRadioItem as .pc-seg-item at flex:1 with its icon, as the V2System menu shows. The [data-state='checked'] selector styles it, so the menu and /account look the same. Delete src/components/docs/appearance-menu.tsx: AppearanceMenu has no importers.

7. Steps 4 (tabs.tsx: delete the line variant and its after: classes, triggers font-semibold, remove the ring classes, since poolside.css:248 already outlines [role='tab'] on focus) and 6 (ThemeToggle becomes SegmentedChoice) stay as written.

Acceptance as written, with these changes: /courses/<id>/class shows '1. Attendance | 2. Competencies' as a soft pill bar; no checked segment shows an extra check icon; and the account menu Appearance is a full-width segmented row.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) segmented-links.tsx: keep SegmentedLinks as it is. Add SegmentedChoice, built from RadioGroup and RadioGroupItem imported from "@/components/shadcn/radio-group". Do not import 'radix-ui' (lint). Props:
- options: { value, label, icon?, count? }[]
- pass through value, defaultValue, onValueChange, name, required, disabled, aria-label, aria-labelledby, aria-describedby
- fill?: boolean | "phone"
The root gets className "pc-seg" (plus "pc-seg-fill" or "pc-seg-fill-phone"). Each item gets className "pc-seg-item"; counts go in .pc-seg-count. Do NOT add an aria-pressed button mode, because a shadcn Button inherits the ghost colour and padding rules at poolside.css:341 and 346, which outrank .pc-seg-item. Client-state single-choice switches use SegmentedChoice. Do NOT show a check icon on the checked item: the sheet has none, and it shifts neighbours. Selection is the white surface plus the inset line-strong edge. An option may carry a permanent icon (Appearance: Monitor, Sun, Moon).

2) poolside.css:
- .pc-seg: remove overflow-x:auto and scrollbar-width. Add flex-wrap: wrap; gap: 8px 0; overflow: visible. Use 8px, not 4px: items have margin -4px 0, so 4px makes the hit areas overlap. Setting gap explicitly also cancels RadioGroup's default gap-3.
- .pc-seg-item: add border: 0; background: none; box-shadow: none (as the sheet's .bar>button does), so primitive base classes never leak in.
- Selected rule: .pc-seg-item:is([aria-current],[data-state='checked']) for both the colour and the ::before.
- New modifier .pc-seg-fill: width: 100%, with .pc-seg-item { flex: 1 1 0; justify-content: center; padding-inline: 12px }. Add .pc-seg-fill-phone with the same rules inside @media (max-width: 639px). It must be a poolside class because Tailwind w-full or flex-1 cannot beat the unlayered .pc-seg rules.
- @media (max-width: 767px): .pc-seg and [data-slot='tabs-list'][data-variant='default'] get border-radius: var(--pc-radius-card).
- tabs-list[data-variant='default']: add only flex-wrap: wrap; row-gap: 8px. Never set display, so the duty-view.tsx:52 phone grid survives.
- Line 392: change margin-top: 3px to 0.

3) Delete link-segments.tsx and tab-strip.tsx. In attendance/class-session.tsx:218-233, use <SegmentedLinks label="Steps" items=[Attendance, Competencies]> with no numbers. Also drop "1. " and "2. " in instructor/class-navigation.tsx:11-12.

4) tabs.tsx:
- delete the line variant, its data-[variant=line] classes and all after: classes;
- trigger font-semibold;
- remove the focus-visible ring and outline classes (poolside.css:248 covers focus).
Then delete the dead tabs-trigger active-colour and ::after rules in shadcn.css:198-203. In swimmer-profile.tsx:63, use the default TabsList AND remove className={styles.tabs}. Delete .tabs and .tabs [role="tab"] in swimmer-profile.module.css:39-51.

5) radio-group.tsx: when children are present, leave out ALL dot geometry and decoration: aspect-square, size-*, rounded-full, border, border-ui-input, text-ui-primary, shadow-xs, dark:bg-ui-input/30, focus-visible border and ring, aria-invalid ring. Keep the disabled classes. The default dot becomes size-5 with no shadow, and the CircleIcon becomes size-2.5.

6) checkbox.tsx:
- size-5 with no shadow-xs;
- radius rounded-ui-xs. Not rounded-ui-md or lg: poolside.css:183 remaps those to 16px, which turns a 20px box into a circle.
Remove the 16px-era offsets: mt-1 in hr/actions.tsx:42, rota/absences.tsx:36 and rota/actions.tsx:41 and 186; my-1 in class-enrolment-dialog.tsx:121. Delete docs.css:7368-7371 and the 18px min-height in integration.css:27. Keep role-actions.tsx:116 mt-3, which centres the box in a 44px row.

7) ThemeToggle becomes SegmentedChoice aria-label="Appearance", fill, with Monitor, Sun and Moon icons. Keep ThemeFlip. In account-menu.tsx:41-45 and instructor-shell.tsx:95-99, KEEP DropdownMenuRadioGroup and DropdownMenuRadioItem (a RadioGroup inside a Radix menu cannot be reached by keyboard) and style them: the group gets className "pc-seg pc-seg-fill", the items "pc-seg-item". In dropdown-menu.tsx, add data-slot="dropdown-menu-radio-item-indicator" to the indicator span and hide it inside .pc-seg-item. Delete the unused components/docs/appearance-menu.tsx.

8) MarkChoices (teaching-ui.tsx) becomes SegmentedChoice with fill="phone" and the same props (label, value, options, disabled, onChange). Delete the reserved check slot and the invisible-bold trick.

9) role-actions LevelRow becomes SegmentedChoice with aria-labelledby={`${id}-name`} and disabled={locked !== null}. Keep the hidden input level:${mod.id}, which is what the form posts. The enrolment-actions radio group (318-351) becomes SegmentedChoice aria-label="When to unenrol". Convert progression/assessment.tsx:203-228 too.

10) Update DESIGN.md (Controls: SegmentedLinks for links, SegmentedChoice for choices; bars wrap and never scroll) and shadcn/README.md:24-26.

Verify with npm run lint and tsc, then at 375 and 768 in light and dark: no .pc-seg with scrollWidth > clientWidth, /duty tabs still a 2-column grid on phones, the swimmer profile with no underline, role-level labels centred, and the account menu Appearance reachable with arrow keys.

## Acceptance
At 375 dark and 375 light, every option of /activity, /courses, /assessments/setup, /analytics/instructors and /instructor/classes/<id> segmented bars is visible (no scrollWidth > clientWidth on any .pc-seg). /students/<id> tabs are a pill bar that wraps cleanly at 375 and 768. /courses/<id>/class shows the 'Attendance | Competencies' segmented bar. Appearance on /account and in the account menu is the same 44px pill control (muted unselected, white selected with a line-strong edge) in both themes. The role editor level labels are vertically centred. Attendance choices look the same in light and dark.

## Verification notes
- KEEP: The problem is real. I checked it in the code and in the live sandbox.

(1) The bar hides items at 375. poolside.css:609 gives .pc-seg overflow-x:auto with scrollbar-width:none. At 375 I measured these hidden items:
- /activity, dark (scrollWidth 678 vs clientWidth 343): Docs, Training, Rota, HR and Admin.
- /courses: Full and Archived.
- /assessments/setup: the current page, 'Assessment setup', plus 'Cancelled'.
- /analytics/instructors: the current page, 'Instructor attendance'.
- Deck /instructor/classes/<id>, including its /overview page: 'Class overview', which is the current page there.
DESIGN.md says plainly 'no link hidden in a scrolling bar'. Wrapping follows that rule, even though the mockup's own .bar CSS also scrolls.

(2) Duplicate components. link-segments.tsx has no importers. tab-strip.tsx is imported only by class-session.tsx:218, where it draws an underline bar with blue labels (shots sys06v/courses_..._class-375-light/dark.png). The SSClassRegister mockup draws that bar as 'bar soft' pills.

(3) Swimmer profile tabs. They use variant='line' (swimmer-profile.tsx:63) at weight 500. Inactive labels measure 4.39:1 on the canvas, and at 375 the bar wraps into two underlined rows (students_...-375-light.png). The V2Profile and V2PhoneProfile mockups show a 'bar soft' pill bar.

(4) ThemeToggle on /account. The items measure 36px tall and 16px radius at weight 500. Unselected text is blue (rgb 120,166,255 in dark), and the selected item has shadow-sm (account-1280-light.png). The V2System and ADAccount mockups show a 44px soft bar with System, Light and Dark, with icons.

(5) MarkChoices. In dark mode the unselected items are filled grey by RadioGroupItem's dark:bg-ui-input/30 (radio-group.tsx:30); in light they are not (class-375-dark vs light).

(6) Role editor. The level labels compute to align-items:flex-start because of poolside.css:391, so the text sits at the top of the 44px pill (role-editor-1280-light.png). The ADRoles mockup uses a soft radiogroup bar.

(7) Size and shadow. Radio and checkbox are size-4 with shadow-xs; the ADRoles checkbox is 20px.

The change mostly fits v2, but four parts are wrong or missing:
(a) It drops the numbers from the desk steps. The approved SSClassRegister, DeckAttendance and DeckCompetencies mockups all show '1. Attendance' / '2. Competencies' with aria-label 'Class steps'. The deck already ships those labels (class-navigation.tsx:10-11). These are functional step order, not decorative 01/02 kickers.
(b) It adds a CircleCheck to the checked item only. No approved mockup does this (ADAccount, ADRoles, Deck*, SSClassRegister, V2System): selection is the white fill, the line-strong edge and ink text. An icon on the checked item alone also changes item widths in auto-width bars.
(c) The acceptance requires Appearance in the account menu to match, but no step converts it. account-menu.tsx:40-45 is still a vertical DropdownMenuRadioGroup.
(d) It misses one more copy of the radio-card classes, assessment.tsx:213-226. It also names a 'teaching-ui SegmentedChoice' that does not exist; the markup to delete is MarkChoices' own.
- KEEP: The task's problem statement holds up in the code. .pc-seg scrolls with a hidden scrollbar (poolside.css:609). LinkSegments has no importers. TabStrip's only use is attendance/class-session.tsx:218, with the labels "1. Attendance" and "2. Competencies". The swimmer profile is the only user of TabsList variant="line" (swimmer-profile.tsx:63). ThemeToggle gets its blue unselected text from RadioGroupItem's text-ui-primary. The role level labels sit at the top because of poolside.css:391: `label:has([data-slot='radio-group-item']) { align-items: flex-start }`. Nothing here is unfixable, but as written the change would break things in eight places.

(1) Lint. SegmentedChoice is described as a "Radix RadioGroup", but it lives in src/components/ui-kit. eslint.config.mjs (uiImports) bans importing 'radix-ui' outside src/components/shadcn, and uiSyntax bans a raw <button>. It has to compose shadcn RadioGroup/RadioGroupItem, which brings in their base classes.

(2) Base classes. poolside.css is not in a CSS layer, and Tailwind v4 utilities are. RadioGroup's default `grid gap-3` would put 12px gaps between items, because .pc-seg sets no gap. RadioGroupItem's `size-*` sets width, so the item stops at the 44px min-width and the label spills over its neighbour. Its `border` would also show a 1px edge. Removing only the four "dot" classes the task names is not enough.

(3) The aria-pressed button mode. It would have to render shadcn Button. In poolside, `.turnfin-app .ui-motion-press[data-variant='ghost'] { color: var(--pc-primary) }` (line 346) and the padding rule at line 341 are both more specific (0,3,0) than `.turnfin-app .pc-seg-item` (0,2,0). That brings back blue unselected text, which is the exact ThemeToggle bug being fixed.

(4) Row gap. Items use `margin: -4px 0`, so each line of a wrapped bar is 36px tall. With `row-gap: 4px`, the 44px hit areas of neighbouring rows overlap by 4px, leaving 40px targets. 8px removes the overlap.

(5) The tabs-list wrap. duty-view.tsx:52 makes TabsList a `grid grid-cols-2` on phones. Copying .pc-seg's `display: inline-flex` into the unlayered tabs-list rule would break that grid.

(6) Swimmer profile. Its TabsList also has `className={styles.tabs}`, and swimmer-profile.module.css:39-51 adds a border-bottom, width 100% and an 8px gap. Swapping the variant alone leaves an underline under the pill bar.

(7) Account menu. The acceptance asks for the same control in the account menu. A RadioGroup inside a Radix DropdownMenuContent cannot be reached by keyboard: @radix-ui/react-menu (dist/index.mjs:313) blocks Tab, and arrow keys only move between menu items. account-menu.tsx:41-45 and instructor-shell.tsx:95-99 must keep DropdownMenuRadioItem and be styled instead.

(8) Selection icon. A CircleCheck shown only on the checked item changes item widths in content-sized bars (role levels, appearance), so neighbours move or re-wrap when you pick one. The V2System sheet shows no check on `.bar.soft>[aria-pressed=true]`.

Also stale or unsupported:
- teaching-ui.tsx has no "SegmentedChoice" of its own. The component is MarkChoices, used by register-form.tsx:355 and deck-checklist.tsx:399/466.
- The V2System sheet has no checkbox or radio at all; its only 20px rule is .ico.lg. size-5 is still sensible because it equals the 20px body line height, but every alignment offset tuned for 16px has to go: poolside.css:392 margin-top:3px, the mt-1/my-1 on radios and checkboxes in hr/actions.tsx, rota/absences.tsx, rota/actions.tsx and class-enrolment-dialog.tsx, the unlayered 18px Docs override at docs.css:7368, and integration.css:27.
- The same copied radio-pill classes also live in progression/assessment.tsx:203-228. instructor/class-navigation.tsx:11-12 has the same numbered step labels.
- appearance-menu.tsx has no importers.
- Removing the focus-ring classes from tabs.tsx is safe: poolside.css:248 outlines button and [role=tab] on :focus-visible.

There are no e2e tests or unit tests on these controls. The only script check is check-reception-portal.mjs, which clicks a site menuitemradio and is not affected.