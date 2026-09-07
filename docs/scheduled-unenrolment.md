# Scheduled unenrolment

On an active swimmer's place, choose **Schedule unenrolment**, select a future
**Unenrol on** date and save. The swimmer stays active and occupies a place until
that date. The date is shown beside the actions; it can be changed or cancelled.
Immediate unenrolment and transfers clear the old place's schedule.

There is no cron job or external scheduler. After authentication, and before
returning the session to a page, data query or action, the app applies due
schedules once per request. Dates use Europe/Dublin. If the app was unused on
the date, the next request catches up and records the chosen date as `endedOn`.
An already-open browser page needs to refresh to see the updated list.

The same course locks protect scheduling, cancellation, transfers and automatic
withdrawal. Every change and its audit entry commit together. Repeated requests
cannot withdraw or audit the same place twice. Attendance and competency history
are preserved.

## Deployment

Apply the additive migration with `npm run db:deploy` before deploying the new
application code. It adds a nullable `scheduledEndOn` date and an index to
Enrolment. No data backfill, seed, cron configuration or new secret is required.
