# Scheduled unenrolment

On an active swimmer's place, choose **Unenrol**, then **After a lesson**, pick
their **Last lesson** from the class's lessons (today's included, about half a
year ahead) and save. The swimmer stays active, on registers and lesson lists
and occupying a place, up to and including that lesson; the place ends the day
after it. Rosters and the profile show "Last lesson <date>"; it can be changed
or cancelled. Immediate unenrolment and transfers clear the old place's
schedule. A cancelled lesson can still be the last one, so the swimmer keeps
the credit for it.

`scheduledEndOn` stores the first day without the place (the day after the
last lesson), so every "is this place live on this day?" check, written as
`scheduledEndOn > day`, keeps the swimmer for their last lesson. The action
takes the lesson date and refuses a day the class does not run
(`src/modules/activities/shared/enrolment/last-lesson.ts`). Schedules saved
before 1.8.3 with a bare date keep that date and read back as the class's
lesson before it.

There is no cron job or external scheduler. After authentication, and before
returning the session to a page, data query or action, the app applies due
schedules once per request. Dates use Europe/Dublin. If the app was unused on
the date, the next request catches up and records the stored end (the day after the last lesson) as `endedOn`.
An already-open browser page needs to refresh to see the updated list.

The same course locks protect scheduling, cancellation, transfers and automatic
withdrawal. Every change and its audit entry commit together. Repeated requests
cannot withdraw or audit the same place twice. Attendance and competency history
are preserved.

## Deployment

Vercel production builds apply committed migrations before compiling the new
application code. This migration adds a nullable `scheduledEndOn` date and an
index to Enrolment. A failed migration stops deployment. Local and preview
builds skip migrations; other production hosts must run `npm run db:deploy`
before deploying. No data backfill, seed, cron configuration or new secret is
required.
