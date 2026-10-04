# SYS-10 — Forms: labels, hints, choice rows, selects, one search field, one file field
Severity: medium | Scope: system

## Files (expected)
- src/app/(instructor)/instructor/swimmers/page.tsx
- src/app/docs/poolside.css
- src/app/refunds/refunds.css
- src/app/workspace/module-workspace.css
- src/components/docs/home.tsx
- src/components/docs/library.tsx
- src/components/docs/work.tsx
- src/components/form-dialog.tsx
- src/components/hr/actions.tsx
- src/components/refunds/fields.tsx
- src/components/rota/absences.tsx
- src/components/rota/actions.tsx
- src/components/searchable-picker.tsx
- src/components/shadcn/label.tsx
- src/components/shadcn/native-select.tsx
- src/components/shadcn/select.tsx
- src/components/staff/role-actions.tsx
- src/components/training/manage-actions.tsx
- src/components/ui-kit/search-field.tsx
- src/components/ui/choice-row.tsx
- src/components/ui/field-frame.tsx
- src/components/ui/file-field.tsx
- src/components/ui/form-feedback.tsx
- src/components/ui/input.tsx
- src/components/ui/select.tsx
- src/components/ui/switch.tsx
- src/components/ui/textarea.tsx
- src/modules/activities/components/assessments/type-actions.tsx
- src/modules/activities/components/courses/add-class.tsx
- src/modules/activities/components/courses/course-actions.tsx
- src/modules/activities/components/courses/course-filters.tsx
- src/modules/activities/components/curriculum/image-field.tsx
- src/modules/activities/components/curriculum/level-actions.tsx
- src/modules/activities/components/curriculum/programme-actions.tsx
- src/modules/activities/components/enrolment/awaiting-queue.tsx
- src/modules/activities/components/enrolment/legend-agreements.tsx
- src/modules/activities/components/enrolment/legend-list-match.tsx
- src/modules/activities/components/students/student-search.tsx
- src/modules/activities/components/students/swimmer-browser.tsx

## Problem
FieldFrame appends a muted '(required)' span with no space ('Current password(required)', also the accessible name), while other forms write '(optional)' by hand; the approved RFNew, AUSignIn and ADAccount mockups mark only optional fields, with an 'Optional' caption. Hints are 14px under the field (no data-slot, so the caption rule at poolside.css:407 misses them), and errors are 14px red text with no icon. module-workspace.css:7 and refunds.css:6 force labels to display:block, which kills the Label gap. Choice rows put the radio or checkbox beside the Label, so the field-label rule makes option names and hints 600 (Add note, Assign training, Rota reasons), and poolside.css:391 (label:has(radio) align flex-start) pushes hidden-radio chips to the top. The ui/switch description is 14px and its accessible name falls back to the form field name ('requiresSignoff'). 'Choose one' fields come in three looks: Select and NativeSelect at weight 400 with a 2.18:1 chevron, and SearchablePicker as an outline Button at weight 600 with ChevronsUpDown. Select keys option groups by title, so two programmes with the same name produce duplicate React keys. Search fields are hand-rolled six ways with an extra filled 'Search' button, while the shared SearchField is unused. Native file inputs show the browser's 'Choose file / No file chosen' inside a pill field in five places.

## Change (original)
1) FieldFrame: label (600), then a caption slot with data-slot='field-description' holding 'Optional' (new optional prop) and/or the hint, then the control, then the error as caption text in --pc-danger with an AlertCircle icon. Delete the automatic '(required)' span and keep native required. Update the regex in form-feedback.tsx:66. ui/input, ui/textarea and ui/select pass through optional. ui/switch: the description uses the same caption slot, and aria-label falls back to the visible label, not the name. 2) Delete module-workspace.css:7 and refunds.css:6. 3) Add ui/choice-row.tsx: a radio or checkbox inside its <Label> as a 16px .pc-row, with the title at body/600 and the hint at text-xs muted 400. Scope poolside.css:391 to labels whose control is visible (:not(:has(.sr-only)), never .pc-seg-item). label.tsx: remove leading-none and font-medium. 4) native-select.tsx:27: remove opacity-50 from the chevron. SearchablePicker's trigger uses the field look (select-trigger styling, weight 400, ChevronDown, optional muted inline label such as 'Site All sites') instead of an outline Button. 5) ui/select.tsx:146: key groups by a stable id that callers pass; add-class.tsx passes programme.id. 6) search-field.tsx becomes the one search: a visible Label, a 44px pill input with a leading Search icon and no trailing ellipsis, submitted on Enter with a visually hidden submit button, and an optional ghost 'Clear' link. There is no visible submit button, as in V2Swimmers, V2Classes, V2Awaiting and SSLegend. Module tasks adopt it. 7) Add ui/file-field.tsx: a visually hidden native input, an outline Button 'Choose file' (Paperclip icon), and the chosen file name or 'No file chosen yet' as a caption. image-field.tsx and legend-list-match.tsx adopt it; Refunds and Docs adopt it in RF-02 and DC-02.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep steps 1 to 7 with these changes:
1) FieldFrame: label (600), then a caption slot with data-slot='field-description' holding 'Optional' (from a new `optional` prop) and/or the hint, then the control, then the error in --pc-danger with an AlertCircle icon. The error stays at text-sm/400 body size: the v2 type table keeps caption for metadata and hints, and an error must be noticed. Delete the automatic '(required)' span and keep native required. Update form-feedback.tsx:66. ui/input, ui/textarea, ui/select and SearchablePicker pass `optional` through. form-dialog.tsx Field (the cloneElement at about line 341) passes `optional` too. Move every call site to the prop: remove '(optional)' from about 25 labels (rota, training, people, hr, refunds) and 'Optional —' / 'Optional.' from the 8 hints (level-actions.tsx:66 and :213, course-actions.tsx:79 and :153, programme-actions.tsx:58, type-actions.tsx:46, add-class.tsx:52, role-actions.tsx:152). Otherwise the caption repeats them. refunds/fields.tsx RefundInput and RefundText add their own '(required)'. Delete it in the same change, or say clearly that RF-02 owns it.
ui/switch: the description uses the same caption slot. Never build aria-label from `name`. Leave aria-label undefined when there is no `label` prop, so an htmlFor label names the switch. manage-actions.tsx:121-123 passes label="A trainer signs it off in person" to ui/Switch and drops its hand-rolled wrapper.
2) As proposed: delete module-workspace.css:7 and refunds.css:6.
3) As proposed (ui/choice-row.tsx matches the HRPerson mockup's label.item rows). Note that today the names are 500 and the hints 600. Scope poolside.css:391 with :not(:has(.sr-only)) so the /roles level chips centre again. label.tsx: remove leading-none and font-medium.
4) Remove opacity-50 from both native-select.tsx:27 and shadcn/select.tsx:46. SearchablePicker's trigger takes the field look: select-trigger styling, weight 400, ChevronDown, no outline Button. Drop the inline 'Site All sites' label, because the picker only appears in form dialogs under a visible label.
5) As proposed: key groups by a stable id; add-class.tsx passes programme.id.
6) search-field.tsx becomes the one search: a visible Label, a 44px pill input with a leading Search icon, enterKeyHint='search', and no trailing ellipsis in the placeholder. Submit on Enter. Any hidden submit button gets tabIndex={-1} and aria-hidden, so it is never an invisible tab stop. Optional ghost 'Clear'. No visible submit button. This covers list filters only; exact lookups such as 'Find a parent account' keep their visible primary button.
7) ui/file-field.tsx follows the MeQualifications mockup: label, caption hint, then a full-width, left-aligned outline pill Button with the lucide Upload icon reading 'Choose a file'. The native input is sr-only with tabIndex={-1}, so the Button is the single tab stop and calls input.click(). Native reset and validation stay. After a file is chosen, show its name as a caption. With no file, show only the hint. image-field.tsx and legend-list-match.tsx adopt it; Refunds and Docs adopt it in RF-02 and DC-02.
Acceptance as proposed, plus: in both themes the shadcn Select chevron is at least 3:1, and the /roles level chips are vertically centred.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep steps 1 and 3–7, with these corrections.

A) Replace step 2. Do not just delete module-workspace.css:7 and refunds.css:6. Replace both with ONE rule in poolside.css next to line 389. It keeps today's block layout for non-choice labels in module and refund scopes, and excludes choice labels by data-slot:
`.turnfin-app :is(.turnfin-module, .turnfin-refunds) :is(.module-content, .refund-content, [data-slot='dialog-content']) label:not(:has([type='checkbox'], [type='radio'], [data-slot='checkbox'], [data-slot='radio-group-item'])) { display: block; }`
Removing it outright would let docs.css:126 (flex column) and Label's items-center centre every field label.

B) poolside.css:391:
- Keep font-size and line-height for every choice label.
- Apply align-items:flex-start only when the control is visible: `.turnfin-app label:has(:is([data-slot='checkbox'], [data-slot='radio-group-item']):not(.sr-only)) { align-items: flex-start; }`.
- Do not use `:not(:has(.sr-only))`.
- Drop the `.pc-seg-item` clause.

C) ui/choice-row.tsx:
- Use a shadcn Label holding a shadcn Checkbox or RadioGroupItem, with spans using .pc-row-body, .pc-row-title (600) and .pc-row-hint, and the class `pc-row`.
- Add one rule in poolside.css after line 391, because docs.css:126 and :4377 otherwise make it a column at weight 500, and .pc-row's 64px can't be overridden by a utility: `.turnfin-app label.pc-row { flex-direction: row; flex-wrap: nowrap; align-items: flex-start; min-height: 56px; font-weight: 400; cursor: pointer; }`. The 56px comes from the HRPerson mockup.
- Add `:has(:focus-visible)` (outline --pc-focus) and `:has([data-state=checked])` (border --pc-primary).
- Adopt it at: hr/actions.tsx:40-46, rota/absences.tsx:34-39, rota/actions.tsx:32-36, 40-44 and 185-188, and training/manage-actions.tsx:76-79. For the last one, raise max-h-64 so more than 3 rows show.
- Removing leading-none and font-medium from label.tsx is fine, but it does nothing inside .turnfin-docs.

D) Chevron: remove opacity-50 from both native-select.tsx:27 and shadcn/select.tsx:46.

E) Switch:
- In ui/switch, remove the `props.name` aria-label fallback. The accessible name comes only from `label` or an explicit aria-label.
- Move the description out of the Label into the caption slot (data-slot='field-description', id `${id}-hint`).
- In training/manage-actions.tsx:121-124, pass `label="A trainer signs it off in person"` to Switch and delete the sibling Label and its wrapper div.

F) The `optional` prop:
- Thread it through ui/input, ui/textarea, ui/select, SearchablePicker and the form-dialog Field (both the cloneElement path and the FieldFrame path).
- Include `${id}-hint` in aria-describedby when `optional || description`.
- Delete the `(required)` replace in form-feedback.tsx:66.
- Replace the hand-written '(optional)' labels in the acceptance dialogs with `optional`: training/manage-actions.tsx:56, 125 and 162; rota/absences.tsx:69 and 250; rota/actions.tsx:39, 126 and 132; hr/actions.tsx:118.

G) ui/select:
- Send its 'Choose an option.' error through FieldFrame's error prop, so there is one error look with the icon.
- Make `SelectGroup.id` required and key groups by it.
- Pass programme.id from add-class.tsx:51 and from course-actions.tsx:66, which has the same name keying.

H) SearchablePicker trigger:
- Keep a shadcn Button, for lint, with `data-slot="select-trigger"` so poolside's field rule (line 370) styles it. Use weight 400 and ChevronDown.
- Keep `h-auto min-h-11 whitespace-normal` so long names wrap instead of clipping.
- Show the inline muted label only when the field label is hidden.
- Apply the same trigger to student-search.tsx:105-121.

I) SearchField:
- Support uncontrolled use (name/defaultValue inside a GET form).
- Add a controlled mode (value/onValueChange) with no submit button, for live filters.
- The hidden submit is a shadcn `<Button type="submit" className="sr-only" tabIndex={-1}>`. Raw <button> is linted.

J) ui/file-field.tsx:
- Put a shadcn `<Input type="file" className="sr-only" tabIndex={-1}>` inside a `relative` wrapper. A raw <input> is linted.
- Forward ref, name, accept, onChange and aria-*.
- The visible outline Button opens the picker.
- On invalid: preventDefault, focus the Button, and show FieldFrame's error. This is the same pattern as ui/select's onInvalidCapture.
- Read the file name after calling the consumer's onChange. Clear it on form reset.
- In ImageField, remount the field with a key on 'Remove image' so no stale name shows.

K) Leave refunds/fields.tsx's own '(required)' for RF-02. It is safe only while rule A still covers .turnfin-refunds.

## Acceptance
On /account (password and PIN), /sign-in, the Add level, Add note, Assign training and Report absence dialogs, and /students/parents at 1280 light and 375 dark: no '(required)' text; optional fields show an 'Optional' caption under the label; hints are 12px under the label; option names are 600 with 400 hints; the course switch AX name is 'A trainer signs it off in person'; the select chevron is at least 3:1. Opening Add class logs no duplicate-key error. Add level shows the 'Choose file' pill.

## Verification notes
- KEEP: The problem is real. I confirmed it in the code and in the live sandbox, and the core of the change matches the approved mockups and the DESIGN.md v2 rules. Evidence (screenshots in scratchpad/shots/audit2/sys10-skeptic):
- (required): field-frame.tsx:25 appends a span with no space. The live accessible text reads "Current password(required)" and "New password again(required)" on /account (crop-account-pw.png), "Email(required)" and "Password(required)" on /sign-in, and "Parent email(required)" on /students/parents. On /account the label is display:block because module-workspace.css:7 matches (ancestor .turnfin-module .module-content), so the 8px Label gap is lost. refunds.css:6 is the same rule. The ADAccount, AUSignIn and RFNew mockups have no required marker. RFNew marks optional fields with a 12px "Optional" caption (.cap) under the label, and ADAccount puts its hints ("At least 8 characters.", the PIN rule) as captions between the label and the control.
- Hints: live they are 14px under the field with no data-slot, so poolside.css:407 misses them. On /students/parents this also pushes "Find account" out of line with the input.
- Three optional conventions coexist: "(optional)" in about 25 labels (rota, training, refunds, hr), "Optional —" or "Optional." in 8 hints (level-actions.tsx:66 and :213, course-actions.tsx:79 and :153, programme-actions.tsx:58, type-actions.tsx:46, add-class.tsx:52, role-actions.tsx:152), and the automatic "(required)". The regex is at form-feedback.tsx:66.
- Choice rows: in the live HR Add note dialog the option hints compute to 14px/600 and the option names to 500. The names are 500, not 600 as the task claims, because of the font-medium span (hr/actions.tsx:41-46, crop-hr-addnote.png). The HRPerson mockup uses label.item rows with the radio inside the label, a 600 title (.strong) and a 12px .cap hint, which is exactly change 3. poolside.css:391 is confirmed: the hidden-radio level chips in the /roles editor compute align-items:flex-start, so the text sits at the top of the 44px chip (crop-roles-chips.png, role-actions.tsx:92-100).
- Switch: the live accessible name is "requiresSignoff". manage-actions.tsx:121-123 uses an external Label htmlFor, and ui/switch.tsx overrides it with aria-label=name.
- Chevrons: live opacity is 0.5 on both chevrons, native-select.tsx:27 and the shadcn Select trigger (shadcn/select.tsx:46, measured in Add class). That gives 2.16:1 in light and 2.75:1 in dark; without the opacity it is 6.1:1 and 6.8:1.
- SearchablePicker: it is an outline Button, and .ui-motion-press at poolside.css:340 forces weight 600 over font-normal, with ChevronsUpDown. The Site Select next to it in the same enrol dialog is 400 with ChevronDown.
- Duplicate keys: the Add class Level select shows two groups both titled "Learn to swim" in the sandbox, and select.tsx:146 keys groups by title, so the duplicate key is certain.
- Search: at least 11 search inputs follow 7 or more patterns. Filled "Search" buttons: course-filters.tsx:45, legend-agreements.tsx:52, swimmer-browser.tsx:52. Outline: awaiting-queue.tsx:30. Ghost icon: library.tsx:158, work.tsx:205. Filled "Find": instructor/swimmers/page.tsx:30. Docs home: home.tsx:71. Several placeholders have trailing ellipses. The shared SearchField is never imported. Every mockup (V2Swimmers, V2Classes, V2Awaiting, SSLegend, V2System) uses a visible label and a pill with a leading icon and no submit button.
- File inputs: there are 5 native ones. Add level shows "Choose file No file chosen" inside a 44px pill (crop-addlevel-file.png).

Corrections needed: the switch fix as written can't work for an external label. The select fix misses the shadcn Select chevron. The file field should follow the approved MeQualifications mockup, which is an outline pill with the lucide Upload icon reading "Choose a file", not a Paperclip "Choose file". A visually hidden submit button must not become an invisible tab stop. The optional-field migration and the Field cloner in form-dialog.tsx are missing. SearchablePicker in forms already has a visible label above it, so the inline "Site All sites" label (the filter-bar .btn.sel pattern) would duplicate it.
- KEEP: The task is real, and every amendment below can be fixed by changing the instructions. As written, though, several steps would cause visible regressions.

1) Step 2 (deleting module-workspace.css:7 and refunds.css:6) breaks every field label in the modules. ModuleShell puts "turnfin-docs turnfin-module" on the Swim school, Core, Training, HR, Rota and Refunds shells and dialog portals. docs.css:126 then applies `:where(.turnfin-docs) label {display:flex; flex-direction:column}` in its legacy layer. Combined with Label's `items-center`, labels without a control centre horizontally. I measured this in the sandbox by deleting the rule through CSSOM:
   - /account 'Current password' text moved from offset 0 to 131px in a 384px label;
   - /students/parents went from 0 to 269px;
   - /refunds/new: all 11 labels centred, e.g. 'Reason for refund' at 326px of 772px.
   It would also stack the hand-written spans in refunds/fields.tsx:9,12 and training/manage-actions.tsx:78.
   Those same rules exclude only native [type=checkbox|radio]. Radix renders those only as bubble inputs inside forms, so a ChoiceRow label is display:block today and its control stacks above the title. I measured this with an injected .pc-row label.
2) In .turnfin-docs a ChoiceRow label still gets column direction from docs.css:126 and weight 500 from docs.css:4377. So removing font-medium from label.tsx changes nothing there. The .pc-row min-height of 64px is unlayered, so a utility class cannot override it.
3) The proposed `:not(:has(.sr-only))` for poolside.css:391 also matches visible-radio rows that contain sr-only text: class-enrolment-dialog.tsx:118 has 'Site: ', 'Day: ' and 'Time: ' spans. The `.pc-seg-item` clause does nothing, because no label carries that class (segmented-links.tsx uses it on links only).
4) The Radix Select chevron also has opacity-50 (shadcn/select.tsx:46). At 50% the chevron is 2.18:1 in light and 2.84:1 in dark; at full opacity it is 6.13 and 7.32. Fixing only native-select.tsx would fail the acceptance check.
5) The course switch (manage-actions.tsx:121-124) passes no label. Its visible text is a sibling Label, so ui/switch cannot fall back to it. The switch's description also sits inside its Label, so it pollutes the accessible name.
6) The `optional` prop would not reach the form-dialog Field (cloneElement path and FieldFrame path) or SearchablePicker. The acceptance dialogs write '(optional)' by hand.
7) course-actions.tsx:66 keys Select groups by programme name exactly as add-class.tsx does. ui/select renders its own 'Choose an option.' error outside FieldFrame.
8) Lint (no-restricted-syntax) forbids a raw <input> unless type is hidden, and any raw <button> or <label>. FileField and the hidden submit in SearchField must use shadcn parts.
9) ImageField clears the input in code: invalid files are cleared inside onChange, and 'Remove image' sets input.value = "", which fires no change event. A FileField that keeps the file name in its own state would show a stale name.
10) SearchField is unused today, so changing it affects nothing yet. But live client-side filters can only adopt it if it supports a controlled mode: help-browser.tsx:57, class-enrolment-dialog.tsx:81, 'Filter people' in training/manage-actions.tsx, and the Docs filters.
11) The SearchablePicker trigger needs the same treatment in student-search.tsx. select-trigger styling is nowrap with line-clamp-1, so long names would clip at 375px.

Import boundaries are fine: src/components/ui/* is Core, and Activities may import it. No unit tests reference these parts.