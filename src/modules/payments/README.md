# Payments

**Purpose:** follows each failed direct debit until reception has recovered it.

Its levels are in [docs/apps.md](../../../docs/apps.md); the decision to add it is D21 in [docs/decisions.md](../../../docs/decisions.md). Each month the bank sends a failure sheet (`.xlsx`, a tab per site: Club Name, Contact Name, Amount, Reference, Return Code, Return Description, Membership Number, Message). Legend stays the billing system: Turnfin never takes money or changes a mandate. It keeps who was contacted, how, and how each failure ended.

## Features
- `upload`: the upload page (`/payments/upload`, Manage only). Choose the file; the month is read from its name ("Failed Lessons 09" is September) and can be changed. The count per site comes first and saves nothing; **Add** reads the file again and adds each debit not already in for that month, at the sites where the person holds `payments.manage`. Every row is a debit: a debit is its reference, amount and copy within the month (the same reference can fail twice for different amounts), so uploading the same sheet again adds nothing. The bank's "LW Douglas" is the Gus Healy Swimming Pool (`CLUB_ALIASES` in `shared/rules.ts`). The same sheet uploaded again is refused under any month, by a hash of its debits kept on `PaymentImport.fingerprint`. A club name that matches no site is named and its debits left out; the rest are added, and once the site exists the same sheet uploaded again adds only those. A browser's copy number in the name ("Failed Lessons 09 (1)") is not read as the month. Only debits whose member number belongs to a swimmer are tracked (owner, 2 November 2026): member numbers are matched to the swim school's swimmers (capitals, no spaces) through the member directory, and every other row (gym memberships, unknown numbers) is counted on the preview and left out.
- `failures`: the lists (`/payments`: to contact, contacted, closed; by site, month, or a search for name, member number or reference) and one failure's page (`/payments/[id]`). On that page reception logs a contact (phone, text, email or at the desk; no answer, left a message or spoke to them) and closes it: **Paid at the desk**, **New mandate set up** or **Place cancelled** (with a reason). Manage can open a closed one again. The page shows the swimmer's contact from the swim school's records when the member number matched, what the bank's return code means, and the member's other failed payments. This feature also gives the Home items and the swimmer profile's notices.
- `workspace`: the frame, its one page list (`pages.ts`) and the starter page `/payments/overview`.

`shared/` holds what two or more features use: statuses, contact methods, return-code advice and words (`types.ts`), the pure rules, including reading the sheet (`rules.ts`, tested in `rules.test.ts`), the access check (`access.ts`) and the locked, audited step (`service.ts`).

## Front door (index.ts)
- `PAYMENT_STATUS_META`: each status's label, tone and icon. Used by Core's status-metadata test.

Nothing else in Turnfin calls into Payments. Routes use the feature entries.

## Data owned
Declared in `prisma/schema/payments.prisma`, migration `20261211090000_payments` (new tables only):
- `PaymentImport` (`payment_imports`): one uploaded sheet: month, file name, rows, how many were new, and who uploaded it.
- `PaymentFailure` (`payment_failures`): one failed debit: site, month, reference, member number and the matched swimmer's id, name, amount, the bank's return code and reason, status, contacts and how it ended.
- `PaymentFailureEvent` (`payment_failure_events`): its history, one row per step, with the contact's method and result and the note.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home and starter-page items (`registerHomeCard`): "Failed payments to contact" and "waiting on the member" for Use; "Upload the failure sheet" for Manage.
- Member notices (`registerMemberNotices`): "Payment failed" on the swimmer profile of anyone with a failure still open, linking here.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `payments.read`: see the failed payments at their sites.
- `payments.follow`: log contacts and record how each ended at their sites. Includes reading.
- `payments.manage`: upload the failure sheet and open closed payments again at their sites. Includes following up.

## Depends on
- Platform: the policy engine (`sitesFor`, `mayFor`), audit, the workbook reader (`src/lib/xlsx.ts`), the database client, home cards, member notices and the member directory (`src/modules/contributions`).
- Core reads (never Core tables): sites through `src/lib/directory.ts`.
- Other apps: the swim school, only through the member directory plug (`byNumbers` to match member numbers, `byIds` for contact details). With the swim school off, nothing can be uploaded.
