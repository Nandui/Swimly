# Reception

Reception is a dedicated desk page at `/reception`, with four independent cards:

- Active and inactive swimmer lookup by name or member number.
- Selected swimmer details with contacts and current class and waitlist places.
  Profile and enrolment buttons
  appear directly below the swimmer's identity.
  Each place shows its time, level, location and instructor, with today's cover
  where applicable. Move, unenrol, enrol and profile actions stay beside the record.
- Today's timetable grouped by time or curriculum level, with parallel classes,
  cover instructors and occupied places. Its header holds the class count,
  classes running now, next start and explicit refresh.
- Quick links to add a new swimmer, browse all swimmers, the full timetable, sibling matching and
  assessment bookings.

When two 440px regions fit, search and Quick links share the top row; swimmer
details and today's timetable share the row below. Top-row cards align in height;
the detailed cards fit their content. Every card uses Astryx `elevation="low"`
to separate it from the page, with the same spacing-token padding and gaps.
Elevation comes from the Neutral theme, including its dark-mode values. Class
collections remain compact rows inside their widget, without nested cards.
On narrower screens, the order is search, Quick links, swimmer details, timetable.
Sticky section buttons keep the workspace reachable without scrolling through
the selected swimmer. Swimmer jumps to the details when selected, otherwise to
search. Buttons move focus to the chosen section heading. The DOM
follows the same task order. Timetable rows place availability and actions beside the class details
when their container has room, and stack them below on narrow screens.

Timetable rows identify running, next, later and finished classes using status
tokens and state available places explicitly. All day / Now and next filters
combine with time/level grouping. The snapshot refreshes every minute and on
return to the page, except while a dialog or text input is in use.

The selected swimmer and grouping stay in the URL. Changing clubs remounts the
view; a swimmer outside the current club returns an unavailable message without
revealing their details. Search is bounded and server-backed. Search failures
show a retry message, and outdated search failures cannot replace a newer result.
Only the selected swimmer's open places and basic contact details are fetched;
medical information stays in the profile. Transfer options load only when needed.
Reception opts into inactive search; enrolment pickers still search active swimmers
by default. Inactive records are labelled, and cannot be enrolled or moved until
they are active again.

## Actions and access

The new `reception` screen is explicitly assigned through Roles. It can be chosen
as a landing page; the existing fallback still applies if that screen is absent.
The existing Receptionist and Admin roles were given this screen through the
audited role editor. Their permissions and existing Overview landing choices were
preserved. No other existing role was changed.

Move and unenrol reuse the established server actions, including named permission
checks, club boundaries, capacity locks, placement validation and atomic audits.
Opening or cancelling a dialog makes no change. Failed saves retain their input.
Unenrol offers Now or On a date in one dialog. A scheduled place also offers
Keep place to cancel its scheduled end. The scheduled date remains visible in
the swimmer summary. Active swimmers can be enrolled from their waitlisted place
through the existing promotion action, with a confirmation and capacity checks.
Shared form and confirmation dialogs mount only while open, and return focus to
their trigger after closing. Enrolment fields have instance-specific IDs.
Enrolment, swimmer, class and cover changes invalidate Reception's view. Links to
other screens appear only when the role can open those screens.
Adding a swimmer opens the existing swimmer form directly from Reception and
requires `students.manage`, including the server-side permission check and audit.

## Verification — 7 September 2026

Typecheck, lint and 26 focused regression tests passed. The isolated tests cover
club-scoped Reception reads, authentication before queries, active-only defaults,
inactive search, timetable grouping, exact class start/end boundaries, explicit
capacity descriptions and existing enrolment safeguards.

Synthetic browser checks exercised immediate unenrolment, saving and cancelling a
future end, waitlist promotion, failed promotion and failed scheduling, focus
return after Cancel/Escape, section navigation, selection retention when grouping,
Now and next filtering, and read-only/inactive action restrictions. All mutations
used in-memory synthetic stubs. Layouts were checked at 375, 768, 1024 and 1280
pixels in both themes: one H1, no horizontal overflow, no duplicate IDs in checked
states and 44px controls at touch widths. Long class names
were included. Phone and desktop captures were visually inspected, with no
browser console errors. Captures contain synthetic data only; no live enrolment
was changed for testing.

The four-card layout pass reran typecheck and lint, inspected all four cards'
computed low elevation at 375/768/1024/1280 in both themes, and verified search,
selection, empty details, section jumps and dialog cancellation with synthetic
data. No overflow or browser errors were observed. This layout-only pass did not
rerun the earlier mutation regression suite.
