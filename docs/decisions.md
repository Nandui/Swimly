# Turnfin 2.0: decisions

The decisions Turnfin 2.0 stands on, newest first. Each says what was decided, why, and what follows. Only the owner (Fernando) takes them. Anything not listed here or in [../AGENTS.md](../AGENTS.md) is open to change.

**Adding one.** Add an entry at the top in the same change that needs it: a new app, splitting or merging apps, moving something into the platform, an exception to a rule in AGENTS.md, or anything that changes the five sentences. Give the date, the owner's decision in one or two sentences, why, and what follows. When a decision is replaced, change its entry rather than adding a contradicting one.

---

### D29 · 10 November 2026 · Risk assessments, brought over from Risk Management

**Risk assessments**, a new app in Managers, keeps each site's risk assessments: one for each area, job or activity, its hazards rated before controls and with them in place, sign-off by its owner, reviews on a schedule and requests for another look. It replaces the standalone Risk Management app ([Nandui/project-risk](https://github.com/Nandui/project-risk)) for assessments. Levels **View**, **Write** and **Manage** at the person's sites, and one extra, **Can give the executive sign-off**, never on an assessment they own. Turnfin's Incidents stays the record for incidents: whoever triages a report can link the hazards it involved and ask for their assessment to be reviewed.
**Why:** the assessments and the incidents they explain were in a separate app with its own sign-in, sites and people; in Turnfin they use the sites, areas, positions and roles that are already kept.
**What changed from the old app:** areas, jobs and departments come from Admin's lists, so the old app's own library goes; its five access levels become three levels and an extra; "Under review" for an overdue review becomes a tag on an assessment that stays in force; a new assessment is a draft whose hazards are added one at a time; nothing is deleted (assessments are archived, a removed hazard is hidden).
**Follows:** one new plug in the platform, `registerHazardRegister`, and one new event, `incidents.hazards.flagged` ([architecture.md](architecture.md#how-apps-talk)). The old assessments come over with `scripts/import-risk-assessments.ts`, dry-run until `--confirm`, run on Production only with the owner's yes ([operations.md](operations.md#operator-scripts-against-production)). Not brought over: the old app's incidents, its spreadsheet import and its AI drafting (owner, 10 November 2026). Copying hazards between assessments and insights charts are not built yet. It goes live at one site first (Admin › Apps). [apps.md](apps.md).

### D28 · 9 November 2026 · Staffing rosters lifeguards too

Staffing was built for swim teachers (D27), but lifeguards are part-time pool staff on the same rota, the same contracts and the same attendance rules. **Teachers** becomes **Staff** (`/staffing/staff`), and a person's contract is **swim teacher**, **lifeguard**, or **swim teacher and lifeguard**. The contract warning now works both ways: a lifeguard place for a swim teacher, a teaching place for a lifeguard. Still a warning, never a block. No schema change: the contract is a string, and the `StaffingTeacher` table keeps its name.
**Follows:** [staffing.md](staffing.md).

### D27 · 4 November 2026 · Staffing: swim teacher rostering on the contract

**Staffing**, a new app in Team, rosters swim teachers from the swim teacher rostering specification ([staffing.md](staffing.md)): two-week **rota blocks** built from each site's weekly **slots**, contracted hours first, published every second Friday four weeks ahead and acknowledged; **swaps** as the only way to hand over a shift; **call-offs, late arrivals and no-shows** logged by the duty manager, with on-time worked out from the logged call; **strikes** on the handbook's ladder, per semester; and **exam seasons** with their absence deadlines. Levels View, Run (duty manager), Supervise (pool deck supervisor) and Manage (centre manager) at the person's sites. **Warnings, never blocks** (owner's choice, same day): qualifications, rest, the weekly cap, overlaps and the lifeguard contract are shown and the supervisor decides, as on Rota. The process rules do refuse: a published shift changes only with Manage and a reason, nothing is published under 24 hours' notice, swaps close 48 hours before the shift.
**Why:** call-offs, availability treated as a wish list and no consistent swap or strike process; young managers need a guided process. It sits beside Rota rather than inside it because it rosters on contracts and blocks, not activities, and its strikes are disciplinary records.
**Follows:** teachers act through managers in Work for now (Supervise records swaps, acknowledgements and exam absences for them); acknowledging, asking for swaps and seeing their own strikes move to Turnfin Me through `/api/staff/v1` next. Preferences and mismatch meetings (BR-9), the monthly report, the Google Chat post and notifications by email are not built yet, and the spec's open questions (early versus late shift, under-18 limits, ratios, Timepoint) stand; [staffing.md](staffing.md) lists them.

### D26 · 3 November 2026 · Training sets up learning; Qualifications keeps qualifications

Training is for setting up learning and delivering it to staff, nothing more. A **course** is sections of steps: reading, checklists, quizzes and exams, hand-ins, a **live session** (date, place, register) or a **trainer sign-off**, so e-learning, live and practical training are one idea. Templates, AI draft, refresher cards, hand-ins and learning paths stay. Courses are assigned by hand to people, a job or a site, with an optional due date, or go automatically to anyone who starts a job; an assignment never repeats. An assignment is not started, in progress or done on a date, with its exam score; Training issues no certificates. **Progress** (per course and per person, downloadable) replaces the Matrix, Reports and In-service hours. Levels stay Trainer (sign off, run live sessions), Author (also build and publish) and Manage (also assign and see Progress).

A course may name a qualification type. When it is done or signed off, Training adds that qualification to the person's record, with the expiry the type's validity gives (Admin's qualifications list, one place for how long a qualification lasts), and never looks at it again: no expiry warnings and no "due again".

**Qualifications**, a new app in Team, keeps them: certificates people upload in Turnfin Me to check, what is expiring (with **Assign the course** on each row, which uses Training's ordinary assign; nothing reassigns on its own) and in-service hours. One level, **Keep**, at the sites a person works at, gives `qualifications.manage`; Training's Manage counts as Keep (`formerly`), so nobody who checked certificates loses it. The records stay the platform's `Qualification` tables, so Rota, the Academy and Turnfin Me read what they read today; the hours tables move to Qualifications with their names. Its pages are at `/staff-qualifications`, because Admin's list of qualification types keeps `/qualifications`.
**Why:** tracking compliance and teaching are different jobs for different people, and Training had grown a second app inside it. The owner first chose an unrestricted extra in HR; HR is restricted as a whole app, and an extra exists only beside a level, so that would have changed the access model. A small app needs no platform change and leaves HR fully restricted.
**Follows:** roadmap step 9, in two releases. The first (built 3 November 2026) adds Qualifications, moves its pages and home items out of Training, stops session registers logging hours, and adds the `registerQualificationRenewals` plug for Assign the course. The second cuts Training down: course steps, Progress, rules becoming "assign on joining this job" (repeats and the old expiry and due-again dates stop being read, done dates stay), and no completion certificates or Check a certificate. [apps.md](apps.md) and [architecture.md](architecture.md) change as each release ships.

### D25 · 3 November 2026 · Failed payments: three warning emails, sent by reception

Each failed payment linked to a swimmer can be followed by up to three emails to the swimmer's contact email: a **first email** any time once it is on the list, a **reminder** from 3 days after the first (asking for payment within 7 days of the first), and a **final notice** from 7 days after the first, saying the place may be cancelled and offered to the waiting list if payment does not arrive within 3 days. Reception sends each from the payment's page after seeing the email exactly as the family will; nothing is sent automatically, and cancelling the place stays a person's decision. Emails go from the parents app's mailbox, only from the live site; elsewhere the step is recorded as not sent. A send the provider refuses records nothing. There are no payment links: money is still taken in Legend.
**Why:** families were chased by phone only, with no record of what each had been told or when.
**Follows:** `src/modules/activities/shared/payments/emails.ts` (the schedule and wording) and the family email layout shared with "Assessment booked" (`shared/parents/family-email.ts`). Additive columns `emailsSent`, `firstEmailAt`, `lastEmailAt` on `payment_failures`.

### D24 · 2 November 2026 · Five front-of-house apps become Classes, Finance requests and Academy

Swim school, Short courses, Refunds, Coinage and Payments do not become one app. They become three:

- **Classes** replaces Swim school (gym activities may follow, so the name is not about swimming; "Activities" is already Rota's activity list). Short courses become its second activity type: Short courses' View becomes Desk, its Instructor or tutor level becomes teaching on the pool deck, and Manage stays Manage. Payments folds in: Desk works the failed payments, Manage uploads the bank's sheet. Its tables move into Classes' schema file and keep their names (owner, same day), so nothing is copied.
- **Finance requests** replaces Refunds and Coinage, in Front of house. Reception asks; the same finance team decides, can send a request back as **Needs information**, and pays or orders. Nobody decides their own. New tables: one `FinanceRequest` with a detail table per kind (refund, coinage), so a new kind adds a table and never changes the base.
- **Academy** leaves Short courses as its own app in Team, with two levels: **Tutor** (candidates, checks, payment, registers and results) and **Manage** (the course list, putting courses on). It keeps its tables and the Academy booking site's API.

**Why:** they are all front of house, but one app gives a role one level for all of it, so finance could not decide a refund without opening swimmer records, and the apps reach differently (sites against everywhere). Refunds and Coinage already ran the same flow, and Payments and Short courses only exist around the swim school's members. Reception goes from five apps to two, with Home showing what waits in both, so no desk view is added.
**Follows:** roadmap step 8, smallest first: Payments into Classes (built 2 November 2026, 3.2.0), then Finance requests, Academy and short courses into Classes (built 3 November 2026, 3.3.0). Each copy into new tables is approved by the owner before it runs on Production; old tables stop receiving rows, stay readable, and are dropped a month later with the owner's yes. [apps.md](apps.md), D1 and D21 follow.
**Decided with it (owner defaults, 3 November 2026):**
1. *Finance requests keeps the Refunds and Coinage tables for now.* No new tables and no copy: both kinds' code is one module with one frame and Overview (`/finance-requests`), their URLs stay (`/refunds/…`, `/coinage/…`; emails link there), and Use and Manage give the existing `refunds.*` and `coinage.*` permissions. One `FinanceRequest` table is a later step staff will not notice.
2. *Academy levels:* Short courses' Instructor or tutor becomes Academy Tutor and its Manage becomes Academy Manage; Short courses' View gives no Academy access.
3. *Short courses move into Classes now, their data later.* Their pages and code join the swim school's module and keep their own tables and registers; moving them onto `Programme` with an `activityType`, and their registers onto the pool deck, is a later step. Short courses' View becomes Classes Desk, Instructor becomes Pool deck Teach (which now gives `short-courses.run`: the short courses they instruct and their registers, never booking), and Manage becomes Classes Manage.
4. *Swim school is shown as Classes;* its timetable page "Classes" becomes "Timetable". The app id stays `swim-school` and its log name Swim school, so the activity log reads on.

Stored role levels carry over through each manifest's `formerly`, which now maps one former app's level keys to several apps. App switches: a new app with no switch of its own follows its former apps' (Finance requests: Refunds' and Coinage's; Academy: Short courses'), on wherever any was on and off only where all were off, until a superadmin sets its own in Admin › Apps; an existing app keeps its own (Classes and Pool deck do not take Short courses' switch).

### D23 · 2 November 2026 · HR moves into the main database

HR's tables live in the main Turnfin database as their own schema, `turnfin_hr`, instead of a separate Neon database. Nothing else changes: HR's tables are still plain SQL that only HR's code reads and writes, they still hold ids only, and access is still decided by the policy engine and logged. The production build migrates `turnfin_hr` wherever it migrates the main database (production and development previews). Once, in production, it copies every HR row from the old HR database into `turnfin_hr` while those tables are empty, logging counts only.
**Why:** the separate HR database's Vercel connection made production deploys fail (its per-deployment branch step timed out three times on 2 November 2026), and one database is simpler to run, back up and audit.
**Follows:** replaces "HR keeps its own database" in D3 and AGENTS.md. Anyone who can read the main database can now read HR's tables, so access to production database credentials is HR access. The copy ran in production on 2 November 2026 (3 notes, 1 review, 674 reads, 6 changes; recorded in `turnfin_hr.storage_imports`), the owner confirmed HR, and the copy step and the old `HR_DATABASE_URL` settings were then removed from the code. The old Neon HR database is no longer read.

### D22 · 2 November 2026 · Managers report on staff; HR notes have a kind

Managers on duty file a quick **report** about someone they line-manage: the person, the kind (Conduct, Performance, Attendance or Safety), what happened and when. It goes on that person's HR file as a note on their record, never shared with them, and the reporter sees nothing afterwards, not even their own report. Every HR note now has a kind, with General for the rest; a report is a note filed through the quick form. HR's levels become **Report** (file reports on the people they line-manage), **Their sites** (read and write the files of everyone who works at their sites) and **Everyone**. "Their team" is relabelled Report (it keeps its stored key, so the roles that held it move with no data change). The "Their sites" holders at the reporter's working site see the report under Needs you on Home until one of them opens that person's file. A wrong report is withdrawn, with a reason, by someone who can write notes on that file. Only a superadmin gives any HR level.
**Exception to AGENTS.md** ("Restricted reads and writes need a fresh sign-in"): filing a report (`hr.reports.write`) needs no fresh sign-in, because it reads nothing. It stays restricted, so administrators never inherit it.
**Why:** centre managers had nowhere quick to put an issue with a staff member on file, and managers on duty should not need to open whole files to do it.
*Changed 4 November 2026:* notes and reports can also be **Good work**, so managers can put positive things on file, not only issues. Additive HR migration `004_good_work_kind.sql`.
**Follows:** [apps.md](apps.md#hr) and `src/modules/hr/README.md`. Additive HR migration `002_note_kinds.sql`: a kind on every note, and when it happened, the site, how it was filed and who first read it for reports.

### D21 · 2 November 2026 · Payments: failed direct debits, followed up at the desk

*Folded into Swim school, now Classes, on 2 November 2026 (D24); what it does stays. Its levels are now Classes Desk and Manage, and its code and tables belong to the `activities` module.*

**Payments** is a new app in Front of house. Each month the bank's failure sheet is uploaded (Manage) and every failed direct debit on it whose member number belongs to a swimmer on Turnfin goes on a list per site; the rest (gym memberships, unknown numbers) are ignored (changed the same day from "every row"). Reception contacts each member, logs every attempt, and closes it as **Paid at the desk**, **New mandate set up** or **Place cancelled**; there is no write-off. A failure whose member number belongs to a swimmer shows "Payment failed" on that swimmer's profile until it is closed. Legend stays the billing system: the money and the mandate are handled there, never in Turnfin.
**Why:** the monthly sheet was followed up on paper, so nobody could see who had been contacted or what was still owed.
**Follows:** [apps.md](apps.md#classes) and `src/modules/activities/README.md` (since D24). Two additive plug changes in the platform: the member directory gains `byNumbers`, and `registerMemberNotices` lets an app put a notice on a swimmer's profile without the swim school importing it. New tables `payment_*`, additive.

### D20 · 1 November 2026 · Turnfin Sheet replaces Turnfin Glass

The 2.0 design is **Turnfin Sheet**: the logo's blue (#0062B1) as the ground, the work on one white page that floats on it, the logo's fin drawn oversized in white on the blue as its only texture, Manrope type, and colour on the page only for needs action, done, serious and live. It replaces Turnfin Glass (D13), which the owner found confusing, not uniform, too like Apple, too grey and not a leisure centre. It was chosen from screenshot-checked mockups on the new frame (D19), after Depth, Pool tile, Pace clock and Night were tried (https://claude.ai/artifact/QmVi8aMcECQzQxNNrgEKe5).
**Why:** a premium, modern look that is unmistakably Turnfin, with one colour that belongs to the brand, one consistent page for every app, and controls that are clearly controls.
**Follows:** [../DESIGN.md](../DESIGN.md) is the contract; the canvas's row D shows the approved screens. Roadmap step 5 re-themes the built Glass theme and kit to Sheet; the type and layout tokens of D15 keep their names. The Turnfin Glass design system artifact no longer describes the design.

### D19 · 1 November 2026 · The frame is worked out from the job

Turnfin has one frame, and what it shows is worked out from the person's levels, working site and screen width, never from a layout kept for each role. Home is one list of the person's work across apps. The sidebar lists only the apps they hold a level in, in the same fixed order for everyone, and drills into one app's pages at a time; there are no top tabs. An app lists at most five work pages plus one **Set up** page, which only Manage sees. A person with exactly one app lands straight in it. One search finds pages, people and members. The decision was checked with a clickable wireframe (https://claude.ai/artifact/PqMC2ft4uxAh1siiMxsV9v).
**Why:** staff were lost between two levels of navigation, long app lists, apps that each behaved differently, and work hidden inside apps. Layouts per role would break "roles are data" and add a concept; working the frame out from levels adds none.
**Follows:** PRODUCT sentence 3, "The frame" in [architecture.md](architecture.md#the-frame), "The frame and navigation" in [../DESIGN.md](../DESIGN.md), search in roadmap step 4, and the frame in step 5. The swim school's own nav, the instructor shell and the CCTV shell go.

### D18 · 30 October 2026 · One place to put content in a lesson

A new lesson asks only for its name and opens as an empty page. **Add** is the only way to put anything in it: text, media (Video, Audio, Slides or interactive, a PDF or picture) and activities (Checklist, Flashcards, Sort into groups, Scenario, Explore a picture, Practice quiz, Hand in work). Authors no longer pick a lesson type.
- An empty lesson shows these choices as tiles to start from. After that, they sit in the Add button.
- The page is one flowing text, and Add places a block where the cursor is. Blocks move by dragging, or with Move up and Move down on each block.
- **Practice quiz** (the section's questions) and **Hand in work** are blocks. A lesson holds at most one of each, and both count toward the six activities. Hand in work goes at the end, under the task written above it, and the lesson finishes when the trainer accepts the work, as before.
- An older lesson becomes a page when it is opened in the builder: its main part (the video, recording, checklist and so on) becomes the first block, and the change sticks once the lesson is saved. Published versions stay exactly as learners have them.
- Outlines in the builder and Turnfin Me show a lesson by its first activity, else its first media, else as reading.
**Why:** after D16, authors had two places to put content in a lesson, the lesson-type picker and Add, for the same purpose.
**Follows:** no database change: a page is a lesson of kind Reading whose text holds the blocks. Lesson types remain in the code so older lessons and published versions keep working. Replaces the D16 points marked below.

### D17 · 29 October 2026 · Plan (test): the rota started again, beside Rota

**Plan (test)** is a new app in the Team group, on test at one site while **Rota** carries on unchanged. The owner felt Rota had grown too complicated and settled a smaller model, question by question: a **shift** (person, site, day, times, the department whose plan it is on) is built first; **duty blocks** fill it (Lifeguard, Swim teacher, Reception, Break), each from Plan's own list of duties with its department, qualification (warns, never blocks), colour, usual length and timed tasks (on 11 November 2026 the owner moved choosing them to the Day: Setup keeps each duty's list, and whoever plans a shift ticks the tasks that person does on each duty; none come by themselves). **What's on** is one list of **sessions** in the site's **areas** from Admin › Areas (one level of parts, lanes counted; on 2 November 2026 the owner made Admin › Areas the one list Plan, Swim school and Rota share, edited by name, part of, department and lanes only, and Plan's own area list was dropped): each needs duties × count for its whole time, repeats on weekdays between two dates with skipped days, and can be changed or called off one day at a time. Sessions on the same area stack, so a booking lists only the staff it adds. A **gap** is a needed place nobody fills. Swim classes arrive from Swim school as sessions needing the one duty marked for classes, and Plan chooses their teachers through Swim school's record, superseding Rota for that. People can be marked **off** in Plan's own simple record; absences and returns to work stay in Rota. Warnings: qualification, overlap, off, class clash and breaks owed. Supervisors plan their own departments a week ahead and may borrow anyone at the site; Manage runs the day and keeps the setup. It is a floor guide: Timepoint stays the payroll record, with no import, change reasons or emails, and planners only see it (no Turnfin Me) while it is a test.
**Why:** Rota's four kinds of need (area needs, activities, bookings, classes), timed sub-activities, automatic breaks, week sharing and the Timepoint log made it hard to use and to change. Starting again beside it lets the site compare the two without risk.
**Follows:** [apps.md](apps.md#plan-test) and `src/modules/plan/README.md`. Its tables are new (`plan_*`, additive); nothing is read from or copied out of Rota. `plan_areas` and `plan_sessions.areaId` are no longer read and wait for the owner's yes to be removed; Rota's area hours, minimum staff and "covered from" settings are kept for Rota but no longer edited in Admin. If the test succeeds, a later decision says what replaces Rota and when; if not, Plan (test) is switched off and its tables removed with the owner's yes.

### D16 · 29 October 2026 · Several things in one lesson

A training lesson can hold several things together, such as audio with a slide deck. Authors use **Add** in any lesson's text to place **media** (Audio, Slides or interactive, a PDF or picture shown in place) or **activities** (Checklist, Flashcards, Sort into groups, Scenario, Explore a picture). The lesson types stay as they are, and these are blocks on top. (Since D18 a new lesson is a page and Add is the only way in.)
- Activities must all be finished before the learner can move on, under the same rules as their lesson types.
- A lesson holds at most six activities. They sit only in the main text, never inside tabs, reveals or steps. Media can go anywhere.
- Audio and slides play independently. Audio keeps playing, with a small bar pinned at the bottom once the player scrolls out of view, and can carry an optional transcript.
- Halfway progress is kept on the learner's phone, as checklist ticks already are; finishing the lesson goes on their record.
- Hand in work stays a lesson of its own, because a trainer checks it. A quiz is a knowledge check in the text. (Replaced by D18: both are blocks, one of each per lesson.)
**Why:** staff learn from a briefing while looking at its slides, or check a poster while ticking off a list. One thing per lesson split these across screens.
**Follows:** no database change: the blocks live in the lesson text (`cleanDoc` in `src/modules/training/shared/lessons.ts`), and published versions freeze them like everything else.

### D15 · 26 October 2026 · The last Poolside sizes become Glass tokens, and poolside.css goes

The sizes the pre-2.0 `poolside.css` still held become Turnfin Glass tokens in `glass.css`, under the names DESIGN.md gives them: the running type (`type-caption`, `type-body`, `type-title`, `type-large-title`, `type-figure` and their leadings), the layout limits (`overlay-max-width`, `overlay-max-height`, `tile-min`, `card-min`, `column-min`, `rail-width`, `field-min`, `deck-width`), the overlay shadow and focus halo, text on the accent, and the Docs content palette. Its surviving rules move to the top of `kit.css`, and the file is deleted from Turnfin and Turnfin Me.
**Why:** one theme, one set of names: nothing on screen keeps the old system alive, and a new screen cannot reach for it.
**Follows:** [../DESIGN.md](../DESIGN.md) (Space, size and radius). The Academy site keeps its own copy until it is rebuilt.

### D14 · 26 October 2026 · Maintenance, a new app, and the platform's one file check

**Maintenance** is a new app in the Managers group. Staff report what is broken at a site, and the site's managers follow it until it is fixed. It is not part of Incidents, which is for accidents and near misses, with triage and sign-off. It is not part of Tasks, which gets each site's checks done on time. The maintenance team keeps working in **Trackplan**. Turnfin asks "Is it already in Trackplan?" (Yes, No or Not sure, with an optional reference) and never connects to Trackplan. The owner decided each of these points in turn: two levels (Report, Manage); a separate urgency (Low, Normal or Urgent); and "Could hurt someone" always being Urgent. Reporters see the open requests in the area before sending. Manage notes come only with status moves, with no comments thread. There is no email until the platform outbox lands, and the app goes live at one site first.
The platform's **one file check** (`src/lib/files`, roadmap step 4) starts here. Maintenance's photos use it first, and the other apps move onto it in step 4.
**Why:** a broken light or locker belongs neither in an incident's triage queue nor in a site's checks. Staff need one place to say what is broken, and managers need to see what still has to reach Trackplan. A copy of every app's file check would have been a seventh.
**Follows:** [apps.md](apps.md#maintenance) and `src/modules/maintenance/README.md`. Later: urgent requests email the site's managers through the outbox, and an Incidents report of kind "Equipment or building" links to its maintenance request.

### D13 · 25 October 2026 · Turnfin Glass was the 2.0 design (replaced by D20)

The 2.0 design is **Turnfin Glass**: Apple's Liquid Glass and Human Interface Guidelines, brought to Turnfin's web app. A plain ground, opaque content, and glass only on the controls that float; colour only for selected, needs action, done, now and serious; springs and in-place feedback throughout. It was chosen from screenshot-checked, clickable mockups, after Poolside Clear refinements, editorial, colourful glass, Material 3 Expressive and Turnfin Live were tried.
**Why:** staff need calm, legible screens that let them act where they are looking; it looks and feels premium enough to stand beside the apps people use every day.
**Follows:** [../DESIGN.md](../DESIGN.md) is the contract (it replaces D9's placeholder). The design system (https://claude.ai/artifact/6Ex4VcQGtPRBheTqVtgWWM) shows it live; roadmap step 5 builds it.

### D12 · 24 October 2026 · Turnfin 2.0 begins

Turnfin 2.0 is the platform of apps (D11), jobs at places (D10) and a new look and feel (D9). It **evolves the live app**: same repository, data and deploy, moved forward in steps. Every pre-2.0 doc, plan and design rule was removed; these docs replace them.
**Why:** many more apps are coming, some as large as products sold on their own, and the old rules and design would hold them back.
**Follows:** [roadmap.md](roadmap.md). Version 2.0.0 is the first release staff notice.

### D11 · 24 October 2026 · A platform of apps, in one deploy

Turnfin stays one codebase, one deploy and one sign-in: a platform with apps on top. Each app has the six-part contract (description, plug, front door, events, own data, own tests), talks to others only through it, and can be switched on per organisation and site. No splitting into separately deployed services.
**Why:** a broken change must stay inside one app. Separate services move breakage into the network and were tried on 28 September 2026 and reversed.
**Follows:** [architecture.md](architecture.md); the safety net comes first.

### D10 · 24 October 2026 · Jobs at places

A person holds one or more jobs; a job is a role at the sites it covers. At the working site, each app's level is the highest among the jobs covering it. Combined roles are retired.
**Why:** some staff hold two different jobs (reception at one site, duty manager at another), and combined roles gave too much access at both.
**Follows:** roadmap step 3.

### D9 · 24 October 2026 · A new design for 2.0, decided before it is built

2.0 gets a new look and feel. The direction is approved from screenshot-checked mockups before anything is built, then written into DESIGN.md as the one design; the old look is removed as it is replaced.
**Follows:** [../DESIGN.md](../DESIGN.md), roadmap step 5.

### D8 · 24 October 2026 · The words

**App** inside Turnfin; **connected product** outside it (Turnfin Me, the parent app, the Academy booking site); **module** and **workspace** are code words only. "Turnfin Work", "surfaces", "My hub" and "the Reception portal" are retired. The pool deck is an app's screens, not a connected product.
**Why:** two words for one idea confuse people.

### D7 · 24 October 2026 · Shared services in the platform, not a work-item table

"Waiting for you" is built from each app's home items, completed rather than copied into a stored table. One email outbox and one file check move into the platform. Comments are not unified.
**Why:** a stored copy would drift; three email queues and six file checks were copies of each other; comments have different rules per app.
**Follows:** roadmap step 4.

### D6 · 8 October 2026 · Previews, not a development branch

Changes ship as a pull request with its own preview, then merge to `main`. Previews use their own development database, a copy of production including personal data (29 September 2026), and never migrate production.
**Follows:** [operations.md](operations.md).

### D5 · 28 September 2026 · Access by levels and permissions

A role holds one level per app; levels become named permissions; code asks only for permissions, and for other people's records, the policy engine. Administrators get Manage everywhere except HR; only a superadmin gives HR. Home, menus and hiding are never security.
**Why:** one access language, readable by an admin, and HR kept apart.

### D4 · 27 September 2026 · Turnfin and Turnfin Me are separate

Turnfin is the job, on work computers, with no personal pages. A person's own training, reading, qualifications, shifts, HR and details are in Turnfin Me, which reaches Turnfin only through `/api/staff/v1`.
**Why:** work devices are shared, and what is yours should not be on them.

### D3 · Apps own their data

Every table has one owner, named by its schema file. Existing tables keep their names; new ones take the app's prefix. Docs keeps its own database; HR is the `turnfin_hr` schema in the main database ([D23](#d23--2-november-2026--hr-moves-into-the-main-database)). Database changes only add.
**Why:** an app that owns its data can be changed, switched off or lifted out without touching the others; renaming live tables risks the running app.

### D2 · The platform is `src/lib` and the module wiring; the UI kit stays in `src/components`

The platform (sign-in, people, sites, access, audit, events, email, the API toolkit, the app catalogue) never names an app. The UI kit holds presentational components and the theme, with no business rules.
**Why:** apps stand on both; neither may depend on an app.

### D1 · Apps in the catalogue

The apps are those in [apps.md](apps.md): Classes (the swim school, with failed payments and short courses), Pool deck and Analytics (one module); Finance requests; Academy; Tasks; Incidents; Rota; Staffing (D27); Training; Qualifications (D26); Docs; HR; CCTV log; Site Monitoring; Maintenance (D14); Risk assessments (D29); Purchasing; Stock; Admin (D24). Classes and the Academy book people from the swim school's member records rather than keeping their own.
**Follows:** a new app is a new entry here.
