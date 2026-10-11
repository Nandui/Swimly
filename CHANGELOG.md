# What's new in Turnfin

Patch notes for everyone who uses Turnfin at the swim school, the desk and the office. Newest first.

**How versions are numbered:** the middle number goes up when something new arrives (a module, a screen, a new way of working), and the last number when something is fixed or tidied without changing how you work. This list starts on 3 October 2026, when Turnfin moved to its new look; earlier changes are not listed.

## 1.6.0 · 11 October 2026 · Incidents: report accidents, incidents and near misses

- A new module, **Incidents**, under Poolside. Anyone whose role has it can report an accident, an incident or a near miss in about two minutes, from any work computer or tablet: what happened, where and when, who was involved and who saw it.
- Once sent, a report is kept exactly as written. You can add to it later, and your additions show under it with your name and the time.
- If someone went by ambulance or to hospital, or it was a rescue from the water, a chemical or a missing child, the managers who cover that site get an email straight away.
- Duty managers see every report at their sites, rate how serious it was and could have been, answer the Health and Safety Authority questions, and either close low-risk ones or send them for investigation. Serious ones are closed by a manager. Nobody triages or closes their own report.
- When your report is closed, you can see what was found and what changed.
- Administrators choose who can Report, Investigate or Manage on each role, under Incidents.

## 1.5.1 · 11 October 2026 · A clearer Home

- Home now shows each group of modules (Front of house, Poolside, Team, Back office) in its own panel, side by side on wide screens, so the list no longer leaves gaps.
- When something in a module needs you, its row now says what, for example "Refund requests to decide 2", as well as how many things need you.
- While Home is loading, it shows the outline of your modules straight away instead of waiting on a blank page.

## 1.5.0 · 11 October 2026 · Home opens your modules, and every module has a starting page

- Home is now the place to open your modules: it lists every module your role has, grouped as in the side bar, with a line on what each is for and how many things in it need you.
- Opening a module takes you to its starting page: its quick actions, what is on today, what is waiting for you, and every page in it. Refunds, Tasks, Training, Academy, HR and Purchasing now have one, like the Swim school, Rota and Admin. "Overview" is the first link in each module's top bar.
- Today's classes, the swimmer search and the swim school's daily pages are now on the Swim school's starting page and in its top bar, rather than on Home.
- In Training, the list of people's training is now called "People" in the top bar.

## 1.4.4 · 11 October 2026 · Rota times in 5-minute steps

- Bookings, activities, people put on them and shifts on the rota can now start and end on any 5-minute step, so a booking can last 10, 15, 25 minutes or any other multiple of 5. The time pickers move in 5-minute steps, like breaks.
- This replaces 1.4.3, which had limited rota times to quarter hours.

## 1.4.3 · 11 October 2026 · Rota times on the quarter hour

- Rota times were limited to quarter hours. Replaced the same day by 1.4.4.

## 1.4.2 · 10 October 2026 · Lighter under the hood

Nothing changes in how you use Turnfin. Behind the scenes:

- Unused code and settings were removed, so the app has less to load and less that can go wrong.
- Each module now describes itself, its menu entry and its access levels in one place, which makes adding or changing a module safer.
- Two font files nobody used are no longer installed, and old one-off scripts and out-of-date documents were removed.

## 1.4.1 · 10 October 2026 · Tidier and more consistent

- Menus, pickers, dialogs, grids and search fields now take their sizes from the same design settings, so they line up the same way everywhere. The outline around your picture does too.
- Behind the scenes, each module was reorganised so one part can change without breaking another. Nothing moved on screen.

## 1.4.0 · 9 October 2026 · Tasks in full, cancelled classes through Legend

**Tasks**
- Today: search, filters by status and tag, a date picker, a completed meter and an "At a glance" summary.
- Writing tasks: copy and archive, a designer with Content, Schedule, Assign and Report tabs, one-off, repeating, ad hoc and follow-up tasks, tasks timed to opening or closing, and a warning before you leave unsaved changes.
- Sites: opening hours, time zone and closed dates for each site.
- Reports: site scores, task reports, average score, a trend chart and CSV downloads.

**Cancelled classes**
- "Export for Legend" downloads the cancelled classes as a file ready for Legend's bulk update.
- Cancelled classes now go through three stages: Awaiting billing, To restore and Done. Once the members are back on their monthly price, mark them restored.
- Billing prices: swim school managers keep the monthly price of Water Safety & Fun and Swimming Skills in one place.
- Classes already passed to billing before this change were moved to To restore, so none are missed.

**Assessments**
- Each assessment session can say which ages it is for. A swimmer outside the range, or without a date of birth, can't be booked by the desk or by a parent.

**Qualifications**
- Only the expiry date is required when recording a certificate. The issue date and certificate number are optional.

## 1.3.0 · 8 October 2026 · Academy, Tasks and staff positions

**New: Academy**
- Run the lifeguard and swim teacher courses we deliver: the course list, courses at each site with tutor, assessor, places and price, dated sessions, candidates, pre-course checks, registers and results.
- When a member of staff passes, the qualification goes on their record.
- Course sessions show on the rota.
- Online booking: the public can book a place on the Academy booking site. We can't take payment online, so the place is held and reception phones within 72 hours. Turnfin shows a "To call" list, soonest deadline first.

**New: Tasks**
- Each site's daily checks and logs: checklists, readings with acceptable ranges, photo or PDF evidence, approval and follow-up actions.
- Three levels: Do, Review and Manage.

**Staff and HR**
- Positions: Admin keeps the list of jobs and the qualifications each one needs.
- A person's profile, employment and contact details moved from Admin to their HR file. Admin keeps only sign-in and access.
- Training's Expiring list can be filtered by site and position, and shows who has never held a qualification their position needs.
- Expiry reminders also go to the person's line manager.

**Rota**
- Who's working is shown as a timeline by person. Add someone to a shift, then give them the gaps they fit and are qualified for.
- Breaks follow the staff handbook. Managers place them; the rest are suggested.
- Under-18 rest warnings: 12 hours between shifts (14 for under-16s) and two days off a week.

**Swim school**
- The teacher the rota plans on a class for a day is that day's teacher everywhere: on the register, in the pool deck's swimmer lookup and in what parents see.

**Everywhere**
- Modules are grouped as Front of house, Poolside, Team and Back office on the home page, in the module bar and in the role editor.

## 1.2.0 · 7 October 2026 · Shared setup and a sharper rota

- Admin: shared lists are set up once, by topic. People (staff, roles, departments), Places (sites, areas) and Work (activities, qualifications). Each site now has its own list of areas, such as its pools and rooms.
- Rota: the day plan is grouped by the site's areas. Scroll to zoom in and drag to move along the day. The timeline now shows on laptops from 1024 pixels wide.
- Analytics: a new Multiple enrolments report lists swimmers with more than one place (waitlist places included), for this site or all your sites, with member IDs, search and a CSV download.

## 1.1.0 · 6 October 2026 · Purchasing, and the rota rebuilt

**New: Purchasing**
- Raise purchase orders from approved suppliers and products at agreed prices.
- Orders are approved by role and amount, never by the person who raised them. Approved orders get the site's next number, such as PO-BT-00001, and print as the supplier's copy.

**Rota, rebuilt around activities**
- Supervisors plan the days ahead with a week strip that counts the gaps, a full-width day timeline and "Who can fill it", best fit first.
- Duty managers get Today: gaps first, who's on now, coming up and off today, and the day's changes.
- Changes to a day that has already come ask for a reason and are logged.
- New levels: View, Plan and Run.

## 1.0.1 · 5 October 2026 · Polish for the new look

- A full review of every page on phones, tablets and computers, in light and dark mode. Fixed clipped page bars, focus outlines, status tags, forms, tables and empty states across every module.
- On wide screens the frame now fills the window. The pool deck keeps its own width.

## 1.0.0 · 3 October 2026 · Turnfin's new look

- One look across the whole app: the fin's blue, rounded controls and white panels.
- Sign-in, switching user and confirming your password share one simple screen.
- Refunds, Docs and Help moved into the new frame.
- The page bar shows as many links as fit and puts the rest under More, so a link never scrolls out of sight.
- Turnfin Me matches the new look.
