# SYS-08 — Status tags take their label, tone and icon from one metadata entry
Severity: high | Scope: system

## Files (expected)
- DESIGN.md
- src/app/(activities)/assessments/[id]/page.tsx
- src/app/(activities)/programmes/[id]/page.tsx
- src/app/(activities)/programmes/page.tsx
- src/app/(activities)/students/parent-changes/page.tsx
- src/app/(core)/account/page.tsx
- src/app/(core)/clubs/page.tsx
- src/app/(core)/roles/page.tsx
- src/app/(core)/staff/[id]/page.tsx
- src/app/(core)/staff/details-requests/page.tsx
- src/app/(core)/staff/devices/page.tsx
- src/app/(core)/staff/organisation/page.tsx
- src/app/(core)/staff/page.tsx
- src/app/(instructor)/instructor/page.tsx
- src/app/(instructor)/instructor/swimmers/page.tsx
- src/app/docs/docs.css
- src/app/docs/integration.css
- src/app/docs/poolside.css
- src/app/hr/page.tsx
- src/app/hr/people/[id]/page.tsx
- src/app/hr/reviews/[id]/page.tsx
- src/app/rota/absences/page.tsx
- src/app/rota/bookings/page.tsx
- src/app/rota/today/page.tsx
- src/app/shadcn.css
- src/app/training/certificates/page.tsx
- src/app/training/courses/page.tsx
- src/app/training/expiring/page.tsx
- src/app/training/page.tsx
- src/app/training/people/[id]/page.tsx
- src/components/activity-table.tsx
- src/components/docs/admin.tsx
- src/components/docs/document-body.tsx
- src/components/docs/document-editor.tsx
- src/components/docs/document-list.tsx
- src/components/docs/history.tsx
- src/components/docs/reader.tsx
- src/components/docs/reports.tsx
- src/components/docs/ui.tsx
- src/components/docs/work.tsx
- src/components/home/home-parts.tsx
- src/components/hr/status.tsx
- src/components/refunds/detail.tsx
- src/components/refunds/queue.tsx
- src/components/refunds/status.tsx
- src/components/rota/roster.tsx
- src/components/rota/status.tsx
- src/components/shadcn/badge.tsx
- src/components/training/status.tsx
- src/components/ui-kit/app-shell.tsx
- src/components/ui-kit/prose.tsx
- src/components/ui-kit/tab-strip.tsx
- src/components/ui-kit/tag.tsx
- src/lib/activity/constants.ts
- src/lib/clubs/constants.ts
- src/lib/devices/meta.ts
- src/lib/docs/content.ts
- src/lib/docs/types.ts
- src/lib/docs/workflow.test.ts
- src/lib/help/guides-classes.ts
- src/lib/home-meta.ts
- src/lib/hr/constants.ts
- src/lib/people/constants.ts
- src/lib/people/details-requests.ts
- src/lib/refunds/types.ts
- src/lib/rota/constants.ts
- src/lib/staff/constants.ts
- src/lib/status.ts
- src/lib/training/constants.ts
- src/modules/activities/components/analytics/instructor-report.tsx
- src/modules/activities/components/assessments/session-directory.tsx
- src/modules/activities/components/attendance/class-session.tsx
- src/modules/activities/components/attendance/register-form.tsx
- src/modules/activities/components/courses/class-browser.tsx
- src/modules/activities/components/courses/class-detail.tsx
- src/modules/activities/components/duty/billing-list.tsx
- src/modules/activities/components/duty/billing-review.tsx
- src/modules/activities/components/duty/duty-view.tsx
- src/modules/activities/components/enrolment/awaiting-enrolment.tsx
- src/modules/activities/components/enrolment/awaiting-moves.tsx
- src/modules/activities/components/enrolment/follow-up-history.tsx
- src/modules/activities/components/enrolment/legend-agreements.tsx
- src/modules/activities/components/instructor/assessment-session.tsx
- src/modules/activities/components/instructor/move-readiness-status.tsx
- src/modules/activities/components/parents/access-requests.tsx
- src/modules/activities/components/parents/assessment-publication.tsx
- src/modules/activities/components/parents/guardian-access.tsx
- src/modules/activities/components/parents/parent-accounts.tsx
- src/modules/activities/components/progression/assessment.tsx
- src/modules/activities/components/progression/deck-checklist.tsx
- src/modules/activities/components/students/class-enrolment-dialog.tsx
- src/modules/activities/components/students/profile-competencies.tsx
- src/modules/activities/components/students/profile-enrolments.tsx
- src/modules/activities/components/students/profile-history.tsx
- src/modules/activities/components/students/student-directory.tsx
- src/modules/activities/components/students/swimmer-profile.tsx
- src/modules/activities/components/today/calendar.tsx
- src/modules/activities/components/together/combination-list.tsx
- src/modules/activities/lib/analytics/reports.ts
- src/modules/activities/lib/assessments/constants.ts
- src/modules/activities/lib/attendance/constants.ts
- src/modules/activities/lib/cancellations/constants.ts
- src/modules/activities/lib/courses/constants.ts
- src/modules/activities/lib/enrolment/constants.ts
- src/modules/activities/lib/enrolment/follow-up.ts
- src/modules/activities/lib/enrolment/legend-agreement.ts
- src/modules/activities/lib/parent/admin-client.ts
- src/modules/activities/lib/progression/constants.ts
- src/modules/activities/lib/students/constants.ts
- src/modules/activities/lib/students/history.ts
- src/modules/activities/lib/today/calendar.ts

## Problem
StatusMeta is {label, color} with no icon (status.ts:4), and Tag only renders children, so about 90 of 117 tag call sites show colour and a word with no icon. Examples: Active, Later, Next, Medical, Covered, Cancelled, Needs checking, the role reach tags on Staff and Roles, Took over and Created on Activity, Working in, Draft, Valid. Icons exist only where a module wrapper keeps a private icon map (RefundStatusTag, TrainingStatusTag, QualificationStateTag, ReviewStatusTag, RotaWarningTag, home SESSION_ICONS), which spreads one concept over six places with mismatched icons (Hourglass against Clock3, Check against CircleCheck, Refunded CheckCheck against Check). Many call sites write <Badge variant='secondary' data-tone=…> by hand or pick tones in ternaries: Docs has no metadata map and a free-string Badge with 'amber' and 'neutral' tones, plus decorative 'Your review' and 'Independent review' badges, and the training certificates page defines its own STATUS_META. TagColor offers nine tones: yellow and orange both map to warning, and pink and brown are unmapped (old palette). The gray tag has no inset line (1.08:1 on white), and Badge still ships destructive, outline, default, ghost and link variants. ACTIONS lacks the Refunds and other verbs, so raw keys such as 'Email_result' leak because the fallback only replaces '-'.

## Change (original)
1) status.ts: StatusMeta = {label, color, icon: LucideIcon}. TagColor = 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'gray' (yellow becomes orange; delete pink and brown and their shadcn.css rules at 47-50 and 150-157). 2) tag.tsx: Tag({ meta, label? }) renders <Badge variant='secondary' data-tone={meta.color}><meta.icon aria-hidden />{label ?? meta.label}</Badge>; label is only for counted text such as '3 shifts need cover'. 3) badge.tsx: keep only the secondary look; remove font-medium and the focus ring classes. poolside.css:357: the gray tone gets box-shadow inset 0 0 0 1px var(--pc-line). 4) Give every *_META map in this file list an icon, using one vocabulary: Clock3 waiting or pending; CircleCheck done, active or valid; CalendarClock expires soon; XCircle cancelled, declined or revoked; TriangleAlert warning, overdue or cover needed; HeartPulse medical; Eye to read; Pencil draft or 'changes things'; Archive archived; Ban withdrawn; MapPin working in; KeyRound administrator; Lock built-in role. Also: COMPETENCY_STATUS_META.WORKING_ON.label = 'Not achieved'; HISTORY_META tones gray (event kinds are not statuses); add PLACEMENT_META.differentSite and FOLLOW_UP_META.awaitingMove. Move the training certificates STATUS_META to CERTIFICATE_STATUS_META in lib/training/constants.ts. Add DOC_STATUS_META (draft, inReview, approved or published, archived, current, overdue, completed, cancelled, configured, setupRequired, active, inactive) in lib/docs/types.ts. Complete ACTIONS in lib/activity/constants.ts with every verb the modules write (submit, save, email_attempt, email_recipients, email_result, sign-off, record-qualification, revoke-qualification, set-pin, remove-pin, register-device, revoke-device, apply-details-change, decline-details-change, convert-to-levels, pay, return, assign, claim and others), each with a sentence-case label, colour and icon. The fallback replaces /[-_]/ with spaces and uses a gray Circle meta. 5) Migrate every <Tag color=…>, raw <Badge data-tone=…> and Docs <Badge tone=…> call site in this list to <Tag meta=… />. Per-module wrappers (refunds, training, hr and rota status.tsx) become thin aliases or are deleted. Remove the Docs decorative badges ('Your review', 'Independent review', the 'Draft' kicker above an H1). The class-enrolment 'Different site' outline badge becomes Tag(PLACEMENT_META.differentSite), and the profile-history outline note becomes caption text. The docs/ui.tsx Badge is deleted or re-exports Tag.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Keep the SYS-08 change as written (StatusMeta {label, color, icon}; six tones green/blue/orange/red/purple/gray; Tag({ meta, label? }); Badge keeps only the secondary look; gray tone gets `box-shadow: inset 0 0 0 1px var(--pc-line)` in poolside.css; every *_META map gets an icon; migrate every call site; delete pink and brown) with these corrections:

1. Weight: delete src/app/docs/integration.css:31 (`.turnfin-docs [data-slot='badge'] { font-weight: 500; }`) as well as `font-medium` in badge.tsx. Until then, poolside.css:354's 600 loses everywhere ModuleShell adds .turnfin-docs (computed today: 12px/500 on /students, /refunds, /roles).

2. Icon vocabulary: follow the V2System and ADRoles mockups:
   - CircleCheck: done, active or valid.
   - CirclePause: inactive or suspended.
   - Inbox: submitted.
   - Clock3: waiting or pending.
   - XCircle: cancelled, declined or revoked.
   - TriangleAlert: warning, overdue or cover needed.
   - ClipboardCheck: assessment.
   - Play: on now or running.
   - Pencil: draft or 'Changes things'.
   - KeyRound: administrator.
   - Lock: built in.
   - Keep the other proposed icons (CalendarClock, HeartPulse, Eye, Archive, Ban, MapPin).
   - Move refund icons into refundStatuses in src/lib/refunds/types.ts, so RefundStatusTag becomes `<Tag meta={refundStatuses[status]} />`.

3. Tag keeps an optional `className`, for layout only. It is used at activity-table.tsx:59 (lg:hidden), session-directory.tsx:52 and register-form.tsx:352 (mt-1).

4. Counts are not tags:
   - tab-strip.tsx:43 is replaced by SegmentedLinks, whose count is `.pc-seg-count`.
   - Docs admin counts ('6 active staff') become caption text.
   - The acceptance probe counts `[data-slot=badge]` with no svg; after this change no Badge should exist without a meta.

5. Also migrate:
   - calendar.tsx:188 (an untoned 'Assessment' Badge) to Tag(CALENDAR_PHASE_META.assessment).
   - calendar.tsx:100/171/197/206/233 to take their label from CALENDAR_PHASE_META. The counted '3 running now' passes `label`.
   - ui-kit/prose.tsx:32 (raw Badge with data-tone) to a meta.
   - CONTACT_OUTCOMES in src/modules/activities/lib/enrolment/follow-up.ts (yellow becomes orange, and gains an icon).

6. One spelling: change 'Not Achieved' to 'Not achieved' everywhere it appears:
   - COMPETENCY_STATUS_META and HISTORY_MARKS (history.ts:14).
   - progression/assessment.tsx:53,60.
   - progression/deck-checklist.tsx:68.
   - the profile-competencies.tsx:57 SelectItem.
   - lib/help/guides-classes.ts:113.

7. Grep acceptance: no `data-tone=` on Badge outside tag.tsx. notice.tsx's data-tone sits on Alert and stays. ui-kit/app-shell.tsx is not imported anywhere and can be deleted rather than migrated.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
Apply SYS-08 as written, with these changes:

A) badge.tsx: keep the cva, but with a single `secondary` variant, set `defaultVariants: { variant: 'secondary' }`, and keep emitting `data-variant` so poolside.css:357 still matches. Remove `font-medium` and the focus-ring/aria-invalid classes, and delete the default, destructive, outline, ghost and link variants.

B) src/app/docs/integration.css:31: delete `.turnfin-docs [data-slot='badge'] { font-weight: 500; }`. Without this, tags stay at 500 on every module.

C) Tag signature: `Tag({ meta, label, className }: { meta: StatusMeta; label?: React.ReactNode; className?: string })`. It renders `<Badge data-tone={meta.color} className={className}><meta.icon aria-hidden="true" />{label ?? meta.label}</Badge>`.
- Use `label` for any dynamic text whose meaning, tone and icon come from the meta: counts, role names (staff/page.tsx:214, account/page.tsx:41), level names (class-detail.tsx:485), holiday names (rota/absences:141), 'Completed with gaps · n/m', risk scores, and short forms such as 'Now'.
- Keep className for layout only (activity-table `lg:hidden`, `mt-1`).
- Move TagColor into lib/status.ts next to StatusMeta, so the type no longer imports from a component.

D) Icon vocabulary rule: within one map, two entries with the same colour must not share an icon.
- Keep the distinct icons that already exist where the shared vocabulary would collapse them: refunds Inbox, ScanSearch, FilePenLine, CircleHelp; rota UserX, FileQuestion, CopyX, GraduationCap; home now=Play, assessment=ClipboardCheck.
- Unify only true synonyms: Check→CircleCheck, Hourglass→Clock3, X→XCircle.
- home-parts SessionTag (icon-only on timeline blocks) reads `HOME_SESSION_META[state].icon`. Delete SESSION_ICONS.

E) Docs:
- DOC_STATUS_META must cover every status rendered in Docs: draft, changesRequested, inReview/forYourReview, submitted, approved/published, current, historical, archived, reviewDue (label 'Review due', replaces 'Upcoming'), overdue, toRead, acknowledged, cancelled, configured, setupRequired, active, inactive.
- Add RISK_BAND_TONE_META in lib/docs/types.ts, keyed by the stored band colour 'green' | 'amber' | 'orange' | 'red', mapping to {color: green | orange | orange | red} and distinct icons (CircleCheck, CircleAlert, TriangleAlert, OctagonAlert). Do NOT change the z.enum in lib/docs/content.ts:32, because stored matrices use 'amber'. Risk badges become `<Tag meta={RISK_BAND_TONE_META[band.color] ?? unclassified} label={`${score} · ${band.label}`} />`.
- Pass status keys, not meta objects, from data into client components. work.tsx Item gets `status: keyof typeof DOC_STATUS_META` instead of the status/tone strings. Lucide icons cannot cross a server→client prop boundary.
- document-list.tsx 'Review overdue' text becomes Tag(DOC_STATUS_META.overdue).
- document-editor.tsx:244: show Tag(DOC_STATUS_META.changesRequested) only when status is changes_requested, and drop the plain 'Draft' kicker.
- Non-status Docs badges stop being badges: role names (admin.tsx:211,259) and version labels (history.tsx:117) become plain text. '6 active staff' (admin.tsx:157) becomes text, or a toneless count Badge.
- Delete the Badge export from docs/ui.tsx.
- docs.css: retarget the layout and print rules from `.badge` to `[data-slot='badge']`, at 3983 (matrix-admin margin), 7186 (task-list justify-self) and 4272 (@media print). Delete the tone and shape rules: 272-304 (.badge base, .green, .amber, .orange, .red) and the 4442 `.badge` block (radius 5px, weight 500).

F) Also migrate:
- src/lib/refunds/types.ts: refundStatuses gets icons and satisfies Record<string, StatusMeta>.
- src/modules/activities/lib/enrolment/follow-up.ts: CONTACT_OUTCOMES gets icons, and 'yellow' becomes 'orange'.
- src/components/ui-kit/prose.tsx: delete the unused `Alert` export.
- Delete the module wrappers (refunds, training, hr and rota status.tsx) and change their 9 external call sites to `<Tag meta={X_META[key]} />`: src/app/hr/page.tsx, src/app/hr/people/[id]/page.tsx, src/app/hr/reviews/[id]/page.tsx, src/app/training/expiring/page.tsx, src/app/training/page.tsx, src/app/training/people/[id]/page.tsx, src/components/refunds/detail.tsx, src/components/refunds/queue.tsx, src/components/rota/roster.tsx.
- capacityTone (courses/constants.ts) returns a StatusMeta with an icon plus a label override for 'N over'.
- Set HISTORY_MARKS.WORKING_ON and the profile-competencies Select item to 'Not achieved' to match COMPETENCY_STATUS_META.
- DESIGN.md:25: describe `<Tag meta={…} />` as the only way to show a status, replacing 'Badge … with data-tone'.

G) poolside.css:357: add `box-shadow: inset 0 0 0 1px var(--pc-line)` to `[data-tone='gray']` only, so toneless count pills (TabStrip, app-shell nav) do not get an outline.

H) Acceptance changes:
- Probe status tags as `[data-slot=badge][data-tone]:not(:has(svg))`, which must return 0 on all routes in both themes. Count pills without a tone (TabStrip in class-session.tsx:218, app-shell nav badge) are out of scope.
- Add: computed font-weight 600 on /roles and /docs/admin (proves B).
- Add: /activity shows a tag in the summary cell below lg and in the column at lg and above, never both.
- Add: print preview of a risk assessment keeps the bordered badges.
- npm run lint and npm test pass alongside typecheck.

## Acceptance
A probe of icon-less tags returns 0 on all 54 audited routes in light and dark. Tags compute 12px/600 with a 14px icon. /students, /activity (no raw verbs such as 'Email_result'), /roles, /staff, /docs/library, /docs/admin, /courses/<id>, /instructor/swimmers and /training/certificates show an icon with every label. grep finds no data-tone= on Badge outside tag.tsx and no <Tag color=. typecheck passes.

## Verification notes
- KEEP: The problem is real today, and the proposed change matches both DESIGN.md and the approved mockups.

Code evidence:
- status.ts:4 defines `StatusMeta = { label, color }` with no icon.
- tag.tsx renders only its children, and `TagColor` still has nine tones. pink and brown are used nowhere and have no poolside mapping; they only get old oklch rules at shadcn.css:47-50 and 150-157. yellow and orange both map to `--pc-warning` (poolside.css:142-145).
- There are 71 `<Tag color=…>` call sites and 20 raw `data-tone=` attributes outside tag.tsx (18 on Badge, 1 on Alert in notice.tsx, 1 inside tag.tsx's sibling prose.tsx).
- Icons live in six private maps that disagree: Hourglass vs Clock3, Check vs CircleCheck.
- Docs `Badge` takes any string as a tone ('amber' becomes 'yellow'; 'neutral' matches no rule).
- The training certificates page keeps its own `STATUS_META` (certificates/page.tsx:12).
- The `ACTIONS` fallback only replaces '-' (activity/constants.ts:53).
- 'Not Achieved' is in capitals at progression/constants.ts:10.
- The gray fill `#f4f6f9` on white is 1.08:1, which I computed.

Live evidence (alex, 1280px):
- Every tag on the following routes has no icon: /students 5/5, /activity 12/12 (shows 'Email_result', 'Email_attempt', 'Submit', 'Save'), /roles 11/11, /staff 6/6, /docs/admin 25/25 (tone 'neutral'), /courses/<id> 1/1 ('Medical'), /docs/library 1/1 ('Draft').
- Only /refunds has an icon.
- Screenshots: shots/audit2/sys08/activity-1280-light.png and roles-1280-dark.png.

Direction check:
- DESIGN.md:173-174 says status colour comes "only from domain metadata maps, always with an icon".
- The approved V2System sheet has exactly six tones (green, blue, amber, red, purple, neutral). Every tag carries a 14px icon at 12px/600, and the neutral tag has `box-shadow: inset 0 0 0 1px var(--line)`.
- ADRoles uses the same icons the change proposes: Pencil for 'Changes things', KeyRound for the administrator tag, Lock for 'Built in'. ADActivity puts icons on 'Moved' and 'Created'.

Gaps the change misses, which would otherwise make its acceptance fail:
1. Tags compute 12px/**500** today on every route, not 600. The cause is src/app/docs/integration.css:31 (`.turnfin-docs [data-slot='badge'] { font-weight: 500; }`), which loads after poolside.css:354 with the same specificity. Removing `font-medium` from badge.tsx alone will not fix it.
2. Some Badges show counts, not statuses (tab-strip.tsx:43, and Docs admin '6 active staff'). The 'no icon-less tags' probe would flag them.
3. calendar.tsx:188 has a Badge 'Assessment' with no tone or icon, and calendar.tsx:100/171/197/206/233 hard-code 'Now', 'Next', 'Running now' and 'Cancelled' instead of taking the meta label.
4. 'Not Achieved' also appears in history.ts:14, progression/assessment.tsx:53,60, deck-checklist.tsx:68, profile-competencies.tsx:57 (a SelectItem) and help/guides-classes.ts:113.
5. Three call sites pass `className` to Tag (activity-table.tsx:59, session-directory.tsx:52, register-form.tsx:352).
6. The file list leaves out src/lib/refunds/types.ts (refundStatuses), src/modules/activities/lib/enrolment/follow-up.ts (CONTACT_OUTCOMES uses yellow) and ui-kit/prose.tsx:32 (a raw Badge with data-tone).
7. The mockup uses CirclePause for Inactive, Inbox for Submitted and ClipboardCheck for Assessment. The proposed vocabulary would push Submitted onto Clock3, against the mockup.

app-shell.tsx:92 has a Badge too, but nothing imports that file, so it needs no migration.
- KEEP: The direction holds up, but six parts of the change as written would break things or fail its own acceptance test. Each one can be fixed by amending the change. Evidence:

(1) The weight goes wrong. On the live sandbox, tags compute font-weight 500 on /roles, /activity, / and /docs/admin. The rule doing it is src/app/docs/integration.css:31 `.turnfin-docs [data-slot='badge'] { font-weight: 500 }`. It loads app-wide because ModuleShell puts .turnfin-docs on every module, and it wins over poolside.css:354 (600), which comes earlier in the cascade. A CSS-rule probe on /roles showed this rule winning, and the badge has a .turnfin-docs ancestor. Removing font-medium from badge.tsx alone will not give 12px/600.

(2) Removing the variant prop breaks other code. poolside.css:357 (the gray tone) selects `[data-variant='secondary']`, so dropping the attribute takes away the neutral background. tab-strip.tsx:43 and app-shell.tsx:92 pass `variant="secondary"` and are not in the file list, so typecheck would fail.

(3) Tag({meta, label?}) without className breaks layout. activity-table.tsx:59 relies on `className="lg:hidden"`; without it the tag shows twice at lg and above. session-directory.tsx:52 and register-form.tsx:352 pass mt-1.

(4) "label is only for counted text" would throw away real data. Many tags show text that is not the meta label: staff/page.tsx:214 shows the role name in the reach tone, account/page.tsx:41 shows roleName, class-detail.tsx:485 shows the level name, rota/absences/page.tsx:141 shows the holiday name, progression/assessment.tsx:354 shows 'Completed with gaps · 3/5', calendar.tsx:171 uses the short form 'Now', and the Docs risk badges show '12 · High'.

(5) Docs regressions.
- Docs Badge adds class `badge`. docs.css relies on it for the print rule (4272, inside @media print at 4166), matrix-admin spacing (3983, ≤720px) and task-list alignment (7186, ≤600px).
- Risk-band tones are stored data: content.ts:32 z.enum(['green','amber','orange','red']). DOC_STATUS_META does not cover them.
- DOC_STATUS_META is also missing statuses that are actually rendered: 'Changes requested' and 'Upcoming' (work.tsx:120,135), 'To read' and 'Acknowledged' (reports.tsx:289), 'Historical version' and 'Review submission' (reader.tsx:146), and 'Submitted' (history.tsx:164).
- document-list.tsx:53 shows 'Review overdue' as red text with no icon.
- Removing the editor kicker (document-editor.tsx:244) also removes the 'Changes requested' status.

(6) Coverage and shared icons.
- Typecheck and grep coverage misses: src/lib/refunds/types.ts and src/modules/activities/lib/enrolment/follow-up.ts (CONTACT_OUTCOMES, 'yellow') type their maps with an inline TagColor and are not listed. src/components/ui-kit/prose.tsx:32 is an unused Alert that still renders a raw data-tone='yellow' Badge, so the acceptance grep would fail on it.
- The wrappers (RefundStatusTag and the rest) are used in 9 files that are not listed. Deleting the wrappers without migrating those files breaks the build.
- Home SessionTag renders icon-only on the timeline (home-parts.tsx:201). If the vocabulary gives 'done' and 'now' the same CircleCheck, colour becomes the only signal on those blocks.
- The acceptance probe would count the TabStrip count pills on the started-class route (class-session.tsx:218). Those have no tone and no icon by design.

What I checked and found safe:
- No client component receives a meta object as a prop today.
- Meta .color is used only by Tag and Badge.
- No Badge uses asChild or is focusable.
- Lint boundaries are fine. lib/status.ts and lib/activity/constants.ts are Core; DOC and CERTIFICATE metas stay inside their own Work modules.
- No test checks meta colours or labels.
- Icons compute 14px today, because poolside.css:356 beats the Tailwind size-3.
- The pink and brown tokens and rules are used nowhere else, and the shadcn.css line numbers 47-50 and 150-157 are correct.