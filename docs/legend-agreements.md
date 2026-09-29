# Legend agreement follow-up

Legend holds the billing agreements. Swimly records staff confirmation; it does
not read or change Legend. Tracking belongs to each enrolment, not the swimmer.

Before saving a new active place, staff choose **Updated in Legend** or
**Still to do**. There is no preselected answer. A pending agreement does not
block enrolment. Existing active enrolments start as **Needs checking** because
no confirmation has been recorded. Nothing is assumed complete during rollout.

**Legend agreements** lists outstanding active places at the working site,
oldest first. Search by swimmer name or member number. After checking/updating
Legend, choose **Confirm updated** and confirm the identified swimmer and class.
The place moves to **Confirmed**, with the confirming staff name and time.
Each confirmation and its audit entry are saved in the same transaction.

Moves, including moves between sites, carry the agreement status and its
attribution to the destination place. They do not ask the question again. A
second new enrolment has its own check even if the swimmer has another confirmed
place. Ended places and waitlists are excluded. Enrolling from a waitlist asks
for a fresh answer; an answer recorded while joining a full class is not saved
as confirmation. Scheduled endings remain listed until they take effect.

Access uses the `legend-agreements` screen grant. Confirming requires the named
`enrolment.manage` permission. Administrators automatically receive the screen;
other roles must be granted it. This page is not part of Instructor.

The additive migration `20260917150000_legend_agreements` creates the status and
attribution columns with `NEEDS_CHECK` as the default for pre-existing records.
Deploy the migration before the application that reads these columns. Tests use
an isolated PostgreSQL-compatible database and fictional browser fixtures.

## Matching a list from Legend (29 September 2026)

**Match a Legend list** on the Legend agreements page (needs `enrolment.manage`) takes the
Member Agreements export filtered to the Aquatics agreement (`.xlsx`, sheet "Data"). Checking
it writes nothing and shows, for the working site: places **to confirm** (member on the list,
agreement live, its price name fits the place's programme or level, e.g. "Lifesaving" and
"RLSS Lifesaving"), places where **Legend names another programme** and places whose
**agreement ended** in Legend (both left for a person), and counts of members already
confirmed, at the other site, or with no swim place. **Confirm** marks each place to confirm as
updated in Legend under the person's name with its own audit entry, exactly as confirming one
by one; the file is read again and only places still active and outstanding change. Member
numbers are matched without spaces and in capitals. The rules are in
`src/modules/activities/lib/enrolment/legend-list.ts` (tested).

For every site at once without signing in, an operator runs the same rules against production
(`docs/database-operations.md`): `npm run prod -- scripts/legend-confirm.ts <list.xlsx>` (dry run,
counts only), then `--confirm --as <staff email>` to record them under that person.
