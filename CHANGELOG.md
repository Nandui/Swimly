# What's new in Turnfin

Patch notes for everyone who uses Turnfin at the swim school, the desk and the office. Newest first.

**How versions are numbered:** the middle number goes up when something new arrives (a module, a screen, a new way of working), and the last number when something is fixed or tidied without changing how you work. This list starts on 3 October 2026, when Turnfin moved to its new look; earlier changes are not listed.

## 1.12.4 · 15 October 2026 · New sites show in every module

- A site added under **Admin > Sites** showed in the site picker and the swim school, but not in Incidents, Rota, Tasks, Training, Short courses, Stock, Purchasing or the Academy, or when choosing the sites a person works at. It was saved without belonging to LeisureWorld, and those lists only show LeisureWorld's sites.
- New sites now belong to LeisureWorld straight away.
- A site added before this fix says so on **Admin > Sites**. Open it with the pencil and choose **Save changes**, without changing anything, and it shows everywhere.

## 1.12.3 · 14 October 2026 · Rota: put staff on any activity

- On the **Plan**, the time in someone's shift with nothing given to it (**No activity**) used to offer only the activities already added to that day that still needed someone. Activities on the list that were not on the day yet, or were already full, never showed.
- Now that sheet, and the person's own shift sheet, have **Put on any activity**. Pick any activity on the list, from any department, choose where and the times, and they are put on it. The activity is added to the day for that time with them on it.
- Another department's activity lends them to it, as before. Teaching is not on that list, because swim classes plan it.

## 1.12.2 · 13 October 2026 · Rota: a cleaner Plan page

- The **Plan** page has a new look. The week is a row of day tiles with a large date, the staff and hours, and a dot for gaps or covered; the open day is filled blue.
- Beside the week, the open day shows its date large, with four figures: staff on, paid hours, unpaid breaks and gaps to fill. **Add staff** and **Add activity** sit under them. These totals used to be at the bottom of the day.
- In the day itself, the row names are no longer boxed. Each person has their initials, their shift times, paid hours and a thin bar of this week's hours against their contract (amber when over).
- Nothing about how you plan has changed.

## 1.12.1 · 13 October 2026 · Incidents: managers triage their own reports

- Someone with **Manage** in Incidents (the operations manager) can now triage a report they filed themselves. The **Triage** panel shows on the report, and it counts in their reports to triage on Home.
- Everyone else's own reports still go to someone else to triage. Investigating and closing your own report still need someone else.

## 1.12.0 · 13 October 2026 · Rota: plan by shifts

- The **Plan** day now starts from people's shifts. **Add staff** gives someone a shift for the day; the whole shift starts as **No activity**. Choose a No activity stretch on their row to see what needs someone then and put them on it, so one shift can mix lifeguarding, teaching, a booking or another department's work.
- **What needs people** comes first: one row for each activity your department needs, each booking and the swim classes, showing how many people are on it against how many it needs. Green has enough, amber is short; choose an amber stretch to fill it. **Show other departments** adds theirs.
- Supervisors can **lend** someone on their shift to another department's work when needed, such as a pool lifeguard covering Reception for an hour.
- Each person shows their **paid hours** today and this week, against their **contracted hours**. The day ends with a line of totals: staff on, paid hours, unpaid breaks and gaps. Each day in the week strip shows its staff and hours too.
- **Export week** downloads the department's week as an Excel file for Timepoint: name, date, start, end, paid hours, break minutes and department for each shift.
- Your bookings, activities and lanes are kept as they were.

## 1.11.0 · 13 October 2026 · Rota: pools with lanes, and one timeline

- **Admin > Areas** now asks how many **lanes** an area has. Give each pool its lanes (0 for a gym, reception or anywhere without lanes).
- A **booking** or an activity in a pool with lanes can take the **whole pool**, one lane or any set of lanes. Two bookings can't hold the same lane at the same time: saving one that would says which booking already has it.
- The **Plan** day is now one timeline, time across the top. **Zones** come first: every area of the site in its order, and each pool split into a row across it and a row per lane, so you can see which lanes are free. **Staff** follow: a **Needs someone** row with every gap still to fill, then one row per person, name and shift on the left and their day across, with their breaks. Choose a gap to fill it, a person's block to change their time, or a name to open their shift.
- Things on the same lane at the same time show in red. Other departments' activities show in grey, so you see the space is taken without their gaps.
- Existing bookings and activities with no lanes take the whole area, as before. On a phone the day is still a list.

## 1.10.0 · 13 October 2026 · Stock

- A new module, **Stock**, under Back office, brings stock taking into Turnfin. It does what Stockly did, with your Turnfin sign-in, sites and roles.
- **Counts:** start a count at the site you are in and walk the stockroom with a phone or tablet. Products are grouped by category, with a search and a filter for what is still to count. Numbers save as you type. An empty box means not counted; **None** means you counted and there were none. Submit the count when you are done; after that it can't be changed.
- **Compare:** put two submitted counts at a site side by side and see what went down, what went up (a delivery nobody recorded, or a miscount, shown in red) and what was not counted, which is left out of the totals.
- **Products and Categories:** one product list for every site, each counted in its own unit (a can, a pair, a 25ml serving). Products and categories are archived, never deleted, so old counts stay readable. The usual categories (Drink, Snack, Confectionery, Retail, Cleaning, Equipment, Other) are there to start with.
- To start the list, whoever manages Stock can press **Add the Bishopstown stock sheet** on Products once. It adds the 74 product names from the Bishopstown sheet under Other, counted "each", ready to sort into categories. Stockly's old counts are not brought across.
- Home shows **Stock counts to finish** while a count is open at your sites.
- Administrators choose who can View, Count or Manage on each role, under Stock. Nobody sees it until then.

## 1.9.2 · 13 October 2026 · Rota: change a booking

- On **Rota > Bookings**, each booking now has a **Change** button beside Cancel booking. It opens the same form as New booking, filled in, so you can change who it is for, the activity, the area, the times, how many people, the days of the week, the last day and the dates it does not run.
- Changes reach the booking's days still to come; days that have come stay as they were, and so does its first day once it has started. Days it no longer runs leave the plan, and anyone on them is told. New days get the activity with its places to fill.
- A day you changed on its own on the Plan keeps its own changes, except the ones you make to the booking. If someone is on a day outside the new times, or on a place you are taking away, Turnfin says which day so you can change them on the Plan first.

## 1.9.1 · 13 October 2026 · Unenrol after a swimmer's last lesson

- When you unenrol a swimmer from a future date, you now pick their **last lesson** from the class's upcoming lessons instead of typing a date. They stay in the class, on the register and in the numbers, up to and including that lesson, and their place frees up the next day. The class and the swimmer's profile show "Last lesson" with the date.
- Before, the date you picked was the day they left, so a swimmer unenrolled "on" a lesson day missed that lesson. Unenrolments already saved keep their date and now show the last lesson that date gives them; check any you set on a lesson day and pick that lesson again if it should be theirs.

## 1.9.0 · 13 October 2026 · Short courses

- A new module, **Short courses**, under Front of house, for courses that run for a set number of weeks: Couch to 5k, adult swim lessons, aqua fit, strength basics, at the pool, the gym, the studio or anywhere else.
- Managers keep the **course list** (where it happens, how many weeks, how long a session, a minimum age, and whether it asks for a health form), then **put a course on**: pick the first day, the time, the area, the instructor, the places and the price, and Turnfin makes a session for every week. Move a single week, for a bank holiday, on the session itself.
- The desk **books people on** and records what they paid at the till. When a course is full, people go on its **waiting list** in the order they asked. When a place frees up, the course shows who is first, and Home tells you there is a place to offer.
- Instructors **take the register** each week. Each person's line shows how many sessions they came to, what they still owe and whether their health form is in.
- Each session shows on the instructor's **Rota**, in its area, and counts in their hours.
- Administrators choose who can View (book people on), Instructor (take registers) or Manage (put courses on) on each role, under Short courses. Online booking comes next.

## 1.8.2 · 13 October 2026 · Swimmer profile: retired competencies

- On a swimmer's **Competencies** tab, competencies that have been taken out of a level now sit in their own list at the bottom, under **No longer in the curriculum**. They still show the mark the swimmer had and its history, but they can't be changed and don't count towards the level.

## 1.8.1 · 13 October 2026 · Move a class to another site

- A class set up at the wrong site can now be moved. Open the class and choose **Move** under Manage class, then pick the site. Its swimmers, registers, notes and results go with it. You need to work at both sites, and the button only shows if you work at more than one.

## 1.8.0 · 12 October 2026 · Incidents: insights, the full record and HR

- Centre and operations managers have a new **Insights** page in Incidents: what was reported over the last 3, 6 or 12 months at their sites, by month, kind, what it was about, where, the time of day and how serious, with the near misses for each accident and the overdue actions.
- The operations manager can open a report's **full record**, with everything on it, to print or save as a PDF for the insurer. Each time it is opened, it shows in the report's history.
- When a member of staff is hurt, the report form now lets you pick them from the site's team. The injury then appears on their **HR personal file**.
- The report form's "Make it safe first" note now links to the site's **emergency plans** in Docs.
- Reports are kept for at least 10 years, or 21 when a child was involved. The operations manager sees any that have passed that on Insights; nothing is deleted.

## 1.7.0 · 12 October 2026 · Incidents: investigations, actions and photos

- While a report is under investigation, whoever is investigating can now take **witness statements**, work out **why it happened** by asking "why?" up to five times, and write down the root cause. Serious and moderate reports can't be closed until the root cause is recorded.
- They can also raise **actions**: what will change, who does it and by when. The person gets an email when it is given to them, the day before it is due and the day after if it is late. Your open actions show under **Your actions** on Reports and on Home, where you can mark one done with a note. A report can't be closed while any action is still open.
- Reporters and investigators can add **photos and files** to an open report: pictures of the scene or the hazard, or a doctor's note. Up to 10 per report, 4 MB each.
- Triage's Health and Safety Authority questions now follow the exact Irish rules. A member of the public counts when they were taken from here to a hospital or doctor for treatment. A death and a dangerous occurrence are now separate questions, and after a death the report is due within 5 working days instead of 10, with a reminder to phone the HSA or the Gardaí at once.
- The operations manager can **reopen** a closed report with a reason, for example when there is new evidence or an action didn't work. It goes back to investigation, and the reason shows in the report's history.

## 1.6.0 · 11 October 2026 · Incidents: report accidents, incidents and near misses

- A new module, **Incidents**, under Poolside. Duty managers, shift and department supervisors, centre managers and operations managers report an accident, an incident or a near miss in about two minutes, from any work computer or tablet: what happened, where and when, who told them, who was involved and who saw it. Everyone else tells the supervisor or duty manager on shift.
- Once sent, a report is kept exactly as written. You can add to it later, and your additions show under it with your name and the time.
- If someone went by ambulance or to hospital, or it was a rescue from the water, a chemical or a missing child, the managers who cover that site get an email straight away.
- The centre manager and the operations manager see every report at their sites, and either of them triages it: they rate how serious it was and could have been, answer the Health and Safety Authority questions, and either close low-risk ones or send them for investigation. Both get an email straight away when something serious is reported. Serious ones are closed by the operations manager. Nobody triages or closes their own report.
- When your report is closed, you can see what was found and what changed.
- Administrators choose who can Report, Investigate or Manage on each role, under Incidents. Give Report to duty managers and supervisors, Investigate to centre managers and Manage to operations managers.

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
