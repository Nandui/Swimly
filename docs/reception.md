# Reception

Reception is a dedicated desk page at `/reception`, centred on the swimmer:

- The swimmer sheet starts with active and inactive swimmer search, identity,
  status and pinned placement levels. Contacts open in a dialog beside the full
  profile link. Current places use compact rows with day/time, class, pinned level
  and programme, pool, instructor and today's cover. On phones, time and secondary
  details move into the class cell, keeping actions readable.
- Move opens the weekly finder below the current places, defaulting to the source
  placement level. Find a place uses the same finder for enrolment. It filters by
  exact level identity, day and inclusive start-time bounds. Available only hides
  full classes; existing active and waitlist places are excluded. Full classes
  cannot receive a move. Turning off Available only permits an explicit waitlist
  request when finding an additional place. Selection reveals a current/new
  comparison and review dialog, with the existing server confirmation where needed.
- Add swimmer stays in the page header and selects the created swimmer after the
  audited save. Sibling-time, assessment and class-finder shortcuts follow the
  swimmer workspace. Before selection, an empty state explains where to start.
- Today's classes open from the header, leaving the full page width for the
  swimmer and class comparison. There is no permanent timetable side panel.
- Today's classes use compact list rows. Time grouping shows running and upcoming
  classes first, with earlier classes expandable and initially open after the last
  class. Level grouping shows the whole day's ladder. Each class uses its own end
  time, and accessible classes link to the existing detail page and roster.
  Counts, snapshot time, grouping and refresh remain within this supporting panel.

The selected swimmer and grouping stay in the URL. Changing clubs remounts the
view; a swimmer outside the current club returns an unavailable message without
revealing their details. Search is bounded and server-backed. Search failures
show a retry message, and outdated search failures cannot replace a newer result.
Only the selected swimmer's open places are fetched, with basic contact details;
Medical information stays in the profile. Transfer options load when a swimmer
is selected and the staff member holds the enrolment permission.

Reception refreshes every minute and on return to the page, except while a
dialog, text input or inline finder is in use. Refresh places explicitly updates
availability while retaining the filters and clearing the proposed selection.
The server rechecks seats at confirmation. Inactive swimmers cannot be enrolled
or moved. No live data is written by simply opening the finder.

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


## Verification

### A — Swimmer sheet — 10 September 2026

Implemented on `codex/reception-swimmer-sheet` from dev `e7b2bd7d`, following the
owner's selection of concept A. The grouped shell, Astryx Neutral tokens and
Figtree remain unchanged. Native Select buttons replace the comp's drawn radio
circles; the time filter has explicit start bounds. The comp's full row under
Available only is corrected, and existing permission-gated actions are retained.

The real components run in an isolated fixture with synthetic swimmers and
mocked server boundaries. Browser checks cover contacts and focus return, weekly
filters, full-class restrictions, review without a write, failed-save recovery,
confirmed moves, explicit waitlisting, scheduled unenrolment, read-only and
inactive access, and keyboard search. All eight 375/768/1024/1280 light/dark
combinations and the review dialogs passed, including long names, one H1/main
landmark, 44px touch controls, no sideways overflow and no nested controls.
No browser errors were recorded. The Impeccable detector reported no findings.

Typecheck and all 115 tests passed, including scoped reads, pinned programme
selection, chronological filtering, inclusive times, capacity and duplicate
place exclusions. `npm run lint -- --ignore-pattern 'prototypes/**'` passed.
Unrestricted `npm run lint` encounters existing prototype and generated-build
errors outside this change. No database migrations or live booking writes ran.
Visual artifacts and the runnable fixture stay in the ignored review directory.

### Swimmer-first layout — 10 September 2026

Typecheck and lint passed. The synthetic browser fixture exercises the real
dashboard and shared dialogs. Search, quick add and failed-save recovery,
selection/grouping retention, enrol access, contact links, waitlist promotion,
scheduled unenrolment cancellation, inactive and read-only restrictions, and idle
refresh passed. All eight viewport/theme combinations at 375, 768, 1024 and
1280px passed, including long names and add-swimmer dialogs: one H1 and main
landmark, no horizontal overflow or nested controls, and 44px touch targets.
Desktop and phone screenshots were inspected. The layout detector reported no
findings. Browser actions use synthetic responses and do not change live records.

### Integration with the latest dev branch — 10 September 2026

The layout was rebased onto the grouped workspace shell. Inactive swimmer
lookup, contacts, waitlist promotion, scheduled unenrolment and idle refresh from
the newer branch remain available. The wider swimmer form and custom triggers
are preserved, with the new post-create selection callback added alongside them.

Typecheck, lint, all 110 regression tests and the production build passed.
The build used temporary placeholder credentials and skipped database migrations.
Browser checks with synthetic data passed at 375, 768, 1024 and 1280px in both
themes, including long swimmer names and the add-swimmer dialog. Search, quick
add, selection and grouping, contacts, confirmed waitlist promotion, cancellation
of scheduled unenrolment, inactive restrictions and refresh deferral during
forms or searches passed without browser errors. No live records were changed.

### Layout implementation — 10 September 2026

The new layout uses the real Reception dashboard, shared shell, swimmer search,
swimmer form and enrolment dialogs in an isolated browser fixture. Its data and
server-action responses are synthetic; no database records were changed.

- `npm run typecheck`, `npm run lint` and all 59 regression tests passed.
  Stale generated Next.js route validators were regenerated before typechecking.
- Eight viewport/theme checks at 375, 768, 1024 and 1280px passed: one H1 and main
  landmark, no horizontal overflow or nested controls, and 44px touch controls.
  The add-swimmer dialog also fitted each viewport in both themes.
- Keyboard skip-link and swimmer selection, URL retention through grouping and
  refresh, new-swimmer selection, save-error recovery, enrol dialog access, empty
  and failed searches, read-only/create-only permissions, unavailable swimmers,
  empty days and finished days passed. Destination links were verified.
- No browser console errors or uncaught runtime errors were recorded. Synthetic
  phone, desktop and selected-swimmer screenshots were inspected.

The local checkout has no database or authentication credentials, and the
Vercel CLI is unauthenticated. Live-data verification therefore remains pending.
Production compilation is checked with temporary placeholder environment values;
this does not verify a database connection. Browser evidence is kept locally in
`.impeccable/review/reception-implementation/` and is ignored by Git.

### Previous layout — 7 September 2026

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
