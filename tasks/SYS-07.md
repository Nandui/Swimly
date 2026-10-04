# SYS-07 — Buttons, icon buttons, focus and disabled states: one control system
Severity: medium | Scope: system

## Files (expected)
- scripts/check-instructor-swimmers.mjs
- src/app/(activities)/together/page.tsx
- src/app/(core)/staff/page.tsx
- src/app/docs/poolside.css
- src/app/motion.css
- src/app/refunds/refunds.css
- src/app/rota/absences/page.tsx
- src/app/rota/day/page.tsx
- src/app/shadcn.css
- src/app/workspace/module-workspace.css
- src/components/clubs/club-actions.tsx
- src/components/confirm-action.tsx
- src/components/devices/device-actions.tsx
- src/components/devices/session-forms.tsx
- src/components/docs/editor-toolbar.tsx
- src/components/form-dialog.tsx
- src/components/help/help-frame.tsx
- src/components/people/people-actions.tsx
- src/components/searchable-picker.tsx
- src/components/shadcn/breadcrumb.tsx
- src/components/shadcn/button.tsx
- src/components/sign-in-form.tsx
- src/components/staff/person-actions.tsx
- src/components/staff/role-actions.tsx
- src/components/staff/role-preview.tsx
- src/components/theme-toggle.tsx
- src/components/training/manage-actions.tsx
- src/components/ui/icon-button.tsx
- src/components/ui/loading-button.tsx
- src/components/workspace/module-shell.tsx
- src/modules/activities/components/assessments/booking-actions.tsx
- src/modules/activities/components/assessments/session-actions.tsx
- src/modules/activities/components/assessments/type-actions.tsx
- src/modules/activities/components/attendance/class-session.tsx
- src/modules/activities/components/attendance/register-form.tsx
- src/modules/activities/components/attendance/take-over.tsx
- src/modules/activities/components/courses/class-detail.tsx
- src/modules/activities/components/courses/course-actions.tsx
- src/modules/activities/components/courses/course-filters.tsx
- src/modules/activities/components/curriculum/copy-programme.tsx
- src/modules/activities/components/curriculum/level-actions.tsx
- src/modules/activities/components/curriculum/programme-actions.tsx
- src/modules/activities/components/duty/duty-view.tsx
- src/modules/activities/components/enrolment/enrolment-actions.tsx
- src/modules/activities/components/enrolment/legend-agreements.tsx
- src/modules/activities/components/parents/access-requests.tsx
- src/modules/activities/components/progression/assessment.tsx
- src/modules/activities/components/progression/move-up.tsx
- src/modules/activities/components/students/profile-enrolments.tsx
- src/modules/activities/components/students/profile-history.tsx
- src/modules/activities/components/students/student-search.tsx
- src/modules/activities/components/students/swimmer-browser.tsx
- src/modules/activities/components/today/instructor-picker.tsx

## Problem
Secondary (outline) buttons use the dark --pc-line-strong field edge (poolside.css:344), while the V2System .btn uses the soft --line. IconButton defaults to ghost, so row actions (edit, archive, delete, unenrol, reorder) are bare blue glyphs with no edge, and destructive ones are blue too. Keyboard focus on a Button draws poolside's outline plus shadcn's 3px 50%-alpha ring, a blurred double edge. Select triggers get the button outline plus the field halo, while bar items and breadcrumbs use other rings, and focusable regions such as the schedule scroller fall back to the browser's black ring because poolside.css:248 covers only a, button and [role=tab]. Disabled is opacity 0.5 (a primary button at 2.22:1). The 'secondary' variant (grey fill, no edge, 1.04:1 boundary) is used as a selected state (Rota 'Today', View as) and for Duty 'Quick view'. Six size variants all render 44px, yet 30 files pass size='sm'. The destructive label is a literal colour and has no hover. Link-variant buttons keep a 16px inset, so inline links are offset from their text. LoadingButton disables itself while pending, which drops keyboard focus to <body>, and it never announces progress.

## Change (original)
1) button.tsx: remove rounded-ui-md, the focus-visible ring and border classes, disabled:opacity-50 and the destructive text-white. Variants become default, outline, ghost, destructive and link (delete secondary). Sizes become default and icon (delete xs, sm, lg, icon-xs, icon-sm, icon-lg). Update every caller in this task's file list: omit size='sm'/'lg'/'xs'; icon-* becomes icon; secondary becomes outline. Rota day 'Today' stays outline and gets aria-current='date' when on today. The View as toggle becomes ghost with aria-pressed (SYS-14 styles the pressed state). 2) poolside controls block: the outline border is var(--pc-line) (fields, selects and comboboxes keep --pc-line-strong). [data-variant='link'] gets padding-inline 0. Add the --pc-on-danger and --pc-danger-hover tokens and use them for destructive. Add a disabled rule for [data-slot=button]:disabled, [aria-disabled='true'] and fields :disabled: background --pc-surface-sunken, colour --pc-ink-muted, border --pc-line, opacity 1, cursor not-allowed. Move the global focus rule (poolside.css:248) into this block and widen it to :is(a, button, summary, [role=tab], [tabindex]:not([tabindex='-1'])):focus-visible with a 2px --pc-focus outline at 2px offset. Fields get outline: none with the border plus 1px ring plus halo, so select triggers match inputs. 3) icon-button.tsx:8 defaults to variant outline (a 44px round outline with an ink icon). ActionButton in confirm-action.tsx:138-146 uses outline size icon. 4) loading-button.tsx: while pending, use aria-disabled with a click guard instead of disabled, so focus stays. Hide the inactive label with visibility:hidden through the action-label data-motion rule in motion.css, and add an sr-only role=status that announces pendingLabel.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep the change as written, with these corrections:

**(a) Row-action icon buttons.**
- In the listed files that render row-action icon triggers, change `<Button variant="ghost" size="icon-sm">` to `variant="outline" size="icon"`. Those files are club-actions, device-actions, people-actions, person-actions, role-actions, booking-actions, session-actions, type-actions, course-actions, level-actions, programme-actions, enrolment-actions and progression/assessment.
- Bar and toolbar icons stay ghost: Find swimmer, View as and ThemeFlip.
- ActionButton (confirm-action.tsx:142-143) becomes `variant="outline" size="icon"`.
- Changing the IconButton default to outline is fine, but no current caller depends on it.

**(b) Theme toggle.** Add src/components/theme-toggle.tsx. ThemeFlip drops its `sm`/`lg` size prop and passes `size="icon"`; its only caller, help-frame.tsx, uses the default. Without this, removing `icon-sm`/`icon-lg` breaks typecheck.

**(c) Global focus rule.** Write it with `:where`, so specificity stays (0,2,0) and the inset -2px offsets on `.tf-rail-item`, `.pc-seg-item`, `.module-row` and `.refund-row` keep working:
`.turnfin-app :where(a, button, summary, [role='tab'], [tabindex]:not([tabindex='-1'])):focus-visible { outline: 2px solid var(--pc-focus); outline-offset: 2px; }`
Keep the field focus rule after it, with `outline: none` plus the border, 1px ring and halo.

**(d) Disabled rule.** Scope it to controls only:
`.turnfin-app :is([data-slot='button'], .ui-motion-press):is(:disabled, [aria-disabled='true'])`
plus `.turnfin-app :is([data-slot='input'], [data-slot='textarea'], [data-slot='select-trigger'], [data-slot='native-select']):disabled`.
Don't use a bare `[aria-disabled='true']`, because Radix dropdown and select items carry it.

**(e) View as toggle.** In role-preview.tsx:38 it becomes `variant="ghost"` and keeps `data-active`, which poolside.css:238 already styles. Don't add `aria-pressed` to this DropdownMenuTrigger (`aria-haspopup=menu`).

**(f) Optional, removes a second strong-edge source.** In src/app/shadcn.css:98-101, delete the `[data-slot][data-variant="outline"]:is(button, [role="combobox"])` selector and keep `[data-slot="select-trigger"]`.

Everything else stands as proposed:
- Variants become default, outline, ghost, destructive and link; sizes become default and icon.
- `secondary` becomes outline: Duty Quick view, course-filters chips, access-requests selected filter.
- Rota Today becomes outline with `aria-current="date"`.
- Outline buttons get the `--pc-line` edge; link buttons get `padding-inline: 0`.
- Add `--pc-on-danger` and `--pc-danger-hover`.
- LoadingButton uses `aria-disabled` with a click guard. This is safe because implicit form submission fires a click on the default button, and FormDialog guards with its own `submitting` ref. It also hides the inactive label with `visibility: hidden` and adds an sr-only `role=status`.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) button.tsx
- Remove rounded-ui-md, the focus-visible border and ring classes, the aria-invalid ring classes, disabled:opacity-50, and the destructive text-white, hover, focus and dark classes.
- KEEP disabled:pointer-events-none.
- Variants: default, outline, ghost, destructive, link. Sizes: default, icon.

Callers (change only Button, LoadingButton and IconButton props):
- Leave AppIcon size="sm" in staff/page.tsx, together/page.tsx, class-session.tsx and class-detail.tsx alone.
- Leave SidebarMenuButton size="lg" in app-shell.tsx alone.
- Delete size="sm" and size="lg".
- "icon-sm" becomes "icon", including the computed sizes at booking-actions.tsx:99 and enrolment-actions.tsx:412.
- theme-toggle.tsx: ThemeFlip drops its unused size prop and passes size="icon". Its only caller, help-frame.tsx, passes no size.
- Every row-action trigger written as <Button variant="ghost" size="icon-sm"> becomes variant="outline" size="icon". These are in club-actions, device-actions, people-actions, person-actions, role-actions, booking-actions, session-actions, type-actions, course-actions, level-actions, programme-actions, enrolment-actions and progression/assessment.tsx:375.
- ThemeFlip and the student-search clear button stay ghost: one sits in a bar, the other inside a field.
- secondary becomes outline at course-filters.tsx:58, duty-view.tsx:69 and access-requests.tsx:64.
- Rota day 'Today': always outline, with aria-current={day === now ? 'date' : undefined}.
- role-preview.tsx: variant ghost and keep data-active. Do NOT add aria-pressed, because the button is a DropdownMenuTrigger. Its pressed look stays with SYS-14.

2) poolside.css, controls block
a) Delete line 248 and add this in the controls block:
   .turnfin-app :is(a, button, summary, [role='tab'], :where([tabindex]:not([tabindex='-1']))):focus-visible { outline: 2px solid var(--pc-focus); outline-offset: 2px }
   The :where() keeps specificity at today's (0,3,0), so the inset rings at :466, :483, :615, refunds.css:41 and module-workspace.css:39 still win.
b) Outline buttons: border 1px solid var(--pc-line). Add .turnfin-app .ui-motion-press[role='combobox'] { border-color: var(--pc-line-strong) }.
c) Field focus rule (line 373): add .ui-motion-press[role='combobox'] to its selector list. Set outline: 2px solid transparent (not outline: none), so forced-colors mode still draws a ring.
d) .turnfin-app .ui-motion-press[data-variant='link'] { padding-inline: 0 }, placed after line 341.
e) Tokens on :root:
   --pc-on-danger: light-dark(#ffffff, #2a0906) (6.15:1 and 9.58:1)
   --pc-danger-hover: light-dark(#962817, #ffc2b8) (8.04:1 and 11.98:1)
   Line 350 uses them. Add [data-variant='destructive']:hover:not(:disabled, [aria-disabled='true']).
f) Disabled state, keyed on .ui-motion-press:is(:disabled, [aria-disabled='true']). Never use [data-slot=button] or a bare [aria-disabled].
   - [data-variant] default, destructive or outline: background var(--pc-surface-sunken); color var(--pc-ink-muted); opacity 1. Outline keeps its 1px --pc-line border. Filled buttons get box-shadow: inset 0 0 0 1px var(--pc-line), so the width does not shift.
   - ghost and link: color var(--pc-ink-muted) and background transparent only.
   - cursor: not-allowed only on [aria-disabled='true'].
   - The variant-qualified selectors are (0,4,0), so they beat the .tf-tools rule at :460.
   - Fields: .turnfin-app :is([data-slot='input'], [data-slot='textarea'], [data-slot='select-trigger'], [data-slot='native-select']):not(.title-input):disabled gets the same three tokens. Never write bare input:disabled.

3) icon-button.tsx defaults to variant outline (no caller relies on the default). ActionButton (confirm-action.tsx:138-146) uses variant outline, size icon, and aria-disabled={pending || undefined} instead of disabled; its submitting ref already blocks double clicks.

4) LoadingButton
- Native disabled only when the caller passes disabled.
- While pending: aria-disabled="true" plus an onClick guard that calls event.preventDefault() before the caller's onClick. This also blocks implicit Enter submission.
- motion.css: [data-motion="action-label"][aria-hidden="true"] gets visibility: hidden. Add visibility var(--ui-motion-feedback) to the transition list so the fade still runs.
- Render <span aria-live="polite" aria-atomic="true" className="sr-only">{pending ? pendingLabel : ""}</span> as a sibling AFTER the Button (wrap both in a fragment). Keep it always mounted and give it no role="status", so scripts/check-instructor-swimmers.mjs's unfiltered getByRole('status') keeps one match.

Extra acceptance:
- Tab through /refunds, a SegmentedLinks bar and the module rail: the ring stays inset.
- Docs editor with the editor disabled: toolbar tools are muted, not boxed.
- npm run typecheck and npm run lint pass.
- grep finds no "icon-sm", "icon-lg" or "icon-xs" in src.

## Acceptance
On /staff, /roles, /programmes/<id>, /account, /refunds/<draft>, /duty and /courses at 1280 light and dark: outline buttons have the soft edge; row icon buttons are outline circles with ink icons; Tab focus shows a single 2px ring on buttons, fields, selects and the /schedule booking-sheet scroller; disabled 'Change PIN' text reads at 4.5:1 or better in both themes. Saving a FormDialog keeps focus on the button and announces the pending label (AX tree). grep finds no size='sm'|'xs'|'lg' or variant secondary on Button. typecheck passes.

## Verification notes
- KEEP: The problem is real today, and the proposed direction matches DESIGN.md v2 and the V2System mockup. The change has four gaps that need fixing, though.

Evidence I checked, all 1280 light and dark (shots in scratchpad/shots/audit2/sys07v):

**Problems confirmed**
- **Outline edge too strong.** Outline buttons compute to a 1px #77849a (light) / #6b7d99 (dark) edge from poolside.css:344. In the mockup, `.btn` uses the soft `--line` (#e2e7ef / #24324a). Only the `.btn.sel` picker uses `--edge`, which matches the plan for fields and selects to keep `--pc-line-strong`. See crop-v2system-btns.png and staff-1280-light.png.
- **Row icon buttons are bare blue glyphs.** On /staff and /programmes they are ghost, color #1d5fd1, with no border. That includes Deactivate and Archive, which are destructive. The mockup `.btn.icon` is a 44px outlined circle with an ink icon.
- **Double focus edge on default Buttons.** A focused primary Button shows a 2px outline at 2px offset plus a 3px 50%-alpha ring (crop-focus-light.png).
- **Triple focus edge on selects.** A focused select trigger on the refund draft computes a 2px outline plus a 1px ring plus a 4px halo.
- **Schedule scroller uses the browser ring.** `section[tabindex=0]` on /schedule computes `outline: auto 1px rgb(16,16,16)`.
- **Disabled is unreadable.** Disabled Change PIN has opacity 0.5. Computed contrast is 2.22:1 in light and 2.82:1 in dark. The proposed `--pc-ink-muted` on `--pc-surface-sunken` gives 5.67 and 6.77.
- **`secondary` is used as a selected state.** Rota Today and Duty Quick view render a sunken fill with no edge: 1.08:1 against the panel.
- **Sizes and destructive are as described.** Every size computes to 44px. The destructive label is a literal colour at poolside.css:350, and poolside's unlayered background overrides Tailwind's hover.
- **LoadingButton** sets `disabled={disabled||pending}` at loading-button.tsx:11 and has no live region.

**One known issue not reproduced:** LoadingButton's idle accessible name is correct. The AX tree on /account gives "Change password" and "Change PIN"; only the raw text concatenates.

**Gaps in the change as written**
1. **Step 3 alone fails the /staff and /programmes acceptance.** The row actions there are plain `<Button variant="ghost" size="icon-sm">` triggers in 13 listed files, not IconButton. All three IconButton callers (confirm-action, theme-toggle, student-search) pass `variant` explicitly, so changing the IconButton default restyles nothing on screen.
2. **Typecheck would break.** src/components/theme-toggle.tsx:72 (not in the file list) passes `"icon-sm"` and `"icon-lg"`.
3. **The `:is()` widening raises specificity to (0,4,0).** It would override the inset -2px focus offsets on `.tf-rail-item` (poolside.css:483), `.pc-seg-item` (615), `.module-row` (module-workspace.css:39) and `.refund-row` (refunds.css:41). I confirmed this live by injecting the rule into the page: rail and segmented focus went from -2px to 2px. With `:where()` they stayed at -2px.
4. **A bare `[aria-disabled='true']` rule would grey Radix menu and select items,** which carry that attribute.

**One semantics fix:** the View as toggle is a DropdownMenuTrigger (`aria-haspopup=menu`), so `aria-pressed` is wrong there. Its active state is already styled by poolside.css:238, which applies on /staff because ModuleShell sits inside `.turnfin-docs`. It also needs no SYS-14 dependency.
- KEEP: The direction is right and nothing in it is impossible to fix, but as written it causes six concrete regressions and leaves the acceptance unmet. I read the code and grepped every selector, size and variant; I did not run the app.

1) Focus rule specificity. Widening poolside.css:248 to :is(a, button, summary, [role=tab], [tabindex]:not([tabindex='-1'])) raises its specificity from (0,3,0) to (0,4,0), because :is() takes the specificity of its most specific argument. It would then beat the inset rings (outline-offset -2px) at poolside.css:483 (.tf-rail-item), poolside.css:615 (.pc-seg-item), refunds.css:41 (.refund-row) and module-workspace.css:39 (.module-row). All four are anchors (module-shell.tsx:148, segmented-links.tsx:12, queue.tsx:36, hr/page.tsx:37). Their ring would flip outward, and .pc-seg and .tf-bar (overflow-x:auto) would clip it.

2) IconButton default. Changing the default to outline changes nothing on screen. All 3 IconButton callers pass variant="ghost" explicitly (confirm-action.tsx:138, theme-toggle.tsx:69, student-search.tsx:191). The row actions are plain <Button variant="ghost" size="icon-sm"> triggers (club-actions.tsx:63, role-actions.tsx:233, level-actions.tsx:116, enrolment-actions.tsx:283 and others), so 'row icon buttons are outline circles' would fail.

3) Typecheck. src/components/theme-toggle.tsx:72 maps ThemeFlip sizes to "icon-sm"/"icon-lg" and is not in the file list, so typecheck breaks. The computed sizes at booking-actions.tsx:99 and enrolment-actions.tsx:412 are missed by literal greps. 'Omit size="sm"' is also ambiguous: 10 of the 80 matches are AppIcon size="sm" (staff/page.tsx has only those), and app-shell.tsx:121 is SidebarMenuButton size="lg". Both must stay.

4) Disabled rule selectors.
- [data-slot=button]:disabled misses Radix-wrapped triggers. Slot rewrites data-slot to dialog-trigger, dropdown-menu-trigger or alert-dialog-action, which is why poolside.css:336-339 hooks .ui-motion-press. With opacity-50 gone, disabled triggers would show no cue at all.
- A bare [aria-disabled='true'] also hits BreadcrumbPage (breadcrumb.tsx:56) and Radix menu and select items.
- A fill plus edge on every disabled button boxes the Docs editor toolbar's ghost .toolbar-button, .editor-menu-trigger and .editor-menu-item (editor-toolbar.tsx:23,34,66), which are routinely disabled.
- The .tf-tools item rule (poolside.css:460, (0,3,0), later in the file) would override a (0,3,0) disabled rule placed in the controls block.

5) View as toggle. role-preview.tsx:38 is a DropdownMenuTrigger, a menu button with aria-haspopup and aria-expanded. Adding aria-pressed makes it a toggle and menu hybrid. It renders in .tf-tools (module-shell.tsx:82), where poolside.css:460 already resets its look, so ghost alone changes nothing visible.

6) LoadingButton announcement.
- A role=status inside the button is unreliable, because a button's children are presentational. It would also double the accessible name.
- A role=status mounted for every LoadingButton breaks scripts/check-instructor-swimmers.mjs:46,54,103, which call page.getByRole('status').innerText() unfiltered (Playwright strict mode). That preview renders DeckChecklist, which renders LoadingButtons through CompleteLevel and MoveReadinessStatus.

Minor points:
- Fields with outline:none lose their focus ring in forced-colors mode, where box-shadow is dropped. Select triggers currently keep the global outline there.
- Comboboxes are outline Buttons with role=combobox (searchable-picker.tsx:79, student-search.tsx:112, instructor-picker.tsx:15, course-filters.tsx:80), so 'comboboxes keep line-strong' needs an explicit selector.
- Keep disabled:pointer-events-none. Otherwise the (0,4,0) outline and ghost :hover rules (poolside.css:345,347) paint over disabled buttons.

What I checked:
- Read in full: button.tsx, icon-button.tsx, loading-button.tsx, confirm-action.tsx, form-dialog.tsx, role-preview.tsx, theme-toggle.tsx, app-icon.tsx, module-shell.tsx (tools area), editor-toolbar.tsx.
- CSS: poolside.css 198-641, including where its @layer blocks start and end; shadcn.css 94-250; motion.css; globals.css; refunds.css, module-workspace.css, integration.css and docs.css focus rules; eslint.config.mjs; tsconfig.json.
- All size, variant, IconButton, aria-disabled, tabIndex, role=status and buttonVariants usages.
- Contrast ratios computed from the tokens.

Not checked: the live app at localhost:3100. The CSS specificity findings follow from the Selectors spec, not from a test render.

## EXTRA from the lead (verified live)
LoadingButton renders both labels in the DOM, so its accessible name is e.g. 'Confirm and startStarting…' or 'Submit to financeSaving…' (browser tooling reports such buttons as unnamed). The reserved inactive label must be aria-hidden so the live label alone names the button, and the pending state should be announced politely. Fix in src/components/ui/loading-button.tsx and check every caller.