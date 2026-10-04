# SYS-05 — Overlays and menus: dialogs, sheets, menus, tooltips and toasts on the v2 sheet
Severity: high | Scope: system

## Files (expected)
- node_modules/sonner/dist/index.mjs
- src/app/docs/integration.css
- src/app/docs/poolside.css
- src/app/shadcn.css
- src/components/docs/reader.tsx
- src/components/form-dialog.module.css
- src/components/form-dialog.tsx
- src/components/refunds/finance-actions.tsx
- src/components/rota/roster.tsx
- src/components/searchable-picker.tsx
- src/components/shadcn/alert-dialog.tsx
- src/components/shadcn/button.tsx
- src/components/shadcn/command.tsx
- src/components/shadcn/dialog.tsx
- src/components/shadcn/dropdown-menu.tsx
- src/components/shadcn/item.tsx
- src/components/shadcn/popover.tsx
- src/components/shadcn/select.tsx
- src/components/shadcn/sheet.tsx
- src/components/shadcn/sidebar.tsx
- src/components/shadcn/sonner.tsx
- src/components/shadcn/tooltip.tsx
- src/components/workspace/your-modules.tsx
- src/lib/toast.tsx
- src/modules/activities/components/attendance/register-form.tsx
- src/modules/activities/components/courses/add-class.tsx
- src/modules/activities/components/courses/course-filters.tsx
- src/modules/activities/components/curriculum/image-thumbnail.tsx
- src/modules/activities/components/duty/duty-view.tsx
- src/modules/activities/components/enrolment/follow-up-history.tsx
- src/modules/activities/components/parents/parent-fields.tsx
- src/modules/activities/components/students/add-swimmer.tsx
- src/modules/activities/components/students/profile-action-dialog.tsx
- src/modules/activities/components/students/profile-enrolments.tsx
- src/modules/activities/components/students/profile-history.tsx
- src/modules/activities/components/students/student-search.tsx
- src/modules/activities/components/students/workspace-search.tsx
- src/modules/activities/components/today/instructor-picker.tsx
- src/modules/activities/lib/enrolment/actions/enrolment.ts

## Problem
Overlays are still shadcn defaults. The dialog and command close X is a 16x16 target with a 6px radius (Add level, Manage enrolment, Find swimmer). It only reached 44px inside .turnfin-docs portals, and some dialogs patch it with ad-hoc classes. The approved dialogs (HRPerson, ADRoles, SSCancellations) have no X, only Cancel and the primary button. On phones, dialog titles are centred while the fields are left-aligned. AlertDialog footers stack while FormDialog footers stay in a row. The overlay is black/50 in both themes. The Sheet is square, edge to edge, with a ruled header. Select, command and dropdown items are 32px at weight 400; radio and checkbox items keep 7.2px corners; menu content is 16px with 4px padding and a 1px border. The select chevron at 50% opacity reads 2.18:1. Tooltips have 16px corners and an arrow. On the touch Find swimmer dialog, the X sits below the input row. Toasts use sonner's own system font at 13px, weight 500, a 12px radius, an ink-coloured icon and a 20px close button, and at 375 they cover the whole bottom bar.

## Change (original)
1) dialog.tsx:74-80 and sheet.tsx:80: render the close as the shared Button (variant ghost, size icon, 44px round, aria-label 'Close', data-slot dialog-close / sheet-close) at top 12px, right 12px. FormDialog passes showCloseButton={false}, matching the mockups (Cancel and Escape). Info dialogs, the Sheet and CommandDialog keep the X; in CommandDialog it is pinned inside the 48px input row. Delete the ad-hoc close classes in add-swimmer.tsx:41, parent-fields.tsx:9, profile-action-dialog.tsx:46 and finance-actions.tsx:65. 2) Left-align headers at every width (delete 'text-center sm:text-left' at dialog.tsx:92 and 'place-items-center' at alert-dialog.tsx:82). DialogFooter and AlertDialogFooter become one row with the primary button last; under 768px each button is flex:1. FormDialog uses DialogFooter and deletes the duplicate .footer in form-dialog.module.css. 3) Add --pc-scrim: light-dark(rgb(15 27 45 / 0.28), rgb(0 0 0 / 0.5)) to the poolside tokens and use it on the dialog, alert-dialog and sheet overlays instead of bg-black/50. 4) Sheet: inset 8px from the viewport, radius var(--pc-radius-panel), --pc-shadow-overlay, no border; full width with no inset under 768px. Remove the header border-b in follow-up-history.tsx:119. 5) Menus, in one poolside rule: [data-slot=select-item], [data-slot=command-item], the dropdown-menu item, radio-item and checkbox-item, and the sub-trigger all get min-height var(--pc-control-height), padding 0 12px, weight 600 and radius 999px. Select, dropdown, sub and popover contents get radius var(--pc-radius-panel), padding 8px, no border and --pc-shadow-overlay; menu labels are caption size, 600, muted. Remove the tracking-widest shortcuts and font-medium from dropdown-menu.tsx, command.tsx and popover.tsx. Map .rounded-ui-xs and .rounded-ui-sm to var(--pc-radius-control) next to poolside.css:183. Delete the coarse-pointer 44px block in shadcn.css:221-266, keeping the command-input sizing. 6) Remove opacity-50 from the select trigger chevron (select.tsx:46). 7) Tooltip: pill radius, padding 4px 10px, 12px/600, no TooltipPrimitive.Arrow, the same look as .tf-rail-label. 8) Toasts: in sonner.tsx set --border-radius to var(--pc-radius-card) and --normal-border to transparent. Add poolside rules for [data-sonner-toaster]: var(--font-sans), body size and leading, title weight 600, --pc-shadow-overlay, icon colour by type ([data-type=error] var(--pc-danger), [data-type=success] var(--pc-success)), and a 44px [data-close-button] inside the toast on the right with the standard focus ring. In toast.tsx, use one mobile offset that clears the bottom bar (bottom 88px) for desk and deck alike.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Apply the change as written, with these corrections:

(1a) add-swimmer.tsx:41, profile-action-dialog.tsx:46 and finance-actions.tsx:65 also pass showCloseButton={false}, because they all have Cancel or Go back footers. Info dialogs with no footer keep the 44px X, for example Manage enrolment in profile-enrolments.tsx:40.

(1b) Delete the padding reserved for the X:
- `padding-right: calc(var(--spacing) * 12)` in form-dialog.module.css:10;
- `pr-14` and `border-b` on DialogHeader at add-swimmer.tsx:42;
- `pr-14` at profile-action-dialog.tsx:47.

(1c) Delete the `.turnfin-docs [data-slot='dialog-close']` rule at integration.css:29.

(2) Do NOT map .rounded-ui-xs or .rounded-ui-sm in poolside.css. The new menu-item rule sets radius 999px on the select, command and dropdown items, radio and checkbox items and the sub-trigger, and the close becomes the shared Button. Remove `rounded-ui-sm` and `rounded-ui-xs` from the classes in those overlay primitives instead. This leaves ItemMedia (item.tsx:80-82) and the curriculum thumbnails (image-thumbnail.tsx:30) untouched.

(3) Toasts:
- In toast.tsx, delete the numeric `mobileOffset` (a number insets all four sides; today's 144 makes the deck toast 87px wide at 375).
- Use `position={onDeck ? "bottom-center" : "bottom-right"}` with `offset={onDeck ? { bottom: 88 } : undefined}`. 88px clears the deck's 69px sticky save bar at every width.
- In poolside.css, add one rule on the bottom bar's own media query: `@media (max-width: 767px), (hover: none) and (pointer: coarse) { .turnfin-app [data-sonner-toaster][data-y-position='bottom'] { bottom: 88px; } }`. It beats sonner's (0,2,0) selector and covers 601-767px and touch tablets, where sonner's mobile offset never applies.
- Keep the rest of step 8: font, radius 16px, transparent border, overlay shadow, icon colour by type, and a 44px close inside the toast.

(4) Menu, select, sub and popover contents use padding 12px, not 8px, to match the mockup .menu (16px padding with items pulled out 4px). DropdownMenuSeparator becomes 8px of space with no 1px line; the V2System account menu has no separator lines.

Everything else stays as proposed:
- --pc-scrim: light-dark(rgb(15 27 45 / 0.28), rgb(0 0 0 / 0.5)) on all three overlays;
- left-aligned headers;
- one-row footers with the primary last and flex:1 under 768px; FormDialog uses DialogFooter and drops .footer;
- the rounded, inset sheet, full width under 768px, and no border-b at follow-up-history.tsx:119;
- 44px pill menu items at weight 600; caption/600/muted labels; no tracking-widest and no font-medium;
- delete shadcn.css:221-266 except the command-input sizing;
- remove the chevron's opacity-50;
- tooltip in the .tf-rail-label style with no arrow;
- CommandDialog X pinned inside the 48px input row.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) Close button
- In dialog.tsx:74-80 and sheet.tsx:80, render the close as <DialogPrimitive.Close asChild><Button variant="ghost" size="icon" aria-label="Close" data-slot="dialog-close" (or "sheet-close") className="absolute top-3 right-3 text-[var(--pc-ink-muted)]"><XIcon/></Button></DialogPrimitive.Close>.
- Position it by class only. Never add CSS on [data-slot=dialog-close]: Cancel buttons wrapped in DialogClose asChild share that slot, e.g. duty-view.tsx:74.
- When showCloseButton is true, give the content's direct DialogHeader/SheetHeader padding-right 40px, e.g. [&>[data-slot=dialog-header]]:pr-10, so titles never run under the X.
- Keep the DialogContent default showCloseButton=true.
- Pass showCloseButton={false} only where the dialog has its own Cancel/Back button: FormDialog (replacing {!pending}), add-swimmer.tsx:41, profile-action-dialog.tsx:46, finance-actions.tsx:65 and add-class.tsx:36.
- Dialogs without a Cancel keep the X: rota/activities.tsx, legend-list-match.tsx, take-over.tsx, start-class.tsx, profile-history.tsx, image-thumbnail.tsx and docs/admin.tsx.
- In CommandDialog, pass a close class so the X sits at top-[2px] right-[2px], centred in the 48px input row. Keep [cmdk-input] pr-12.
- Delete only the X-specific ad-hoc classes, and keep the other utilities in those strings:
  - add-swimmer.tsx:41: the [&>button]:* utilities.
  - parent-fields.tsx:9: the [&_[data-slot=dialog-close]]:* utilities.
  - profile-action-dialog.tsx:46: the [&>[data-slot=dialog-close]]:* utilities.
  - finance-actions.tsx:65: the [&>button]:* utilities.
- Delete integration.css:29, which the new close makes redundant.

2) Headers and footers
- Delete 'text-center sm:text-left' at dialog.tsx:92 and 'place-items-center text-center' plus the sm: place-items-start/text-left variants at alert-dialog.tsx:82. AlertDialogMedia and size=sm are unused.
- DialogFooter and AlertDialogFooter become 'flex flex-row flex-wrap justify-end gap-2', with the primary button last in DOM order.
- Under 768px, children get flex: 1 1 auto (never flex-basis 0). Labels stay whole and three or more buttons wrap. A non-button child such as a role=status span takes flex-basis 100%.
- FormDialog renders DialogFooter with the old padding (className p-6, i.e. 24px) and deletes .footer from form-dialog.module.css.
- profile-action-dialog's wide variant keeps its own wrapper.

3) Scrim
- Add --pc-scrim: light-dark(rgb(15 27 45 / 0.28), rgb(0 0 0 / 0.5)) to the .turnfin-app tokens in poolside.css.
- Replace bg-black/50 with bg-[var(--pc-scrim,rgb(0_0_0/0.5))] in the dialog, alert-dialog and sheet overlays.

4) Sheet
- In sheet.tsx, add data-side={side} to the content.
- For right/left, replace 'inset-y-0 right-0 h-full border-l' (mirrored for left) with 'inset-y-0 right-0 h-full md:inset-y-2 md:right-2 md:h-auto'.
- For top/bottom, use 'inset-x-0 md:inset-x-2' with md:top-2 / md:bottom-2.
- Drop the side borders. Add md:rounded-[var(--pc-radius-panel)] and shadow-[var(--pc-shadow-overlay)].
- Under 768px the sheet stays edge to edge (w-full, no radius).
- Check that roster.tsx:144 (w-full sm:max-w-xl) still fits at 768 and 1280.
- Remove the header border-b at follow-up-history.tsx:119.

5) Menus: one poolside rule for [data-slot=select-item], [data-slot=command-item], [data-slot=dropdown-menu-item], [data-slot=dropdown-menu-checkbox-item], [data-slot=dropdown-menu-radio-item] and [data-slot=dropdown-menu-sub-trigger]
- min-height var(--pc-control-height); padding 6px 12px; border-radius var(--pc-radius-control); font-weight 600.
- Keep the indicator gutters with follow-up declarations: select-item padding-right 36px; checkbox, radio and [data-inset] items padding-left 36px; move each indicator to 12px from its edge.
- Inside items, caption-size children (.text-xs) keep font-weight 400.
- Leave rounded-ui-xs/rounded-ui-sm unmapped and do NOT add the .rounded-ui-xs/.rounded-ui-sm mapping, because it would round image-thumbnail.tsx:30 and item.tsx:80,82.
- Content panels: in poolside set radius var(--pc-radius-panel), border 0 and --pc-shadow-overlay for select, dropdown, sub and popover contents.
- Set padding through the component defaults, not poolside, so call-site p-0 still wins via tailwind-merge: DropdownMenuContent and SubContent p-1→p-2, the SelectContent viewport p-1→p-2. PopoverContent keeps p-4, and the Command popovers keep p-0 (searchable-picker, student-search, course-filters, instructor-picker).
- Menu and select labels and the cmdk group heading: caption size, 600, muted.
- Remove tracking-widest from the dropdown and command shortcuts, and font-medium from dropdown-menu.tsx:157, command.tsx:58,124 and popover.tsx PopoverTitle.
- In shadcn.css:221-266, delete only the menu and close selectors: select-item, command-item, dropdown-menu-item, dropdown-menu-radio-item, dialog-close and sheet-close. Keep the rest of the block (button, sidebar, select-trigger, tabs, inputs, command-input and its wrapper, tabs-list).

6) Select chevron
- Remove opacity-50 from the select trigger chevron at select.tsx:302. The muted colour already comes from the trigger's svg rule.

7) Tooltip
- Use rounded-full, px-2.5 py-1, text-xs font-semibold and bg-[var(--pc-ink)] text-[var(--pc-surface)], matching .tf-rail-label.
- Delete TooltipPrimitive.Arrow.
- Keep text-balance and add max-w-[16rem] so long tooltips wrap instead of stretching.

8) Toasts
- In sonner.tsx, set --border-radius to var(--pc-radius-card) and --normal-border to transparent.
- Poolside rules under .turnfin-app [data-sonner-toaster], which outrank sonner's (0,2,0) selectors:
  - font-family var(--font-sans); body size and leading; [data-title] weight 600; box-shadow --pc-shadow-overlay;
  - icon colour by [data-type]: error var(--pc-danger), success var(--pc-success), warning var(--pc-warning);
  - [data-close-button] 44px round, on the right inside the toast, with the standard focus ring, and padding-right 52px on the toast content so text never runs under it.
- In toast.tsx, keep the deck exactly as it is (top-center, offset 80, mobileOffset 144), because its bottom save controls must stay clear.
- For the desk, clear the bottom bar wherever .tf-bottom is visible. Add a poolside rule inside the same media query as .tf-bottom ((max-width: 767px), (hover: none) and (pointer: coarse)): [data-sonner-toaster][data-y-position=bottom] { --offset-bottom: 88px !important; --mobile-offset-bottom: 88px !important; }. This is needed because sonner's mobileOffset only applies at 600px and below.

Verify: npm run typecheck and npm run lint, then the acceptance list at 1280 light, 1280 dark, 375 dark and 768 touch. Also check:
- FormDialog's enrolment confirmation (three buttons) at 375;
- the Classes site filter and the searchable-picker popovers (no inner padding);
- a curriculum image thumbnail (still square);
- a select with a check mark;
- a Rota shift sheet at 768.

## Acceptance
At 1280 light, 1280 dark and 375 dark, open Add swimmer, Add level, Manage enrolment, Find swimmer, Follow-up history, Edit role, Report absence, Approve refund, the account menu, the Classes site filter popover, a select and a tooltip. Form dialogs have no X; info dialogs, the sheet and the command dialog have a 44px round X centred on their header or input row. Headers are left-aligned on phones and phone footers split their buttons equally. Menu items are 44px pills at weight 600 and menu panels have a 24px radius. The scrim matches the token in both themes. The sheet is rounded and inset. An injected toast at 375 uses Plus Jakarta Sans at 14px with a 16px radius and a 44px close, and does not cover the bottom bar.

## Verification notes
- KEEP: The problem is real. I checked the code and opened each overlay in the live sandbox at 1280 light, 1280 dark and 375 dark. Screenshots are in scratchpad/shots/audit2/sys05/.

Close button (X)
- In code: dialog.tsx:74-80 and sheet.tsx:80 still draw the shadcn close at `top-4 right-4 rounded-ui-xs opacity-70`.
- At 1280 the X is 16x16 with a 6px radius on Add level, Manage enrolment and Find swimmer (add-level-1280-light.png, manage-enrol-1280-*.png, find-swimmer-1280-light.png).
- It only reaches 44px through the coarse block in shadcn.css:221-266, the .turnfin-docs patch in integration.css:29, or the ad-hoc classes at add-swimmer.tsx:41, parent-fields.tsx:9, profile-action-dialog.tsx:46, finance-actions.tsx:65 and follow-up-history.tsx:118.
- On touch Find swimmer, the X sits 16px down from the top, below the centre of the 48px input row (find-swimmer-375-dark.png).
- Every approved dialog mockup has no X, only Cancel or Close plus the primary button on the right: HRPerson, ADRoles, SSCancellations, SSAssessSetupList, TRSignoff, DeckAssessment.

Headers, footers and scrim
- At 375 the Add level title is centred while its fields are left-aligned (add-level-375-dark.png). This comes from dialog.tsx:92 and alert-dialog.tsx:82.
- DialogFooter stacks into a column with the primary button on top (Add swimmer and Take responsibility at 375). FormDialog's .footer stays in a row.
- The overlay computes to oklab(0 0 0 / 0.5) in both themes. The mockup .scrim is exactly rgb(15 27 45 / .28) in light and rgb(0 0 0 / .5) in dark, so the proposed --pc-scrim matches.

Sheet
- Radius 0, edge to edge at x=608 through 1280, with a 1px ruled header (followup-1280-light.png).

Menus
- Radio items in the account menu are 7.2px (rounded-ui-sm is not mapped at poolside.css:183).
- Select and command items are 32px at weight 400 at 1280 (select-1280-light.png, site-popover-1280-light.png).
- Dropdown content is 16px radius, 4px padding, 1px border. The menu label is 14px/500.
- The V2System and V2Swimmers-menu mockups show 24px panels and 44px items at weight 600, radius 999 and padding 0 12px.

Select chevron
- Muted ink at 50% opacity measures 2.18:1 in light and 2.84:1 in dark, under the 3:1 needed.

Tooltip
- 16px radius, padding 6px 12px, 12px/400, with an arrow (tooltip-crop.png). .tf-rail-label (poolside.css:484) is the existing v2 tooltip look, so matching it removes a concept.

Toasts
- Injected toasts use the ui-sans-serif system stack at 13px, 12px radius, title weight 500, ink-coloured icon and a 20x20 close.
- At 375 the toast sits 16px from the bottom (831-884) over the bottom bar (828-892).

The change fits DESIGN.md: dialogs 24px, controls and menu items pills at 44px, weights 400/600/700, no letter-spacing, 3:1 for graphics, and phone action rows split equally like the mockup's `.phone .phead .actions .btn {flex:1}`. It needs these corrections:

1. **Some form dialogs would keep the X.** Only FormDialog drops it. Add swimmer, the profile action dialogs and Approve refund are form dialogs with Cancel or Go back footers but are not built on FormDialog, so the acceptance check "form dialogs have no X" would fail on them. Manage enrolment (profile-enrolments.tsx:40) has no footer and correctly keeps the X.

2. **Mapping .rounded-ui-xs and .rounded-ui-sm to 999px across the app has side effects.** It would also turn the ItemMedia icon tiles and images (item.tsx:80-82) and the curriculum image thumbnails (image-thumbnail.tsx:30) into circles, clipping level images. The new menu-item rule and the shared Button close already cover the overlays.

3. **The toast offset in the proposal won't work as written.**
   - sonner applies a numeric mobileOffset to all four sides. Today's deck `mobileOffset={144}` squeezes the toast to 87px wide at 375, one word per line (toast-deck-375-dark.png). A numeric 88 would squeeze it too.
   - sonner's mobile offset only applies at 600px and below, but the bottom bar shows up to 767px and on touch screens. At 700px the toast (823-876) still covers the bar (828-892).
   - Clearances: the desk bottom bar is 72px tall and the deck's sticky save bar is 69px, so 88px clears both.

4. **Menu padding.** The mockup .menu has 16px padding with items pulled out 4px, so the item edge sits 12px in. Use 12px, not 8px. The mockup menu also has no separator lines between groups.

5. **Leftovers.** The X-reserved right padding becomes dead space once the X goes. Also delete the .turnfin-docs close patch at integration.css:29.

The rest checks out: the --pc-scrim values, the inset 24px sheet (DESIGN.md already says full width on phones), DialogFooter as one row, deleting the coarse block, the toast font, radius, weight and icon colours, and the tooltip. Line-variant tabs already measure 44px at 1280, and the only other sheet consumer that would lose the coarse block, the shadcn sidebar sheet, belongs to the unused AppShell.

Coverage
- Routes checked: /students (Add swimmer), /programmes/cmutm2a550007qkluz5pnnhm1 (Add level, tooltip), /students/cmutm2a5u000nqkluiz9dhrn2 (Manage enrolment, Follow-up history sheet, programme select), /courses (Find swimmer, account menu, Site filter popover, toasts), /refunds/8aad93d1-… (the Take responsibility dialog in finance-actions), /instructor (deck toast) and /instructor/classes/… (sticky save bar).
- Widths and themes: dialogs, menus and the select at 1280 light, 1280 dark and 375 dark. Tooltip at 1280 light and dark. Toasts at 1280 light, 1280 dark, 700 light, 375 light and 375 dark.
- Mockups read: V2System, V2Swimmers-menu, HRPerson, ADRoles, SSCancellations, SSAssessSetupList, TRSignoff, DeckAssessment.
- Not checked: Approve refund itself (it needs a second finance user to claim first), Edit role, Report absence, and any coarse-pointer tablet at 768-1100.
- KEEP: The problem is real. Most of the change is safe, but several steps as written would cause regressions that are easy to see. Each one can be fixed by amending the step, so I am not refuting the task.

Evidence for the problem:
- dialog.tsx:74-80 and sheet.tsx:80 draw a bare 16px X with rounded-ui-xs.
- The overlays use bg-black/50 at dialog.tsx:42, alert-dialog.tsx:39 and sheet.tsx:38.
- dialog.tsx:92 has text-center sm:text-left, and alert-dialog.tsx:82 has place-items-center.
- Footers stack with flex-col-reverse (dialog.tsx:110, alert-dialog.tsx:98).
- The select chevron has opacity-50 (select.tsx:302).
- The tooltip renders an Arrow (tooltip.tsx:328).
- sonner.tsx uses --ui-radius and --ui-border. sonner 2.0.8 sets its own system font stack.
- The only 44px close rule is .turnfin-docs-scoped (integration.css:29).

Regressions found:
1) Mapping .rounded-ui-xs/.rounded-ui-sm to 999px would make curriculum images into circles (image-thumbnail.tsx:30, size-10 object-contain). It would also turn the ItemMedia icon and image tiles round (item.tsx:80,82). Nothing needs the mapping, because the new menu rule sets the item radius itself.
2) Deleting all of shadcn.css:221-266 removes far more than menu sizing:
   - 44px for select triggers, sidebar menu buttons (your-modules.tsx uses SidebarMenuButton) and tabs triggers;
   - tabs-list height:auto;
   - the [data-variant][data-size] min-width.
   Only the menu-item and close selectors are replaced by the new rules.
3) 'padding 0 12px' on select, checkbox and radio items overrides the indicator gutters: select pr-8 with the check at right-2 (select.tsx:111,118), and pl-8 with the indicator at left-2 (dropdown-menu.tsx:94-100,130-135). Text would run under the check mark. Vertical padding 0 also puts two-line items against the item edge: swimmer name plus age and member number (student-search.tsx, workspace-search.tsx:43), and label plus hint (searchable-picker.tsx:115-122). Weight 600 on the item would also turn those caption hints bold.
4) An unlayered '.turnfin-app [data-slot=popover-content]{padding:8px}' beats the p-0 at four call sites, each of which puts a Command with an edge-to-edge input row inside a popover:
   - searchable-picker.tsx:92
   - student-search.tsx:127
   - course-filters.tsx:82 (the Classes site filter)
   - instructor-picker.tsx:18
5) Footers in one row with flex:1 and nowrap Buttons (button.tsx:7) would clip at 375. FormDialog's confirmation footer shows Cancel plus 'Keep existing places' and 'Unenrol and enrol', or 'Keep places and join waitlist' (enrolment.ts:144-146). It also shows a role=status 'Saving change…' span (form-dialog.tsx:241). profile-action-dialog.tsx has a third footer slot as well.
6) Cancel buttons wrapped in <DialogClose asChild> take data-slot='dialog-close', because Button spreads props after its own data-slot (button.tsx:54-58). An example is duty-view.tsx:74. So any CSS that positions [data-slot=dialog-close] would move footer buttons too. The X must be positioned by class in dialog.tsx.
7) A 44px X at right 12px takes 56px. Default dialog headers (p-6) have no right padding, so long titles run under the X: profile-history.tsx:20 uses the swimmer's name as the title, and profile-enrolments.tsx:40 has the same layout.
8) Removing the X is only safe where the dialog has its own Cancel:
   - Have one: FormDialog, add-swimmer, profile-action-dialog (Back/Cancel), finance-actions (Go back) and add-class.
   - Have none: rota/activities.tsx, legend-list-match.tsx, take-over.tsx, start-class.tsx, profile-history.tsx, image-thumbnail.tsx and docs/admin.tsx.
   The DialogContent default must stay true. Note that add-swimmer, profile-action-dialog and finance-actions are not FormDialogs, so they keep the X unless they pass false. Acceptance expects Add swimmer and Approve refund to have no X.
9) Toasts:
   - The deck deliberately uses top-center with mobileOffset 144 so toasts never cover its bottom save/continue controls (toast.tsx:390-392, register-form.tsx). Moving the deck to the bottom would cover them.
   - sonner's mobileOffset only applies at 600px and below, but .tf-bottom also shows on touch tablets ((hover:none) and (pointer:coarse), poolside.css:503). A bottom-right toast with the default offset would still cover the bar there.
10) Sheet:
   - SheetContent sets no data-side, so a CSS rule cannot inset it per side; the inset has to be built in sheet.tsx.
   - h-full with inset-y-2 overflows unless the height becomes auto.
   - roster.tsx:144 passes w-full sm:max-w-xl and must still fit.

Boundaries checked: all edits are in shared components or class strings in module files, with no new imports, so the lint import rules and permissions are unaffected. Turnfin Me (apps/me) imports none of these overlays, so a .turnfin-app-scoped --pc-scrim is safe. The instructor-shell.module.css:9 44px rule still holds.