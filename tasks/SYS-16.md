# SYS-16 — Copy foundations: shared date, range and plural helpers, one glossary
Severity: medium | Scope: system

## Files (expected)
- DESIGN.md
- apps/me/src/components/ui.tsx
- apps/me/src/lib/api.ts
- src/app/(activities)/swim-school/page.tsx
- src/app/(core)/clubs/page.tsx
- src/app/(core)/core/page.tsx
- src/app/(instructor)/instructor/page.tsx
- src/app/api/docs/files/[id]/route.ts
- src/app/api/docs/reports/route.ts
- src/app/docs/actions.ts
- src/app/hr/layout.tsx
- src/app/hr/page.tsx
- src/app/refunds/error.tsx
- src/app/rota/overview/page.tsx
- src/components/clubs/club-actions.tsx
- src/components/clubs/club-switcher.tsx
- src/components/core/shell.tsx
- src/components/docs/admin.tsx
- src/components/docs/reader.tsx
- src/components/people/people-actions.tsx
- src/components/rota/bookings.tsx
- src/components/training/manage-actions.tsx
- src/components/workspace/account-menu.tsx
- src/lib/docs/home.ts
- src/lib/format.test.ts
- src/lib/format.ts
- src/lib/help/guides-management.ts
- src/lib/people/home.ts
- src/lib/rota/file.ts
- src/lib/staff-api/errors.ts
- src/lib/staff-api/http.ts
- src/lib/staff-api/security.ts
- src/lib/staff/permissions.ts
- src/lib/staff/restricted.ts
- src/lib/staff/screens.ts
- src/modules/activities/components/duty/duty-view.tsx
- src/modules/activities/components/today/calendar.tsx
- src/modules/activities/contributions.ts
- src/modules/activities/lib/cancellations/actions.ts
- src/modules/activities/lib/courses/constants.ts
- src/modules/activities/lib/enrolment/class-picker.test.ts
- src/modules/activities/lib/parent/errors.ts
- src/modules/activities/lib/parent/http.ts
- src/modules/activities/lib/parent/security.ts
- src/modules/registry.ts

## Problem
The same day appears in five formats ('Sunday, 4 October', 'Sunday, 4 Oct 2026', '4 Oct 2026', '28 Sept', 'Sun 4 Oct') from more than 12 inline Intl formatters in two locales, and en-GB prints 'Sept' next to 'Oct'. Ranges use 'to', '–' and ' – '. Counts ignore singular ('1 swimmers', '1 classes', '1 Classes today'), and plural() lives only in Activities contributions. One concept has several names: club, site, working area; HR versus 'HR and performance' (whose label also overflows the bottom bar); waitlist versus waiting list; 'No limit' versus uncapped; 'Add' versus 'New' versus 'Add a'; '&' versus 'and'. Permission descriptions expose internals ('requires the Instructor screen grant', 'Turnfin Work', 'club'). Error voice mixes 'Could not … Try again', 'Please try again' and 'Unable to …'. Registry descriptions, used as overview subtitles, end in full stops and say 'clubs' and 'set-up'.

## Change (original)
1) In src/lib/format.ts add formatDay ('Sunday 4 October', with the year only when it is not the current year), formatShortDay ('Sun 4 Oct'), formatTimeRange ('16:00 to 16:30'), formatDateRange ('28 Sep to 4 Oct') and plural(n, one, many), moved from modules/activities/contributions.ts (update its import). Use one locale (en-GB) and map 'Sept' to 'Sep' in DATE_ONLY and DATE_TIME through formatToParts. 2) registry.ts: the hr name becomes 'HR' (logName unchanged); 'waitlist'; descriptions read as subtitles with no trailing full stop, using 'sites' and 'setup'. screens.ts: labels 'Sites', 'HR', 'Pool deck', 'Cancelled classes'. permissions.ts: rewrite descriptions in plain words, with no 'screen', 'grant', 'Turnfin Work', 'club' or 'Instructor workspace'; 'waitlist'. 3) Error voice 'Could not <do x>. Try again.' in staff-api/http.ts:69, docs/actions.ts:25, api/docs/reports/route.ts:36 and api/docs/files/[id]/route.ts:17. lib/rota/file.ts:42-44 strips a trailing full stop before joining with ' · '. 4) DESIGN.md gets a short 'Copy' section: site (never club or working area); Pool deck; HR; waitlist; 'No limit'; 'Add <noun>' for create buttons (domain verbs kept: Log refund request, Report absence, Book assessment, Find swimmer); 'and' not '&'; commas or colons, not em dashes; ranges with 'to' through the helpers; counts through plural(); 'Could not … Try again.'; empty states 'No <things> yet' / 'No <things> match' with no full stop in titles; no ellipsis in placeholders; neutral examples (Riverside, Sam Murphy); no customer or site names or site counts in code.

## Amendment 1 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) src/lib/format.ts:
- Add formatDay(date): 'Sunday 4 October', with no comma and the year only when it is not the current year in SCHOOL_TIMEZONE.
- Add formatShortDay ('Sun 4 Oct'), formatTimeRange ('16:00 to 16:30'), formatDateRange ('28 Sep to 4 Oct') and plural(n, one, many = one + 's').
- Use en-GB only. Map the month part 'Sept' to 'Sep' through formatToParts in DATE_TIME, DATE_ONLY and the new helpers.
- Delete the three local copies (modules/activities/contributions.ts:15 plural, contributions.ts:108 plainCount, lib/rota/file.ts:14 plural) and import plural from @/lib/format.
- Use plural at (instructor)/instructor/page.tsx:102 and :225, modules/activities/components/duty/duty-view.tsx:59, modules/activities/lib/cancellations/actions.ts:72 (also replace the em dash with a colon or comma) and modules/activities/components/today/calendar.tsx:230.
- Replace the inline Intl date formatters (14 en-GB, 8 en-IE) with the helpers. The Instructor header becomes formatDay.

2) Names. In each case change every visible copy so the concept has one name:
- HR. registry.ts:223 name 'HR' (logName unchanged). screens.ts:130 label 'HR'. Permission group 'HR' at permissions.ts:183, 190, 197 and 232. H1 'HR' at app/hr/layout.tsx:32 and app/hr/page.tsx:21. 'HR records' at lib/staff/restricted.ts:4 and components/people/people-actions.tsx:127 and :136.
- Sites. Label 'Sites' at screens.ts:116 and components/core/shell.tsx:13. In (core)/clubs/page.tsx: title and metadata 'Sites', count through plural(n,'site','sites'), empty state 'No sites yet', and lines 50-51 changed to 'the site picker in the top bar changes that' (drop 'Activities sidebar'). components/clubs/club-actions.tsx:42-47 becomes 'Add site'. club-switcher.tsx:25 aria-label becomes 'Site: <name>. Switch site'. permissions.ts:86-88 becomes 'Manage sites' with plain wording.
- waitlist. Use 'waitlist' at permissions.ts:24 and registry.ts:111.
- Overview subtitles. registry.ts descriptions become the mockup subtitles with no trailing full stop:
  - Swim school: 'Swimmers, classes and assessments at the desk, and the swim school's set-up' (keep 'set-up' as V2Overview has it)
  - Admin: 'People, roles and sites, and the activity log, shared by every module'
  - Rota: 'Shifts at the sites you cover, with warnings for expired qualifications and people who are off'
  Then swim-school/page.tsx:23, (core)/core/page.tsx:26 and rota/overview/page.tsx:16 pass mod.description (and mod.name for Rota) instead of literals, so each subtitle has one source.
- Permission descriptions. Rewrite in plain words, with no 'screen', 'grant', 'Turnfin Work', 'club', 'Instructor workspace' or em dashes. Write 'Swim school assessment' in sentence case.

3) Error voice 'Could not <do x>. Try again.' Apply it at lib/staff-api/http.ts:69, app/docs/actions.ts:25, app/api/docs/reports/route.ts:36, app/api/docs/files/[id]/route.ts:17, app/refunds/error.tsx:8, components/docs/admin.tsx:101, components/docs/reader.tsx:113, components/workspace/account-menu.tsx:24 and modules/activities/lib/parent/http.ts:66. Rate limits and unavailable services read '… Try again later.' at lib/staff-api/errors.ts:8, lib/staff-api/security.ts:23, modules/activities/lib/parent/errors.ts:6 and parent/security.ts:22. In lib/rota/file.ts:42-44, strip a trailing full stop from a note before joining with ' · '.

4) DESIGN.md: add the short 'Copy' section as specified, and add that date and time formats come only from the lib/format.ts helpers.

Acceptance:
- formatDay(2026-10-04) = 'Sunday 4 October'
- formatDateRange = '28 Sep to 4 Oct'
- plural(1,'swimmer','swimmers') = '1 swimmer'
- grep finds no 'Please try again', 'Unable to' or 'Sept' output in src
- Rail, bottom bar (no overlap at 375px), HR H1 and the permission group on /account and the role editor all read 'HR'
- Admin nav, Sites H1 and the help link all read 'Sites'
- Overview subtitles have no full stop
- typecheck passes

Say in the recap that 'HR' and 'Sites' depart from the approved mockups' 'HR and performance' and 'Clubs' copy.

## Amendment 2 from verification (APPLY THESE; where they conflict with the original change the amendment wins; where two amendments conflict, prefer the one that best fits DESIGN.md v2 and the mockups)
1) src/lib/format.ts (one locale, en-GB; nothing here may import Activities):
- Add one month-part mapper ('Sept' to 'Sep') applied through formatToParts to the month part only, keeping every literal (including the ', ' before the time in DATE_TIME). Use it in DATE_ONLY, DATE_TIME, formatShortDay and formatDateRange. Never call Intl formatRange, which inserts ' – '.
- formatDay(value: Date | 'YYYY-MM-DD', now = new Date()): read date-only values in UTC, as formatDate does. Show the year only when it differs from the year of today(now) (school timezone). Build the string from parts with no comma, e.g. 'Sunday 4 October'.
- formatShortDay(value) gives 'Sun 4 Oct'.
- formatDateRange(from, to, now = new Date()) gives '28 Sep to 4 Oct'. Put the year on both ends when the range crosses a year or is not the current year.
- Move formatTime (minutes to 'HH:MM') from src/modules/activities/lib/courses/constants.ts into lib/format, and re-export it from courses/constants so its 40+ call sites keep working.
- Keep ONE formatTimeRange, in lib/format, giving '16:30 to 17:15'. Make courses/constants.ts formatTimeRange (line 46) and formatSlot delegate to it, or delete the old one and update its 3 importers. Change src/modules/activities/lib/enrolment/class-picker.test.ts:52 to expect '16:30 to 17:15'.
- plural(n, one, many = `${one}s`), using one en-GB NumberFormat. Delete the local helpers in src/modules/activities/contributions.ts (plural at line 15 and plainCount, about line 105) and in src/lib/rota/file.ts:14, and import the shared one. Also replace the inline `${formatTime(a)} to ${formatTime(b)}` in contributions.ts with formatTimeRange.
- Add cases to src/lib/format.test.ts that pass an explicit now, e.g. formatDay('2026-10-04', new Date('2026-10-04T12:00:00Z')) === 'Sunday 4 October'.
- If code under test starts using the new helpers, tests that mock @/lib/format with partial objects (cancellations/actions.test.ts:35, attendance/actions/cover.test.ts:64, assessments/data/instructor.test.ts:10) must spread the real module.

2) Names:
- registry.ts: the hr module's name becomes 'HR'. id and logName stay. describeLevels will write 'HR: …' in new audit rows, which is fine.
- Use 'waitlist' in the swim-school level help.
- Rewrite every registry description as a subtitle: no trailing full stop, 'sites', 'setup'. Then make src/app/(activities)/swim-school/page.tsx:23, src/app/(core)/core/page.tsx:26 and src/app/rota/overview/page.tsx:16 pass mod.description, and delete their inline strings, so one source remains.
- Change the h1 in src/app/hr/layout.tsx:32 and src/app/hr/page.tsx:21 to 'HR'. Change 'HR and performance' to 'HR records' in src/lib/staff/restricted.ts:4 and src/components/people/people-actions.tsx:127,136. If the permission group is renamed to 'HR', update PERMISSION_GROUP_ORDER too.
- screens.ts: change labels only (clubs to 'Sites', hr to 'HR', instructor to 'Pool deck'). The keys 'clubs', 'instructor' and 'hr' stay, and 'Cancelled classes' is already correct.
- Rename every other user-facing Clubs label in the same change: src/components/core/shell.tsx:13, src/app/(core)/clubs/page.tsx:26,43, src/app/(core)/core/page.tsx:21, src/lib/people/home.ts:21, src/components/clubs/club-actions.tsx:42,45 ('Add a site') and src/lib/help/guides-management.ts:111-118. The route /clubs, permission key clubs.manage and Prisma Club/clubId stay.
- permissions.ts: change label and description text only, never keys, since keys are stored on roles. Descriptions appear on src/app/(core)/account/page.tsx. Keep the staff.manage and roles.manage labels readable when lowercased (src/lib/staff/keyholders.ts:74).

3) Error voice 'Could not <do x>. Try again.':
- The four listed lines: src/lib/staff-api/http.ts:69 and src/modules/activities/lib/parent/http.ts:66 become 'Could not complete that. Try again.'. src/app/docs/actions.ts:25 is the catch-all for every Docs action, so it becomes 'Could not apply your changes. Try again.'. The api/docs/reports route (line 36) and files route (line 17) become 'Could not export the report. Try again.' and 'Could not load the file. Try again.'.
- The nine other hits the acceptance grep finds: src/app/refunds/error.tsx:8, src/components/docs/admin.tsx:101, src/components/docs/reader.tsx:113, src/components/workspace/account-menu.tsx:24, src/lib/staff-api/errors.ts:8, src/lib/staff-api/security.ts:23, src/modules/activities/lib/parent/errors.ts:6 and src/modules/activities/lib/parent/security.ts:22. Rate limits read 'Too many attempts. Wait a few minutes and try again.'
- Optionally do the same in apps/me/src/components/ui.tsx:30 and apps/me/src/lib/api.ts:45.
- src/lib/rota/file.ts:42-44: strip a trailing full stop from the free-text parts (a.note, a.returnNote) before joining with ' · '.

4) DESIGN.md 'Copy' section, for user-facing copy only (code and data names such as Club/clubId stay):
- site; Pool deck; HR; waitlist; 'No limit'.
- Create buttons read 'Add a <noun>'. This matches the V2System mockup, about 20 live buttons and src/lib/home.test.ts:84. So change only the 'New X' create buttons: src/components/rota/bookings.tsx:37-38 ('Add a booking'), src/components/training/manage-actions.tsx:100-101 ('Add a course') and src/lib/docs/home.ts:12 ('Add a document'). The 'New class' at enrolment-actions.tsx:474 is a field label; keep it.
- Domain verbs as they exist today: Find a swimmer, Book an assessment, Log refund request, Report absence.
- Also: 'and' not '&'; no em dashes; ranges through formatDateRange/formatTimeRange; counts through plural(); 'Could not … Try again.'; empty states 'No <things> yet' / 'No <things> match' with no full stop; no ellipsis in placeholders; neutral examples (Riverside, Sam Murphy); no customer or site names in code.

Verify with npm run typecheck, npm run lint and npm test.

## Acceptance
Quick node checks: formatDay(2026-10-04) = 'Sunday 4 October'; formatDateRange gives '28 Sep to 4 Oct'; plural(1,'swimmer','swimmers') = '1 swimmer'. grep finds no 'Please try again' or 'Unable to' in src. The rail, bottom bar and role editor show 'HR'. typecheck passes.

## Verification notes
- KEEP: The problem is real, and the date and plural helpers match the approved mockups exactly. Five parts of the change as written are wrong or incomplete, so it needs amending.

Confirmed today:
(1) Dates. There are 24 inline Intl formatters (14 en-GB, 8 en-IE, plus 1 en-CA for ISO). Node 24 prints '28 Sept 2026' next to '4 Oct 2026' for both locales. The Instructor page header reads 'Sunday, 4 Oct 2026' (shots/audit2/sys16/instructor-375-light.png).
(2) The mockups confirm the target formats. A tally over every non-menu mockup at :4300 found 'Saturday 3 October' (no comma), 'Sat 10 Oct', '11:00 to 12:00' (more than 100 uses), '28 Sep to 4 Oct', and never 'Sept' or an en dash. formatDay, formatShortDay, formatTimeRange and formatDateRange as proposed are the mockups' own formats.
(3) Plurals. The Instructor row shows 'Learner pool · 1 swimmers' (instructor/page.tsx:102, and :225 for 'classes'). The same bug is in duty-view.tsx:59, cancellations/actions.ts:72 (which also has an em dash) and calendar.tsx:230. plural() exists three times, not once: modules/activities/contributions.ts:15, plainCount at contributions.ts:108, and lib/rota/file.ts:14.
(4) Bottom bar. At 375px the 'HR and performance' label spills over 'Pool deck' and 'More' (shots/audit2/sys16/hr375-bar.png). That breaks the v2 rule against clipped labels.
(5) Permission descriptions. /account shows 'also requires the Instructor screen grant', 'Also needs the Docs screen', 'waiting lists', 'Which club a person is working in', em dashes and 'Swim School Assessment' (acc-a.png, acc-b.png).
(6) Error voice. The four listed lines are confirmed.

Where the change is wrong or incomplete:
(a) Registry descriptions are not rendered anywhere. No UI reads module.description. The overview subtitles are literals in swim-school/page.tsx:23 ('set-up.'), (core)/core/page.tsx:26 ('clubs', with a full stop) and rota/overview/page.tsx:16 (full stop). Editing registry.ts alone changes nothing on screen. The mockups (V2Overview, ADOverview, TROverview, ROOverview) all drop the full stop. V2Overview keeps 'set-up', so 'setup' would move away from the approved copy.
(b) 'Sites': screens.ts 'Clubs' only feeds the help link 'Open Clubs'. The Admin nav label comes from components/core/shell.tsx:13. The page H1, empty state and count are in (core)/clubs/page.tsx:43, :49 and :57, and the button is in components/clubs/club-actions.tsx:42-47. Changing screens.ts alone would create a new mismatch. clubs/page.tsx:50-51 also mentions a stale 'Activities sidebar'; the mockup says the site picker is in the top bar. club-switcher.tsx:25 says 'Working area'. Note that the approved ADClubs mockup itself uses H1 'Clubs' with 'site' in its body copy.
(c) 'HR': the H1 'HR and performance' is hard-coded in hr/layout.tsx:32 and hr/page.tsx:21. The role-editor and account group headings come from permissions.ts:183, 190, 197 and 232, not from screens.ts. Also lib/staff/restricted.ts:4 and components/people/people-actions.tsx:127 and :136. Without these, the acceptance check 'role editor shows HR' fails and two names remain. Every approved mockup uses 'HR and performance' (65 times, including the HRPeople H1). The rename is still the right call: a phone bar slot cannot hold the long name, and logName is already 'HR'. The deviation from the mockup copy should be stated in the recap.
(d) The acceptance check 'no Please try again or Unable to in src' fails with only the four listed files. Nine more need changing: app/refunds/error.tsx:8, components/docs/admin.tsx:101, components/docs/reader.tsx:113, components/workspace/account-menu.tsx:24, lib/staff-api/errors.ts:8, lib/staff-api/security.ts:23, modules/activities/lib/parent/errors.ts:6, parent/http.ts:66 and parent/security.ts:22.
(e) '1 Classes today' is not a plural bug. It is a figure plus a label in a tile, the same pattern as the V2Overview mockup's tiles ('1' over 'Assessments today'). Drop it from the problem. screens.ts already says 'Cancelled classes'.
- KEEP: The task is real. I checked the code (read-only): plural() exists only in src/modules/activities/contributions.ts:15, and that same file has a second helper, plainCount. src/lib/rota/file.ts:14 has a third local plural. On this machine (Node 24, ICU 78), en-GB prints '28 Sept 2026', 'Sun 27 Sept' and a formatRange of '28 Sept – 4 Oct'. Nothing in the change has to be refuted, but six things would regress or miss if it is applied as written.

(1) Two functions named formatTimeRange. One already exists at src/modules/activities/lib/courses/constants.ts:46 and outputs '16:30–17:15'. src/modules/activities/lib/enrolment/class-picker.test.ts:52 asserts that output, and class-picker.ts:27 uses it in its search text. Core may not import Activities (lint rule notActivities), so the new Core helper cannot just reuse formatTime from Activities.

(2) The Sept to Sep mapping is scoped too narrowly. Applied only to DATE_ONLY and DATE_TIME, the new formatShortDay and formatDateRange would still print 'Sept'. Also, 22 'use client' components import @/lib/format, so all output must be built from formatToParts to stay the same on server and browser.

(3) ModuleManifest.description is not shown anywhere in the app. The overview subtitles are inline strings in src/app/(activities)/swim-school/page.tsx:23 ("set-up."), src/app/(core)/core/page.tsx:26 ("clubs") and src/app/rota/overview/page.tsx:16. Editing registry.ts alone changes nothing on screen.

(4) Renaming the screens.ts 'clubs' label to 'Sites' only reaches help's "Open <label>" button (src/lib/help/access.ts:23). The core nav (src/components/core/shell.tsx:13), the page (src/app/(core)/clubs/page.tsx:26,43), the overview link (core/page.tsx:21), src/lib/people/home.ts:21, club-actions.tsx:42,45 and the help guides all still say Clubs. The result is a new mismatch: "Open Sites" lands on a page called "Clubs". 'Cancelled classes' is already the label, so that part is a no-op. For HR, the rail, bottom bar and role editor take registry name, but src/app/hr/layout.tsx:32 and src/app/hr/page.tsx:21 hard-code the h1 "HR and performance".

(5) The acceptance grep ("no 'Please try again' or 'Unable to' in src") fails if only the 4 listed lines change. Nine more hits exist: src/app/refunds/error.tsx:8, src/components/docs/admin.tsx:101, src/components/docs/reader.tsx:113, src/components/workspace/account-menu.tsx:24, src/lib/staff-api/errors.ts:8, src/lib/staff-api/security.ts:23, and src/modules/activities/lib/parent/errors.ts:6, http.ts:66 and security.ts:22. docs/actions.ts:25 sits in run(), which every Docs action goes through, so its message must stay generic. No test asserts any of these strings.

(6) The DESIGN.md rule "'Add <noun>'" contradicts the owner-approved V2System mockup ('Add a swimmer') and about 20 live buttons ('Add a class', 'Add a level', 'Add a person', 'Add a role' and so on). src/lib/home.test.ts:84 asserts 'Add a swimmer' and 'Find a swimmer'. The listed domain verbs 'Find swimmer' and 'Book assessment' don't match the live 'Find a swimmer' and 'Book an assessment'. Applying the rule as written breaks that test and renames 20+ labels.

What is safe: lib/format is Core and has no server-only import, so Activities (contributions.ts) and Rota (rota/file.ts) can import plural from it. src/lib/home.test.ts:66 spreads the real format module, so a new plural export is picked up. Permission keys, screen keys and the module id/logName are untouched, and audit-modules.test.ts reads logName. PermissionGroup is a union type, so if the 'HR and performance' group is renamed, typecheck forces PERMISSION_GROUP_ORDER to change with it. No test asserts the permission descriptions, the error strings, 'Clubs' or 'HR and performance' as a module name. A formatDay test that relies on the real clock breaks on 1 Jan 2027 unless it passes a fixed now.