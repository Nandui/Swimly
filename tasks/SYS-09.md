# SYS-09 — One notice component with real tones and icons
Severity: high | Scope: system

## Files (expected)
- DESIGN.md
- src/app/(activities)/analytics/error.tsx
- src/app/(activities)/schedule/error.tsx
- src/app/docs/docs.css
- src/app/docs/poolside.css
- src/app/hr/layout.tsx
- src/components/confirm-action.tsx
- src/components/devices/session-forms.tsx
- src/components/docs/admin.tsx
- src/components/docs/document-body.tsx
- src/components/docs/document-editor.tsx
- src/components/docs/history.tsx
- src/components/docs/new-document.tsx
- src/components/docs/reader.tsx
- src/components/docs/rich-editor.tsx
- src/components/docs/ui.tsx
- src/components/form-dialog.tsx
- src/components/hr/actions.tsx
- src/components/refunds/finance-actions.tsx
- src/components/refunds/receipts.tsx
- src/components/refunds/request-form.tsx
- src/components/shadcn/alert.tsx
- src/components/sign-in-form.tsx
- src/components/staff/change-password-form.tsx
- src/components/ui-kit/notice.tsx
- src/modules/activities/components/attendance/register-conflict.tsx
- src/modules/activities/components/attendance/register-form.tsx
- src/modules/activities/components/courses/add-class.tsx
- src/modules/activities/components/duty/billing-review.tsx
- src/modules/activities/components/duty/cancel-session.tsx
- src/modules/activities/components/enrolment/follow-up-history.tsx
- src/modules/activities/components/enrolment/legend-list-match.tsx
- src/modules/activities/components/instructor/class-session.tsx
- src/modules/activities/components/instructor/complete-level.tsx
- src/modules/activities/components/instructor/move-readiness-status.tsx
- src/modules/activities/components/instructor/start-class.tsx
- src/modules/activities/components/instructor/teaching-ui.tsx
- src/modules/activities/components/parents/parent-accounts.tsx
- src/modules/activities/components/progression/assessment.tsx
- src/modules/activities/components/progression/deck-checklist.tsx
- src/modules/activities/components/students/add-swimmer.tsx
- src/modules/activities/components/students/profile-action-dialog.tsx
- src/modules/activities/components/students/profile-competencies.tsx
- src/modules/activities/components/students/profile-history.tsx
- src/modules/activities/components/students/student-search.tsx
- src/modules/activities/components/students/swimmer-profile.tsx
- src/modules/activities/components/students/workspace-search.tsx

## Problem
poolside.css:358 paints every [data-slot=alert] in primary-soft blue, and only [data-tone=error|warning] changes that. shadcn Alert's variant='destructive' sets no data-tone, so every raw destructive Alert shows as a blue info notice with no icon. That includes the safety-critical 'Medical notes — read before swimming' on the swimmer profile, which V2Profile shows as a red callout with a triangle, plus every save and load error (add-class, add-swimmer, profile dialogs and history, the deck's TeachingNotice, which always uses Info, and Docs Message with its .notice.error/warning classes, which lose to the unlayered rule). There are four notice implementations (Notice, raw Alert, TeachingNotice, Docs Message) and no success tone. Alert hard-codes role='alert', so static notices interrupt screen readers on load, while Docs passes role='status' even for errors. Billing review, cancel session and swimmer search show bare red text with no icon.

## Change (original)
1) alert.tsx: drop the variant prop. Take tone 'info' | 'warning' | 'error' | 'success', written to data-tone, with no default role. 2) notice.tsx is the only notice. Its tone map sets the icon (Info, TriangleAlert, AlertCircle, CircleCheck), and a 'live' prop ('alert' only for errors caused by an action, 'status' for async results, none by default) sets the role. Add `[data-slot='alert'][data-tone='success'] { background: var(--pc-success-soft); color: var(--pc-success); }` next to poolside.css:361. 3) Replace every raw <Alert> outside notice.tsx with <Notice tone=…>. The swimmer profile medical notes use tone 'error' titled 'Medical notes: read before swimming' (as in V2Profile), and 'Medical notes on file' uses tone info. Delete TeachingNotice from teaching-ui.tsx and use Notice in its callers: tone error for save failures, tone warning for cancelled, wrong-site and archived. Delete docs/ui.tsx Message and use Notice in its six callers. Replace the error divs in billing-review.tsx:48, cancel-session.tsx:41 and student-search.tsx:155 with Notice tone error, keeping their focus refs. 4) docs.css: delete the .notice / .notice.* / .draft-notice colour rules (about 1176-1200 and 5389-5404). Analytics and schedule error pages are replaced in SYS-13.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) src/components/shadcn/alert.tsx: remove `variant` and the cva variants. Render `data-slot="alert"` with no default `role`. Accept `data-tone`.

2) src/components/ui-kit/notice.tsx is the only notice.
- Props: `tone: 'info' | 'warning' | 'error' | 'success'` (default info).
- Optional `icon?: LucideIcon`. It defaults to the tone map: info Info, warning TriangleAlert, error AlertCircle, success CircleCheck. Mockups use context icons on callouts (V2Docs eye, V2Document/AUSignIn smartphone, HRPeople lock), so the override is in the direction.
- `live?: 'alert' | 'status'` sets `role`. Use 'alert' only for errors caused by a user action, 'status' for async results, and nothing by default.
- Pass `ref` and `tabIndex` through to the Alert (React 19 ref-as-prop) so focus-summary callers keep working.
- Always render `data-tone`.

3) src/app/docs/poolside.css, next to 358-362:
- Make the default (info) tone `background: var(--pc-surface-sunken); color: var(--pc-ink);` with `[data-slot='alert'] > svg { color: var(--pc-primary) }`. This matches the V2Home, RFNew, DeckCompetencies, AUSignIn and HRPeople info callouts, which use --sunken, not primary-soft.
- Keep error = `--pc-danger-soft` / `--pc-danger` and warning = `--pc-warning-soft` / `--pc-warning`.
- Add `[data-slot='alert'][data-tone='success'] { background: var(--pc-success-soft); color: var(--pc-success); }`.
- For error, warning and success, let `[data-slot='alert-description']` inherit the tone colour, as V2Profile and V2Document do. Contrast is ≥5.2:1 light and ≥8.2:1 dark.

4) Replace every raw <Alert> outside notice.tsx with <Notice>.
- swimmer-profile.tsx:61: medical notes become `tone="error" icon={TriangleAlert} title="Medical notes: read before swimming"`, matching V2Profile and V2PhoneProfile. "Medical notes on file" becomes tone info.
- add-class.tsx:63, add-swimmer.tsx:95 and profile-action-dialog.tsx:52 become tone error with live="alert", keeping summaryRef and tabIndex.
- profile-competencies.tsx:59 and profile-history.tsx:87 become tone error with live="status".
- add-class.tsx:50 becomes tone info.

5) Delete TeachingNotice from teaching-ui.tsx and use Notice in its callers.
- Tone error with live="alert": save and start errors in register-form.tsx:399, complete-level.tsx:81, move-readiness-status.tsx:31, start-class.tsx:95 and deck-checklist.tsx:618.
- Tone warning: class-session.tsx:78/79/83 (cancelled, wrong site, archived), register-conflict.tsx:48 ("Review the saved attendance"), and the "cannot keep a backup" notices at register-form.tsx:401 and deck-checklist.tsx:620.
- Tone info: class-session.tsx:165 (no permission to mark).

6) Delete Message from docs/ui.tsx and use `<Notice tone="error" live="alert">` or `<Notice tone="success" live="status">` at its 11 call sites (admin, document-editor, history, new-document, reader, rich-editor).
- Convert the Docs `<Alert role="status" className="notice …">` blocks to Notice:
  - document-editor.tsx:281: lock error, tone error, icon LockKeyhole, Reconnect as `actions`;
  - document-editor.tsx:291: acquiring session, tone info, live="status";
  - document-editor.tsx:303: reviewer feedback, tone warning, as in DCEdit;
  - reader.tsx:224/232/237 and admin.tsx:445: tone warning.
- Convert the hand-rolled `<div className="draft-notice">` at reader.tsx:242 to `<Notice tone="info" icon={FilePenLine} actions={link}>`.

7) Replace the bare error text in billing-review.tsx:48, cancel-session.tsx:41 and student-search.tsx:155 with `<Notice tone="error" live="alert">`, keeping summaryRef and tabIndex.

8) docs.css:
- Delete every `.notice` and `.draft-notice` rule, layout and colour: about 1176-1215, 1261-1280, 3685-3702, 4109, 4178-4179, 5395-5412 and 7440.
- Where a selector is shared with `.document-callout` (5395, 5409), remove only the `.notice` part and keep `.document-callout` intact, because document-body.tsx:86 uses it for authored callouts.

9) Update DESIGN.md:640 ("A focused shadcn Alert") to name Notice. Add one line under the v2 Colour rule: notices are `Notice` with tone info/warning/error/success, each with an icon.

Acceptance:
- /students/cmutm2a5u000nqkluiz9dhrn2 at 1280 light and dark and at 375 dark shows medical notes on danger-soft with a TriangleAlert icon and the title "Medical notes: read before swimming".
- The Docs edit lock message and a forced DeckChecklist save error are danger-soft with an icon.
- Info notices (e.g. HR "storage is not set up yet") are on surface-sunken with a primary icon.
- The AX tree shows no role=alert on any static notice.
- grep finds no TeachingNotice, no docs Message, no `className="notice` and no `draft-notice`.
- grep finds no shadcn/alert import outside ui-kit/notice.tsx, once SYS-13 replaces analytics/error.tsx and schedule/error.tsx.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) src/components/shadcn/alert.tsx:
- Remove cva/variant.
- Alert takes `tone?: 'info'|'warning'|'error'|'success'` (default 'info'), written to data-tone, and no default role (a role passed in props still applies).
- Keep data-slot and the grid/icon classes.

2) src/components/ui-kit/notice.tsx is the only notice:
- Tone map: info→Info, warning→TriangleAlert, error→AlertCircle, success→CircleCheck.
- Add `live?: 'alert'|'status'` (no default), written to role.
- Add an optional `className` forwarded to Alert, for outer spacing only.
- Stop passing variant.
- In poolside.css next to line 361, add `.turnfin-app [data-slot='alert'][data-tone='success'] { background: var(--pc-success-soft); color: var(--pc-success); }`.

3) Keep today's announcements. Add live="alert" to every existing Notice error that appears after a user action:
- confirm-action.tsx:100
- devices/session-forms.tsx:99,129,157
- form-dialog.tsx:207
- refunds/finance-actions.tsx:70
- refunds/receipts.tsx:32
- refunds/request-form.tsx:60 (error only)
- sign-in-form.tsx:117
- staff/change-password-form.tsx:98
- enrolment/follow-up-history.tsx:74
- enrolment/legend-list-match.tsx:64
- parents/parent-accounts.tsx:44
- progression/assessment.tsx:239
In hr/actions.tsx:124, 'Draft saved' becomes tone success with live="status", and the error keeps live="alert". Static notices (info/warning banners, error.tsx load errors, parent-fields.tsx:18) get no live.

4) Replace every raw <Alert> with <Notice>. This includes src/app/(activities)/analytics/error.tsx and schedule/error.tsx (tone error, no live; SYS-13 may still redesign the pages), so typecheck stays green.
- Swimmer profile: tone error, title 'Medical notes: read before swimming', with children `<p className="whitespace-pre-wrap">{student.medicalNotes}</p>` and no live. 'Medical notes on file' uses tone info.
- add-class.tsx:63, add-swimmer.tsx:95, profile-action-dialog.tsx:52: use the form-dialog pattern `<div ref={summaryRef} tabIndex={-1}><Notice tone="error" live="alert" title={error} /></div>`. Do not add ref to Notice.
- profile-competencies.tsx:59: tone error, live="alert".
- profile-history.tsx:87: tone error, live="alert", with the Try again button in `actions`.
- add-class.tsx:50 (no levels): tone warning.

5) Delete TeachingNotice from teaching-ui.tsx (keep MarkChoices) and use Notice:
- register-form.tsx:399, deck-checklist.tsx:618, complete-level.tsx:81, move-readiness-status.tsx:31, start-class.tsx:95: tone error, live="alert".
- register-form.tsx:401 and deck-checklist.tsx:620 (backup unavailable): tone warning.
- register-conflict.tsx:48: tone warning, no live (its wrapping region is focused).
- instructor/class-session.tsx:78 (cancelled), :79 (wrong site), :83 (archived): tone warning.
- instructor/class-session.tsx:165 (no permission): tone info.

6) Delete Message from docs/ui.tsx. Its 11 call sites are in admin.tsx (148, 743), history.tsx (66), document-editor.tsx (279, 571, 573, 670), new-document.tsx (222), reader.tsx (222, 566) and rich-editor.tsx (90).
- Errors after an action: tone error, live="alert".
- Success: tone success, live="status".
- document-editor.tsx:571 and :670 are static preconditions: tone error, no live.
Raw Docs Alerts:
- document-editor.tsx:281 lock error: tone error, live="alert", Reconnect button in actions (the LockKeyhole icon is dropped).
- document-editor.tsx:291: tone info, live="status".
- document-editor.tsx:303: tone warning, title 'Reviewer feedback', feedback as description.
- admin.tsx:445: tone warning.
- reader.tsx:224: tone warning, with the Link in actions.
- reader.tsx:232 and :237: tone warning.
- reader.tsx:242 .draft-notice div: Notice tone info, with the link in actions.
Every Docs Notice passes className="my-4" to replace the old .notice margin. Do NOT add a `.turnfin-docs [data-slot='alert']` margin rule, because .turnfin-docs also wraps the Refunds, HR and Rota dialogs.

7) billing-review.tsx:48 and cancel-session.tsx:41: `<div ref={summaryRef} tabIndex={-1}><Notice tone="error" live="alert" title={feedback.message} /></div>`. student-search.tsx:155 and workspace-search.tsx:41: `<div className="p-2"><Notice tone="error" live="alert" title={error} /></div>` inside CommandList (neither has a focus ref). Leave the inline field errors alone (field-frame.tsx:32, select.tsx:159, image-field.tsx:70, legend-agreement-field.tsx:23).

8) docs.css: delete by selector, NOT by line range.
- Delete .notice, .notice.error/.success/.warning, .notice > a and .notice > .button (about 1176-1214).
- Delete .draft-notice and .draft-notice > a (about 1261-1281).
- Delete the mobile .notice / .draft-notice rules (about 3685-3705).
- Delete .notice[data-slot='alert'] (about 7440-7443).
- Delete .notice.success and .notice.error (about 5401-5408).
- At 4109, 5395 and 5409, remove only the `.notice` and `.notice.warning` selectors and KEEP .document-callout and .document-callout.warning. Keep .acknowledgement (about 5388-5394).
- In the print block at 4178-4179, replace `.notice, .draft-notice` with `[data-slot='alert']` so notices stay off printed documents.

9) In DESIGN.md, add one line: Notice is the only notice, with tones info/warning/error/success, each with an icon; live="alert" only for errors caused by an action, live="status" for async results.

Acceptance (in addition to the original):
- npm run typecheck and npm run lint pass.
- grep finds no `shadcn/alert` import outside ui-kit/notice.tsx, and no TeachingNotice, `Message` from docs/ui, `className="notice` or draft-notice.
- The AX tree for sign-in with a wrong password still exposes role=alert, and the static 'shared device' / archived-class notices expose none.
- The Docs reader print preview shows no notice.
- There is no preview fixture route for DeckChecklist, so force its save error by going offline in devtools on the started class (/instructor/classes/cmutm2a5g000eqkluc713evsf?tab=all&date=2026-10-04) and check it shows danger-soft with an AlertCircle icon.

## Acceptance
/students/cmutm2a5u000nqkluiz9dhrn2 at 1280 light and dark and 375 dark shows medical notes on danger-soft with an AlertCircle icon. The Docs edit lock message and a forced DeckChecklist save error (preview fixture) are danger with an icon. The AX tree shows no role=alert on a static notice. grep finds no import of shadcn/alert outside ui-kit/notice.tsx, and no TeachingNotice or Message.

## Verification notes
- KEEP: The problem is real today, and I checked it in both the code and the live sandbox.

Code:
- poolside.css:358 is unlayered: `@layer base` closes at 201 and `@layer components` opens at 421. It sets primary-soft and primary-ink on every [data-slot=alert].
- Only `[data-tone=error|warning]` (361-362) override it. There is no success rule, even though `--pc-success-soft` exists at line 39.
- shadcn alert.tsx:29 hard-codes role="alert" and writes no data-tone.
- Notice (ui-kit/notice.tsx) does set data-tone, but it inherits that static role="alert". For example, the HR "storage is not set up yet" info notice at hr/layout.tsx:33 announces as an alert.

Raw Alerts:
- swimmer-profile.tsx:61 uses variant="destructive" for medical notes.
- Destructive Alerts also appear in add-class.tsx:63, add-swimmer.tsx:95, profile-action-dialog.tsx:52, profile-competencies.tsx:59 and profile-history.tsx:87.
- TeachingNotice (teaching-ui.tsx:48-66) always renders the Info icon.
- Docs Message (docs/ui.tsx:129) has 11 call sites in 6 files.
- Docs uses `<Alert role="status" className="notice error|warning">` at document-editor.tsx:281/291/303, reader.tsx:224/232/237 and admin.tsx:445. The lock error passes role=status.
- billing-review.tsx:48, cancel-session.tsx:41 and student-search.tsx:155 are bare `text-ui-destructive` text with no icon.

Live, computed with cdp-eval and an injected probe:
- The medical notes on /students/cmutm2a5u000nqkluiz9dhrn2 have role=alert, no tone, rgb(233,240,253) background, primary-ink text and no svg in light. In dark the background is rgb(23,40,74) with no svg. Screenshots: shots/audit2/sys09/students_…-1280-light.png, -1280-dark.png and -375-dark.png.
- Probes for `.notice error`, `.notice warning`, `bg-ui-card text-ui-destructive` and `data-tone=success` all resolve to primary-soft blue. Only data-tone=error resolves to danger-soft.
- The Docs edit lock message ("Alex Example is editing this document…") renders blue with role=status (shots/audit2/sys09/crop_lock.png, dark).

Mockup: V2Profile shows the medical callout as c-red. Its tokens are --rb #fde8e6/#3a1815 and --rf #b4321f/#ffa395, which equal `--pc-danger-soft` and `--pc-danger`. The title is "Medical notes: read before swimming" (shots/audit2/sys09/crop_mock_med.png).

The direction holds. DESIGN.md v2 says "Status colour comes only from domain metadata maps, always with an icon" and "notices use 16px". Mockup tones map 1:1 onto existing tokens:
- c-red = danger;
- --ab/--af in DCEdit = warning;
- --gb/--gf = success.

Contrast passes in both modes:
- danger/danger-soft: 5.23 light, 8.27 dark;
- warning: 5.34 / 9.75;
- success: 5.39 / 8.96.

Collapsing four notice implementations into Notice matches the pillars.

The plan needs four corrections against the mockups:
1. Icon. V2Profile, V2PhoneProfile, V2Document and V2PhoneDocument all draw the red callout with TriangleAlert, not AlertCircle. The acceptance criterion "AlertCircle icon" contradicts V2Profile. Mockup callouts also use context icons: eye (V2Docs), smartphone (V2Document, AUSignIn, V2Home), lock (HRPeople), message (MeHome). So Notice needs an optional icon override that defaults to the tone map.
2. Info background. Every mockup info callout (V2Home, RFNew, DeckCompetencies, AUSignIn, HRPeople) uses `--sunken` (= `--pc-surface-sunken`) with a primary icon and ink text, not primary-soft. Keeping 358 as primary-soft keeps an off-mockup info tone.
3. A fifth notice is missed. reader.tsx:242 `.draft-notice` is a hand-rolled notice div. Step 4 deletes its colour rules without converting it, which would leave it half-styled.
4. Shared selector. docs.css:5395 groups `.notice` with `.document-callout`, which authored document bodies use (document-body.tsx:86). A blind delete would strip callout colours from published documents.

Smaller points:
- Notice must pass through ref and tabIndex (React 19.2 ref-as-prop) for the focus-summary callers.
- The "no shadcn/alert import" acceptance check also depends on SYS-13, because analytics/error.tsx and schedule/error.tsx import it.
- DESIGN.md:640 still says "A focused shadcn Alert".
- KEEP: The problem is real. I checked the code and the live sandbox. poolside.css:358 is unlayered and wins over docs.css's layered .notice rules (which sit in @layer legacy/components) and over the Tailwind variant utilities. A raw <Alert variant="destructive"> sets no data-tone, so it renders as a blue info box with no icon. Screenshot shots/audit2/sys09-skeptic/students_cmutm2a5u000nqkluiz9dhrn2-1280-light.png shows 'Medical notes — read before swimming' on primary-soft blue with no icon. The success/danger tokens pass contrast: success 5.39 (light) and 8.96 (dark), danger 5.23 and 8.27. The import boundaries are fine: modules/activities already imports @/components/ui-kit/notice in take-over.tsx, class-session.tsx and assessment.tsx, and Docs may import ui-kit.

The change as written still causes 7 regressions, all fixable by amending it:
(1) Dropping Alert's default role="alert" with live defaulting to none silently mutes about 16 existing Notice error call sites that announce today only because of the implicit role. Examples: sign-in-form.tsx:117, confirm-action.tsx:100, form-dialog.tsx:207, session-forms.tsx:99/129/157, refunds finance-actions.tsx:70, receipts.tsx:32, request-form.tsx:60, change-password-form.tsx:98, follow-up-history.tsx:74, legend-list-match.tsx:64, parent-accounts.tsx:44, assessment.tsx:239.
(2) analytics/error.tsx:7 and schedule/error.tsx:7 still pass variant="destructive". If SYS-09 lands before SYS-13, typecheck breaks and the acceptance grep fails.
(3) The 'keep focus refs' step needs a home. summaryRef from useFormFeedback is a HTMLDivElement ref, and Notice takes no ref or tabIndex. The existing pattern in form-dialog.tsx:206 is a wrapping <div ref tabIndex={-1}>. student-search.tsx:155 has no ref at all.
(4) Deleting docs.css by the line range 5389-5404 would also remove the .acknowledgement rules. The combined selectors at 4109, 5395 and 5409 also style .document-callout, which document-body.tsx:86 and editor-extensions.ts:42 use.
(5) The print block at docs.css:4178-4179 hides .notice and .draft-notice. Once the class is gone, the 'previous version', 'frozen submission' and 'archived' notices would print on paper.
(6) .notice gave Docs notices margin: 15px 0, and their siblings in reader.tsx and document-editor.tsx are not in a gap stack, so the notices would butt against the toolbar. A global `.turnfin-docs [data-slot=alert]` margin rule would leak, because .turnfin-docs is also used by the Refunds, HR and Rota dialogs.
(7) reader.tsx:242 .draft-notice is a plain div, not an Alert. Deleting its colour rules leaves it unstyled.

Smaller points:
- The medical notes need whitespace-pre-wrap kept (it is AlertDescription className today).
- workspace-search.tsx:41 has the same bare red error as student-search.
- Docs Message already uses role=alert for errors. The role='status'-on-error problem is in the raw Docs Alerts, e.g. document-editor.tsx:281.
- No 'preview fixture' route exists under src/app for the DeckChecklist acceptance check.