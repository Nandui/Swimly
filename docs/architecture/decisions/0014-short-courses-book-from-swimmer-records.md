# 0014: Short courses and the Academy book people from the swimmer records

**Status:** Accepted (21 October 2026, Fernando: "on short courses, the enrolment of candidates or participants needs to be done via the database of swimmers. So member id and all that is needed, make this possible."; final when he merges the PR).

## Context
Short courses (ADR 0009) and the Academy (ADR 0011) kept their own people: a typed name, phone, email and date of birth on each booking, with no member number and nothing joined up with the swim school's swimmer records (`Student`), which hold member numbers, contacts, emergency contacts and medical notes. A person on three courses was three unrelated rows. The swim school owns `Student`, and a module never imports another module or reads its tables (CLAUDE.md, sections 3 and 5).

## Decision
- A new seam in `src/modules/contributions.ts`: the **member directory** (`registerMemberDirectory`, `members`). The swim school registers it from `module.ts` (`features/students/server/members.ts`): search (name, member number, date of birth, a contact's name, email or phone), read by id (medical notes only when the caller says its viewer may read them) and add (refusing the same name and date of birth, or a member number in use; audited by the swim school as added from the calling module). A direct call, not an event, because the booking needs the answer to continue.
- A second seam, **member history** (`registerMemberHistory`, `memberHistoryFor`): Short courses reports the short courses and Academy courses a swimmer has been on, and the swimmer's profile lists them under Details. The two directions go through seams, so neither module imports the other.
- `ShortCourseParticipant` and `AcademyCandidate` gain an optional `swimmerId` (a plain id, no relation), migration `20261129150000_short_courses_swimmers`, additive. Name, phone, email and date of birth stay on the booking, copied from the record each time it is saved, so the booking site's My bookings, the emails and a switched-off swim school keep working. A place held online keeps the email and phone it was booked with.
- Every new booking is someone on the records, picked or added. Academy staff candidates stay staff. Older bookings keep working and can be linked; confirming an Academy place held online (a call logged as paid) links it.
- Medical notes are shown on a booking to anyone working that course at its site (View books them, Instructor teaches them), in the person's dialog and never in a list. This extends the swim school's rule (reception and swim school managers, and the instructors teaching the swimmer) to the people booking and teaching these courses.

## Consequences
Adults on gym and lifeguard courses become swimmer records, so the Swimmers list includes them. Short courses still works with the swim school switched off (`members()` is null; names are typed). Adding the seams needed no change to `src/platform`.
