# Reception

Reception is a dedicated desk page at `/reception`, with four independent tiles:

- Swimmer lookup by name or member number, with current class and waitlist places.
  Each place shows its time, level, location and instructor, with today's cover
  where applicable. Move, unenrol, enrol and profile actions stay beside the record.
- Today's summary: class count, classes running now, next start and explicit refresh.
- Shortcuts to the full timetable, sibling matching and assessment bookings.
- Today's timetable grouped by time or curriculum level, with parallel classes,
  cover instructors and occupied places. It has a useful no-classes state.

The selected swimmer and grouping stay in the URL. Changing clubs remounts the
view; a swimmer outside the current club returns an unavailable message without
revealing their details. Search is bounded and server-backed. Search failures
show a retry message, and outdated search failures cannot replace a newer result.
Only the selected swimmer's open places are fetched, with no medical or contact
details sent to this page. Transfer options load only when needed.

## Actions and access

The new `reception` screen is explicitly assigned through Roles. It can be chosen
as a landing page; the existing fallback still applies if that screen is absent.
The existing Receptionist and Admin roles were given this screen through the
audited role editor. Their permissions and existing Overview landing choices were
preserved. No other existing role was changed.

Move and unenrol reuse the established server actions, including named permission
checks, club boundaries, capacity locks, placement validation and atomic audits.
Opening or cancelling a dialog makes no change. Failed saves retain their input.
Enrolment, swimmer, class and cover changes invalidate Reception's view. Links to
other screens appear only when the role can open those screens.

## Verification

Build, typecheck, lint and all 56 regression tests passed. Eight synthetic
viewport/theme checks and 16 live read-only layout checks passed without browser
console errors. Next.js compilation and runtime diagnostics were clean.

The isolated regression suite covers club-scoped Reception reads, authorization
before queries, time/curriculum grouping, selection URLs and screen/landing-page
access alongside the existing enrolment and concurrency checks.

Synthetic browser fixtures exercise keyboard search, empty and failed searches,
selection retention when grouping, multiple open places, confirmed moves and
unenrolments, failed-move recovery, read-only access and unavailable records.
Layouts and move dialogs were checked at 375, 768, 1024 and 1280 pixels in both
themes: one H1, no overflow or nested controls, and 44px touch controls. Synthetic
phone and desktop captures were visually inspected. No real swimmer data appears
in those captures, and no live enrolment was changed for testing.

The live page is also checked using read-only navigation. Sunday has no timetabled
classes in the current database; populated timetable states use synthetic data.
