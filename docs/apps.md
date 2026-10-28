# Turnfin 2.0: the apps

Every app inside Turnfin: what it is for, its levels, where they reach, what it owns and how it connects. The levels come from each app's `manifest.ts` (listed in `src/app/modules.ts`); when they change there, change them here in the same commit. How apps are built is in [architecture.md](architecture.md); each module folder's `README.md` lists its features, front door, tables, events and permissions for coders.

**Reach** says where a level applies: **sites** means at the sites the person works at (their jobs' sites, once jobs are built); **everywhere** means across the organisation.

## Front of house

### Swim school
*Module `activities` · starter page `/swim-school` · reach: sites · data: `activities.prisma`*

Swimmers, classes and assessments at the desk, and the swim school's set-up.

| Level | Gives |
| --- | --- |
| Desk | every swimmer, booking, move, waiting list and assessment booking |
| Manage | also programmes, levels and classes |
| *Extra:* Can cancel classes | cancel sessions, or close a whole day, today or up to four weeks ahead on the duty manager page or Schedule, pass them to billing, and undo them before billing acts |

Connects: class commitments for Rota; the member directory and history for Short courses; site summaries; home items; the parent app's API.

After every assessment booking, the family gets an "Assessment booked" email: the parent who booked in the parent app or, for a desk booking, the swimmer's contact email (else the linked parent accounts). It gives the child's first name, the assessment, day, time, site and the site's reception phone. It is sent after the booking commits, from Production only (previews run on real records), and never for bookings by a system account.

### Short courses
*Module `short-courses` · `/short-courses/overview` · reach: sites · data: `short-courses.prisma`, `short-courses.academy.prisma`*

Six- and eight-week courses, and the Academy's lifeguard and swim teacher courses: places, payment, registers and results.

| Level | Gives |
| --- | --- |
| View | see courses; book people on, record payment, keep the waiting list |
| Instructor or tutor | also take registers; on Academy courses add candidates, record checks, payment and results |
| Manage | also keep both course lists and put courses on |

Connects: books from the swim school's member directory; course sessions as Rota commitments; desk measures; the Academy booking site's API. A pass puts the qualification on the person's staff record.

### Refunds
*Module `refunds` · `/refunds/overview` · reach: everywhere · data: `refunds.prisma`*

Customer refund requests, finance decisions and completed payments.

| Level | Gives |
| --- | --- |
| Use | log a customer's refund request and follow it |
| Manage | decide requests and record payments. Nobody decides their own |

### Coinage
*Module `coinage` · `/coinage/overview` · reach: everywhere · data: `coinage.prisma`*

Coins for the tills, requested at the desk and ordered by accounts.

| Level | Gives |
| --- | --- |
| Use | request coinage for a till and follow it |
| Manage | decide requests and record the orders. Nobody decides their own |

## Poolside

### Pool deck
*Module `activities` · `/instructor` · reach: sites · data: the swim school's*

Today's classes at the pool: attendance, competencies and assessments, on a tablet.

| Level | Gives |
| --- | --- |
| Teach | their own classes: attendance, competencies, assessments, covering a colleague's class |
| Lead | also attendance for any class |

### Tasks
*Module `tasks` · `/tasks/overview` · reach: sites · data: `tasks.prisma`*

Each site's daily checks and logs: checklists, readings with acceptable ranges, approval and follow-up actions.

| Level | Gives |
| --- | --- |
| Do | the day's tasks at their sites aimed at their role, and raising follow-up actions |
| Review | also approve, reopen, mark not applicable, resolve actions, see reports |
| Manage | also write the task templates |

Emits `tasks.reading.out_of_range`. A nightly job (01:30) creates each day's tasks.

### Incidents
*Module `incidents` · `/incidents/overview` · reach: sites · data: `incidents.prisma`, footage in Vercel Blob*

Accidents, incidents and near misses: reported in two minutes, triaged the same day, serious ones signed off.

| Level | Gives |
| --- | --- |
| Report | report at their sites and follow their own reports |
| Investigate | also every report at their sites, the serious-report alert, triage, close low-risk ones. Never their own |
| Manage | also close serious and moderate reports. Never their own |

Connects: person file and subject records.

## Team

### Rota
*Module `rota` · `/rota/overview` · reach: sites · data: `rota.prisma`*

Who is on which activity at the sites you cover, with every gap in cover counted.

| Level | Gives |
| --- | --- |
| View | see the rota at their sites |
| Plan | plan the days ahead for their departments |
| Run | run today, change any day for every department, report absences, keep the activity list |

Connects: reads commitments and qualifications; person file; shift-change emails through Turnfin Me.

### Training
*Module `training` · `/training/overview` · reach: sites · data: `training.prisma`*

Training for the people you cover: what is due, waiting for sign-off and done. People take their own training in Turnfin Me.

| Level | Gives |
| --- | --- |
| Trainer | sign off practical training at their sites |
| Author | also build and publish courses |
| Manage | also assign courses and check certificates |

Connects: writes qualifications; person file, subject records, Turnfin Me.

### Docs
*Module `docs` · `/docs` · reach: everywhere · data: its own database*

Staff documents to read, write and approve, and who has read them. Every role is a Docs team, so a document can be aimed at a role.

| Level | Gives |
| --- | --- |
| Read | the documents aimed at their role |
| Write | draft documents and send them for approval |
| Manage | aim documents at roles and see who has read them |
| *Extra:* Can approve documents | approve and publish colleagues' documents, never their own |

### HR
*Module `hr` · `/hr/overview` · reach: the people they manage, or everyone · data: its own database*

Restricted staff files: details, employment, notes and performance reviews.

| Level | Gives |
| --- | --- |
| Their team | files, notes and reviews for the people they manage |
| Everyone | the same for everyone |

Only a superadmin gives HR. Administrators never inherit it. Every read and write needs a fresh sign-in, is logged (`access_events`), and the subject export is superadmin-only.

## Managers

### CCTV log
*Module `cctv` · `/cctv/overview` · reach: sites · data: `cctv.prisma`*

A record of every time CCTV footage is checked: who, why, what they looked for and what they saw.

| Level | Gives |
| --- | --- |
| Record | record each check at their sites and read their own entries |
| Review | also read every entry at their sites and add notes |

### Site Monitoring
*Module `site-monitoring` · `/site-monitoring/overview` · reach: sites · data: `site-monitoring.prisma`*

What managers need to act on at their sites, raised automatically.

| Level | Gives |
| --- | --- |
| View | see the actions raised at their sites and what was done |
| Act | also close an action by saying what was done, or open it again |

Listens to `tasks.reading.out_of_range`.

### Maintenance
*Module `maintenance` · `/maintenance/overview` · reach: sites · data: `maintenance.prisma`*

What is broken at each site, from the first report until it is fixed. The maintenance team works in Trackplan, their own tool. Turnfin asks whether a problem is already in Trackplan, and keeps a Trackplan reference if one is given. It never connects to Trackplan ([D14](decisions.md)).

| Level | Gives |
| --- | --- |
| Report | report a problem at their sites, and see every request there, so nothing is reported twice |
| Manage | also put requests in Trackplan, correct them, mark them fixed, close them not fixed, and open them again |

A request is **Reported**, **In Trackplan**, **Fixed** or **Closed, not fixed**. It starts In Trackplan when the reporter answers that it is already there. "Could hurt someone" always makes it Urgent.

Connects: subject records; area renames.

### Analytics
*Module `activities` · `/analytics` · reach: sites · data: reads the swim school's and desk measures*

The swim school's Business, Reception and Pool deck dashboards.

| Level | Gives |
| --- | --- |
| View | the dashboards for their sites and every report behind them |

## Back office

### Purchasing
*Module `purchasing` · `/purchasing/overview` · reach: sites · data: `purchasing.prisma`*

Purchase orders with approved suppliers, approved by role and amount, numbered per site.

| Level | Gives |
| --- | --- |
| View | see their sites' orders, and approve those their role may approve |
| Request | raise purchase orders at their sites |
| Manage | suppliers, approved products and prices, and who approves up to what |

Approval by role and amount is data, not a role check in code. With jobs it means "holds that role at the order's site".

### Stock
*Module `stock` · `/stock/overview` · reach: sites · data: `stock.prisma`*

Count what is on the shelf at each site, keep the product list and compare two counts.

| Level | Gives |
| --- | --- |
| View | see counts, the product list and comparisons |
| Count | also start, count and submit a count |
| Manage | also keep the product list and categories, delete a count |

### Admin
*The platform (`src/modules/registry.ts`) · `/core` · reach: everywhere · data: `core.prisma`, `base.prisma`*

People, roles, sites, the shared setup lists and the activity log. Superadmins also switch apps on, off or on at some sites, at Admin › Apps ([architecture.md](architecture.md#app-switches)); that is the superadmin flag, not a level.

| Level | Gives |
| --- | --- |
| Setup | see the shared setup lists; the extras choose which they keep |
| Manage | people, roles, sites, every setup list and the activity log. Also Manage in every other app except HR |
| *Extras:* Keeps departments, positions, the qualifications list, the activity list, sites' areas | add, rename and archive that list |

## Rules that protect people

These hold in every version of every screen.

**Who sees which swimmer fields.** `src/modules/activities/shared/classification.ts` tags swimmer fields (`medical`, `contact`, `emergency`, `staff-note`) and decides who receives each:

| Screens | Who | Medical notes |
| --- | --- | --- |
| Swim school office and desk | swim school managers, reception | yes |
| Pool deck | instructors | only for swimmers in a class they teach or cover that day |
| Parent app | linked guardians | never; they propose corrections, which staff apply or decline |
| Anyone else | roles with no swim school level | never: no swimmer data at all |

A withheld note becomes a `hasMedicalNotes` flag, so the deck still knows to ask.

**The pool deck** is tablet-sized, with no desk navigation, no links to desk pages and no cross-site swimmer search. Its only lookup (`/instructor/swimmers`) finds swimmers with a current place at the working site. Every class needs a confirmed start for that date; once started, anyone with the teaching permissions can help, and a start never gives exclusive ownership. The atomic start record, its audit row and the save-conflict checks stay.

**Nobody decides their own** refund, coinage request, document approval or incident.

**HR stays restricted** (above), and its database holds ids only: access is decided in the main database by the policy engine.

## Adding an app

A new app is one area of the business whose purpose fits one sentence without "and". It is one new module folder with the six-part contract and one line in `src/app/modules.ts`, changes no platform file, works with every other app switched off, and goes live at one site first (Admin › Apps). The owner approves every new app; record it in [decisions.md](decisions.md) and add it to this page. The checklist is in [../AGENTS.md](../AGENTS.md).
