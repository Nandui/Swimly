# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Turnfin is for LeisureWorld's own staff, and only LeisureWorld** (owner confirmed 5 October
2026: one organisation, its sites in Cork; not offered to other centres). Everyone who works
in the centre signs in to their role's home page. The jobs, by app:

- **Reception and desk staff** (Swim school, Short courses, Refunds, Coinage). Find a family in
  seconds, enrol a child, move them, book an assessment, answer the parent standing at the
  counter, log a refund request. On a desktop at the desk, or on a phone anywhere in the building.
- **Swim instructors on the pool deck** (Pool deck). Open today's classes, take attendance,
  tick competencies, take over a class that is not theirs when they are the one standing at
  the pool. On a phone or tablet, poolside.
- **Department supervisors** (Rota). Plan their department's days ahead: the activities each
  day needs and who is on each place, then share the week with their staff.
- **Duty managers** (Rota, Swim school, Tasks, Incidents). Run the day: see everything on, when
  and who; give cover when someone is off; record changes, cancellations, checks, incidents and
  returns to work.
- **Lifeguards and other shift staff** (Tasks, Incidents, Docs). Their own shifts, training and
  required reading reach them in Turnfin Me.
- **Finance and the back office** (Refunds, Coinage, Purchasing, Stock) review requests, record
  payments made elsewhere, approve orders and count stock.
- **Trainers and managers** (Training, Docs, HR, the CCTV log, Site Monitoring, Analytics) sign
  off training, keep qualifications and documents current, look after their team's HR records
  (HR is restricted) and follow the site's records and reports.
- **Administrators** set the centre up rather than use it all day: staff, roles with a level
  for each app, sites, the setup lists, the curriculum.

**Outside Turnfin, the connected products.** Each staff member's own things (training, required
reading, qualifications, shifts, what HR shared) are in **Turnfin Me** (`apps/me`) on their
own phone. **Parents and guardians** (owner confirmed 14 September 2026) use the parent app
through a dedicated API: their linked children's progress and booking assessment sessions,
including for children not yet in Turnfin ([parent-app.md](docs/parent-app.md)). The public
books Academy courses on the **Academy booking site** ([academy.md](docs/academy.md)).

**Conditions the users work in (confirmed):**

- Wet hands and glare on the deck. Bright at noon, dim at seven in the evening.
- Mixed comfort with technology. Some staff are not confident with apps.
- Some staff whose first language is not English.
- Poolside wifi drops. A save has to survive that.
- Turnfin runs on the centre's registered computers and tablets; personal phones use Turnfin Me.

## Product Purpose

Turnfin is the app LeisureWorld's centre runs on: one place where each person's role shows
their job across every part of the centre. It is a set of **apps** (Swim school, Rota, HR,
Refunds and the rest) on a shared platform of people, roles, sites and the audit trail. A
role is a job with one level for each app, and its home page shows what needs the person.
See [how Turnfin works](docs/how-turnfin-works.md); where it is going is in
[the direction](docs/architecture/platform-and-apps.md).

It sits beside the systems the centre keeps: **Legend** stays the booking and billing system,
**Timepoint** keeps the roster's hours, clocking and payroll. Turnfin does not send money,
change bills or replace either. The swim school's legacy booking system, whose data reached
us only as printed timetables, is replaced for lessons.

**Scope, confirmed:** the centre's staff work in these apps. Other kinds of booking (camps,
pool hire, fitness classes) stay out of scope; Legend handles bookings.

**Success (to confirm with the owner):** every role starts its day on its Turnfin home page
and finds what needs it there; both sites run a full term of swim lessons on it with every
class marked on the deck the day it runs; and the rota, cover and absences are run from it.

## Positioning

**Each role's job in one place** is the thing the centre's other systems cannot do (owner
confirmed 5 October 2026 as the one edge that matters). Legend knows bookings, Timepoint
knows hours, paper knows the rest. In Turnfin a receptionist, a duty manager, an instructor
and a supervisor each sign in to a home page built for their role, with what needs them today
across every app, and every app checks its own permissions behind it.

Mechanisms a neighbouring product cannot truthfully copy:

- **Roles are jobs with a level per app**, translated into named permissions; the home page,
  the navigation and the cards follow from it, so training a new starter is "this is your role".
  Today each person holds one role; holding more than one job, each at its own sites, is planned
  ([jobs at places](docs/architecture/jobs-and-work-layer.md)).
- **One record, said who did what.** Every mark, register, cover, shift change, refund and
  decision carries a name, a time and, where it matters, a reason, in one audit trail across
  apps.
- **Turnfin and Turnfin Me are separate.** Turnfin on the centre's computers never holds
  personal pages; each person's own things are in Turnfin Me.

The swim school keeps its own edge inside this: **attendance and cover on the deck**. A class
is marked on a phone, two taps from the Pool deck, and the record says who actually taught
it; cover is declared by the person at the pool, not inferred.

## Operating Context

- **Two sites**, each with its own timetable and assessment sessions. Swimmers,
  curriculum, progress, staff and roles are shared. The site being worked at is
  chosen per device and shown on every screen.
- **Weekly classes** of 30 minutes, Monday to Saturday, in the Learner Pool
  and numbered lanes of the main pool. Bishopstown runs afternoons; Churchfield
  runs afternoons Monday to Friday and Saturday mornings. There are no term
  rows; attendance is keyed on class, date and child. Dated cancellation records
  preserve the affected session and roster without changing the weekly class.
- **Assessment sessions** are dated one-offs (the club calls them "Swim School
  Assessments", level "Pre-Assessments"), free, with a fixed number of places.
  A child booked on one is placed at a level afterwards, which earns that level
  and every level below it. A session can set the ages it is for (whole years on
  its date, both ends optional and included); a child outside it, or with no
  date of birth to check, cannot be booked or placed (owner request, 9 October 2026).
- **The curriculum today:** Water Safety & Fun (Starfish, Penguins, Turtles,
  Dolphins), Swimming Skills (Sharks 1, Sharks 2, LeisureWorld Sharks), RLSS
  Lifesaving (Rookies Bronze, Silver, Gold). Credit earned in one programme
  says nothing about another.
- **The club's vocabulary is kept:** member numbers prefixed LWB, LWC or LWD
  for the home facility (Bishopstown, Churchfield, Douglas); "home facility";
  swimmer, class, level, competency, programme, register, cover, placement,
  kind of assessment. Names are transcribed exactly as the club's records
  have them, oddities included, and corrected by a person.
- **The desk sometimes copies a paper sheet in** after the fact, recording a
  register for the instructor rather than taking the class over.
- **Saves survive the poolside wifi:** the register and the checklist save as one action for
  the whole class and keep a local draft ([swim-school.md](docs/swim-school.md)).

## Capabilities and Constraints

**Built and in use.** Each app's doc says what it does in detail ([docs/README.md](docs/README.md)):

| App | In one line |
| --- | --- |
| Swim school | swimmers and profiles, the weekly class browser, the day's Schedule, enrolment with a capacity lock and placement reasons, waitlists and transfers across sites, assessment sessions and placements, Awaiting enrolment and moves with a follow-up history, Together (a time that suits every child in one family), Duty manager and cancelled classes, Legend agreement checks, the curriculum, and the parent app's staff controls |
| Pool deck | today's classes on a tablet, confirmed starts shared with colleagues, attendance, competencies, level completion, Ready to move, today's assessments, and a swimmer lookup |
| Analytics | the swim school's reports for managers: business, classes, swimmers, progression, teachers, Reception activity and instructor attendance |
| Short courses and the Academy | courses the public book, registers, waiting lists, call-backs and the Academy booking site |
| Refunds, Coinage | requests from the desk to finance or accounts, decided and recorded; Turnfin never moves money |
| Tasks, Incidents, the CCTV log, Site Monitoring | each site's daily checks, accident and incident reports, CCTV checks, and the actions they raise |
| Rota, Training, Docs, HR | who works when, courses and qualifications, documents and required reading, staff records and reviews |
| Purchasing, Stock | purchase orders with approval, and stock counts |
| Admin | people, roles, sites and the setup lists |

Staff also have a signed-in [help centre](docs/help-centre.md); it is not a public support
portal and sends no support requests.

**Constraints that hold:**

- Schema changes only add: merging to `main` migrates production under live code, and
  previews use their own development database.
- A role is a job with one level for each app, translated into named permissions; pages and
  actions ask for a permission, never a level or a role name, and nothing refers to a role by
  name ([platform-access.md](docs/platform-access.md)).
- Every change to data writes an audit row, scripts included.
- Swimmers can enrol, waitlist and move between classes at either site; their identity,
  contacts and progress stay on one shared record. The working site filters the timetable;
  it is not a swimmer ownership boundary.
- Prices, payments and blocks are not modelled.
- Imported swimmers have no date of birth, only an age as at the import date, and no
  contacts; both arrive as the desk fills them in.
- The interface is English only today.

**Explicitly undecided:**

- Whether LeisureWorld's name or logo must appear inside the app.
- The definition of a finished term (see Success above).
- Other kinds of booking: out of scope now, shape unknown.
- Translation of the interface: not decided; plain English is the confirmed requirement.

## Brand Commitments

- **The product is Turnfin** (owner confirmed 5 October 2026, final), made of **apps**; each
  person's own product is **Turnfin Me** (owner decision, 24 October 2026: never "Turnfin
  Work", never "module" on screen). "Swimly" is retired as a name: nothing people read says
  Swimly; code identifiers, package names and the repository may keep it.
- The Turnfin fin logo is the brand mark (see DESIGN.md). Whether LeisureWorld branding
  appears inside the app is not decided.
- Voice, derived from confirmed user needs rather than a style guide: plain,
  short, concrete sentences; the club's own words; British and Irish spellings
  (enrol, programme); no idioms; an error is one sentence saying what to do.
- **One word per thing, in every screen.** In what people read: *swimmer* (never student),
  *class* (never course), *attendance* (never register), *competencies* and *marks* for what
  an instructor ticks, *Assessments* only for the club's Swim School Assessment sessions,
  *level*, *programme*, *cover*, *placement*, *site*, *app*. Code identifiers and URLs keep
  their old names (`Student`, `Course`, `Club`, `src/modules`); the words on screen do not.

## Evidence on Hand

- **Real data, in the live database** (counted 5 October 2026): 2,023 swimmers, 242 weekly
  classes, 2,263 enrolments, assessment sessions and bookings for both sites, imported from the club's
  legacy system by one-off import scripts (removed after use; they remain in git
  history). These are real children's names
  and contacts and must never appear outside the app, in screenshots, or in
  marketing.
- 35 real staff accounts. The development database may hold a copy of this real data, so the
  same care applies there.
- The legacy system's printed timetables (the import sources) are held by the
  owner, not in the repository.
- **Absent, and not to be invented:** testimonials, case studies, press,
  usage figures, pricing, a launch date, a public website.

## Product Principles

1. **Each role's job in one place.** A person signs in to their role's home page and finds
   what needs them today across every app. A new feature belongs to an app and a level,
   and shows up for the roles that hold it; it never asks people to go looking.
2. **The deck comes first.** Anything an instructor does poolside works
   one-handed on a phone, two taps from the Pool deck, with wet hands, in glare and
   in the dark, and survives a dropped connection.
3. **Say who did what.** Every mark, register, cover, shift change, refund and decision
   carries a name and a time, and a reason where it matters. Nothing is inferred.
4. **The club's words and the club's ladder.** Programmes, levels, kinds of
   assessment, member numbers and names are the club's, kept exactly; the
   app never renames the club's facts, and a person corrects them.
5. **Plain words, few steps.** Written for staff with mixed comfort with
   technology and mixed first languages: common words, one idea per sentence,
   errors that say what to do, and nothing that can be broken by a wrong tap.

## Accessibility & Inclusion

Confirmed needs, 2 Sep 2026:

- **Wet hands and glare.** Touch targets at least a thumb's height on phones,
  contrast well above the minimum, no hover-only affordances, no drag or
  long-press as the only way to do something, both light and dark usable at
  the pool.
- **Mixed comfort with technology.** Forgiving flows: confirm before anything
  destructive, make the next step obvious, keep the number of steps small.
- **Staff whose first language is not English.** Short common words,
  consistent terms, no idioms or jokes in the interface.

Standing bar in the code, not a client requirement: text contrast 4.5:1 and
control edges 3:1 in both modes, a visible focus ring on everything focusable,
a skip link, and `prefers-reduced-motion` honoured.
