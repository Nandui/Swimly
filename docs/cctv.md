# CCTV log

Owner request, 20 October 2026: "a new group of modules for managers, the first is a record of
CCTV view, it needs to allow a record of who checked, why was it checked, what was the purpose and
what was seen during the investigation". ADR 0012 records the decision. It is the first module in
the **Managers** group.

Why it exists: under data protection law footage may only be looked at for the reason it is kept
(safety, security, investigating incidents), and the centre must be able to show who looked at it,
why and what happened to any copy. One entry per viewing is that proof.

## The model (`prisma/schema/cctv.prisma`)

| Concept | Table | What it is |
| --- | --- | --- |
| Viewing | `CctvViewing` (`cctv_viewings`) | One time footage was checked, numbered CCTV-00001 on: the site, when it was watched, who checked it and anyone else watching, the reason (from `CCTV_REASONS`), what led to the check, what they were looking for, the cameras and the stretch of footage, what was seen, any copy saved or handed over, an optional incident report number, and who recorded it. |
| Note | `CctvViewingNote` (`cctv_viewing_notes`) | Something added later, with who added it and when. |

Dates and clock times are the site's own, as text (like Incidents), so nothing shifts across time
zones. The tables keep plain ids and read Core only through its functions. The migration
`20261127120000_cctv_viewings` only adds the two tables.

## Rules
- **Locked once saved.** There is no edit and no delete. A correction or a later fact (the Gardaí
  collected the copy) is a note under the entry.
- **Reasons:** an accident or incident, a complaint, theft, loss or damage, a safeguarding concern,
  staff conduct, a Garda request, an insurance or legal claim, someone asking for footage of
  themselves, or something else.
- **Checks:** the day watched can't be in the future, the footage can't be from after that day, its
  end must be after its start, and an incident number reads as INC-00042 or 42.
- **The activity log** names the entry, the site and the reason, never what was seen.

## Who sees what
- **Record** (`cctv.record`, at the person's sites): record viewings at those sites, read their own
  entries anywhere and add notes to them.
- **Review** (`cctv.review`, at the person's sites): also read every entry at those sites and add
  notes to them.
- Nobody else, so an entry outside both is "not found". Administrators hold both, as with every
  module that is not restricted.

## Screens
- `/cctv/overview`: the starter page; Home shows **Record a CCTV viewing** as a quick action.
- `/cctv`: the log, newest first. Review sees "Recorded by others" above "Recorded by you".
- `/cctv/new`: the form, in three parts: who and when, why, what was watched and seen.
- `/cctv/[id]`: one entry as saved, its notes, and **Add a note**. The incident number links to
  `/incidents/number/[number]` for people who can open Incidents.
