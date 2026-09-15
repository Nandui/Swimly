# Schedule

Schedule replaces the desk Today page at `/schedule`, keeping the existing
`calendar` screen grant and role home key. `/today` redirects to it, preserving
a valid date. No roles need a database rewrite. Instructor and Duty manager
keep their own daily workflows.

The default is today's Dublin date. A Monday–Sunday strip selects one day;
previous/next week selects Monday of the destination week, and Today returns to the live
default. Exactly one day's classes and assessments are rendered. A selected
date travels in `?date=YYYY-MM-DD`; invalid dates fall back to today.

The shadcn booking sheet, availability icons and Agenda remain. All pool areas
and instructors at the sidebar's selected site appear without additional filters.
Small screens use Agenda. The workspace owns vertical scrolling; the booking sheet
expands to its contents and scrolls horizontally across time columns, retaining
sticky level labels. Display preference survives day switches. The selected day stays visible until
its replacement loads, with a loading announcement and disabled old content.
Calendar arithmetic is date-only UTC; the live clock and default day use Dublin.
Only today gets Running now/Next indicators and jump actions. Explicit selected
dates stay fixed across midnight; the default route refreshes to the new day.

Classes come from the current non-archived weekly timetable for that weekday.
Their availability counts bookings covering the selected day, respecting start,
end and scheduled-end dates, and excluding waitlists and waitlist-only withdrawals.
Ended enrolments can still count before their end date. Capacity, locations and
weekly times use the current class configuration; this is not an audit reconstruction
of old timetable edits. Assessment sessions, covers, attendance states and
cancellations all use the selected date and sidebar site.

Class cards in both the booking sheet and Agenda open the class overview used
by Classes, for every selected date. Links require the Classes screen grant;
attendance permission does not change their destination. Return links preserve
the selected Schedule day. Existing attendance guards and Instructor isolation
remain unchanged. Mutations revalidate `/schedule`.

Verification covers week boundaries, Dublin midnight and DST, deep-link validation,
safe legacy redirects, future phase/link behaviour, server date forwarding,
access checks, and real PostgreSQL-compatible availability queries against PGlite.
