# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the staff of LeisureWorld's swim school at two Cork pools,
Bishopstown and Churchfield.** Two jobs, confirmed 2 Sep 2026:

- **Reception and desk staff.** Find a family in seconds, enrol a child, move
  them, book an assessment, answer the parent standing at the counter. On a
  desktop at the desk, or on a phone anywhere in the building.
- **Swim instructors on the pool deck.** Open today's classes, take the
  register, tick competencies, take over a class that is not theirs when they
  are the one standing at the pool. On a phone or tablet, poolside.

**Managers and administrators** set the building up rather than use it all
day: staff accounts, roles and permissions, the curriculum, the clubs.

**Not users:** parents and children. There is no parent-facing side and none
is planned; "parents can book" means the desk books on their behalf.

**Conditions the users work in (confirmed):**

- Wet hands and glare on the deck. Bright at noon, dim at seven in the evening.
- Mixed comfort with technology. Some staff are not confident with apps.
- Some staff whose first language is not English.
- Poolside wifi drops. A save has to survive that.

## Product Purpose

Swimly is the tool the swim school runs on: the weekly timetable, who is in
which class, the register taken on the deck, each child's progress through the
club's own levels and competencies, assessment sessions for new swimmers, and
the same for both sites without one seeing the other's swimmers.

It replaces the club's legacy booking system, whose data reached us only as
printed timetables. That system knew who had paid for which class and nothing
else.

**Scope, confirmed:** swim lessons, done properly, for now. Other kinds of
booking (camps, pool hire, fitness classes) are deliberately out of scope until
the swim school runs on Swimly.

**Success (to confirm with the owner):** both sites run a full term on it, every
class is marked on the deck the day it runs, and the desk answers parents
without opening the old system.

## Positioning

**Registers and cover on the deck** is the thing the old system could not do
and Swimly must get right (confirmed as the one edge that matters). A class is
marked on a phone, two taps from Today, and the record says who actually
taught it: cover is declared by the person at the pool and written as a fact
on the row, not arranged by an administrator who has gone home.

Two mechanisms a booking system cannot truthfully copy:

- Attendance and progress are one record per child, tied to the club's own
  curriculum. Every competency mark carries who made it and when.
- Who taught a class is stated, kept and readable on the register, the deck
  screen and the activity trail. Nothing about it is inferred.

Secondary strengths: competency-based progression with a person confirming
each level; two sites in one app with shared staff.

## Operating Context

- **Two sites**, each with its own timetable, curriculum, swimmers and
  assessment sessions. Staff and roles are shared. The club being worked in is
  chosen per device and shown on every screen.
- **Weekly classes** of 30 minutes, Monday to Saturday, in the Learner Pool
  and numbered lanes of the main pool. Bishopstown runs afternoons; Churchfield
  runs afternoons Monday to Friday and Saturday mornings. There are no term or
  session rows; the register is keyed on class, date and child.
- **Assessment sessions** are dated one-offs (the club calls them "Swim School
  Assessments", level "Pre-Assessments"), free, with a fixed number of places.
  A child booked on one is placed at a level afterwards, which earns that level
  and every level below it.
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
- **The register and the checklist save as one action for the whole class**,
  and the register mirrors itself locally so marks survive a dropped
  connection or a closed tab.

## Capabilities and Constraints

**Built and in use:** Today deck screen (own classes and every class running,
grouped by time or level) with self-declared cover; registers that start
everyone absent; per-class competency checklist; eligibility, confirmed level
completion and move-up; enrolment with a capacity lock and a reason for
out-of-sequence placement; waitlist and transfers; Together (a time that suits
every child in one family); assessment sessions, bookings and placements;
swimmer profiles (header, medical strip, contacts, tabs); timetable with
filters, opening on today; programmes, levels and competencies (archived, never
deleted); staff accounts, admin-defined roles from a permission catalogue;
clubs and the switcher; the audit log; account settings with light and dark
mode.

**Constraints that hold:**

- One database serves development and production. Schema changes are
  additive; nothing is dropped while production may read it.
- A role names the screens its holders can open at all, so an instructor
  role can be the deck and nothing else. Within those screens, reads are
  open; every permission is the power to change something, or to read the
  audit log.
- Every mutation writes an audit row, scripts included.
- Nothing refers to a role by name; the club may rename or delete any role.
- Swimmers are never moved between clubs. Copying a programme copies the
  curriculum only.
- Prices, payments and blocks are not modelled.
- Imported swimmers have no date of birth, only an age as at the import date,
  and no contacts; both arrive as the desk fills them in.
- The interface is English only today.

**Explicitly undecided:**

- **The product's name.** "Swimly" is a working name and will change. Nothing
  may be built around the word; the name lives in one place.
- Whether LeisureWorld's name or logo must appear inside the app. Deferred to
  the rename.
- The definition of a finished term (see Success above).
- Other kinds of booking: out of scope now, shape unknown.
- Translation of the interface: not decided; plain English is the confirmed
  requirement.

## Brand Commitments

- **"Swimly" is a working name only** (confirmed 2 Sep 2026). It will be
  renamed. Keep the name in one place, never in copy that would have to be
  rewritten, and build nothing on the word itself.
- No logo asset exists. LeisureWorld branding is not required inside the app
  yet; that question is deferred to the rename.
- Voice, derived from confirmed user needs rather than a style guide: plain,
  short, concrete sentences; the club's own words; British and Irish spellings
  (enrol, programme, register); no idioms; an error is one sentence saying
  what to do.

## Evidence on Hand

- **Real data, in the live database:** 1,803 swimmers, 232 weekly classes,
  assessment sessions and bookings for both sites, imported from the club's
  legacy system by the scripts under `scripts/import-*.ts`, each of which
  records what it kept, flagged and left out. These are real children's names
  and contacts and must never appear outside the app, in screenshots, or in
  marketing.
- Four real staff accounts.
- The legacy system's printed timetables (the import sources) are held by the
  owner, not in the repository.
- **Absent, and not to be invented:** testimonials, case studies, press,
  usage figures, pricing, a launch date, a public website.

## Product Principles

1. **The deck comes first.** Anything an instructor does poolside works
   one-handed on a phone, two taps from Today, with wet hands, in glare and
   in the dark, and survives a dropped connection.
2. **Say who did what.** Every mark, register and cover carries a name and a
   time. Nothing about who taught a class is inferred.
3. **The club's words and the club's ladder.** Programmes, levels, kinds of
   assessment, member numbers and names are the club's, kept exactly; the
   app never renames the club's facts, and a person corrects them.
4. **Plain words, few steps.** Written for staff with mixed comfort with
   technology and mixed first languages: common words, one idea per sentence,
   errors that say what to do, and nothing that can be broken by a wrong tap.
5. **Sites stay separate, people are shared.** Every list is one club's; staff
   and what they may do span both.

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
