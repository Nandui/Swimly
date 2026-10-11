# Incidents

Owner request, 11 October 2026: a module to report accidents, incidents and near misses,
with the flows and best practices planned before the features. The plan, its flow graphs
and the decisions behind it are in the Artifact "Turnfin Incidents Plan"
(https://claude.ai/artifact/GgK3T64QnuKfpvH3rd4V3E). Fernando approved the module and its
defaults on 11 October 2026 ([ADR 0008](architecture/decisions/0008-add-incidents-module.md)).

- **Accident:** someone was hurt or became ill.
- **Incident:** something went wrong and nobody was hurt (contamination, a chemical, a lost
  child, aggressive behaviour, an evacuation, damage).
- **Near miss:** it could have hurt someone and didn't.

## The flow

`reported` → `investigating` → `closed`, with a fast close from triage.

1. **Report** (`/incidents/new`, anyone with Report at the site). What kind, what it was about,
   where and when, what happened (facts, in their words), what was done straight away, the
   people involved (injury and treatment only if hurt) and witnesses. Sending locks the words;
   later corrections are **addenda** with a name and time, open to the reporter and to anyone
   who triages it, even after closing.
2. **Serious alert.** A report is serious when anyone involved went by ambulance or to
   hospital or a doctor, or its category always is (rescue from the water, chemical, lost
   child). The email goes at once to everyone whose role has Incidents **Manage** at the site
   (no sites ticked means every site), names nobody and carries no injury details. Each email
   is a row in `incidents_notifications`; a failure shows on the report as a warning.
3. **Triage** (Investigate, never your own). Two severities on one 1 to 5 scale: what happened
   and the worst that realistically could have; the worse of the two is the level. Three HSA
   questions (staff off more than 3 days not counting the day, a member of the public to a
   doctor or hospital, a death or dangerous occurrence); any yes makes it reportable with a
   deadline 10 working days after the day it happened (weekends skipped, public holidays not).
   When a child was involved, who told the parent or guardian and when. Then **Close it now**
   (level 1 or 2 and nothing for the HSA) or **Investigate**.
4. **Close** (never your own): what was found and what changed, written for the reporter too,
   who sees it on their report. A serious report or one at level 3 or worse needs **Manage**
   at the site; a reportable one needs the HSA reference (IR1 or IR3) or the date it was sent.
   Closing locks the report.

## Who sees what

| Level | Permission | Sees |
| --- | --- | --- |
| Report | `incidents.reports.create` | Their own reports, in full, and how they were closed |
| Investigate | `incidents.reports.review` | Every report at the sites they cover, injury details included; triage and closing low-risk ones |
| Manage | `incidents.reports.signoff` | Also the serious alerts, closing serious and moderate reports, and who opened each report's injury details |

Reach is the sites a person works at. Opening someone else's report that names people writes
an `incidents_access_events` row. Every change writes one audit row under Incidents.

## Pages

Overview (`/incidents/overview`, the starter page: reports to triage, serious ones to sign off,
investigations, Report an incident), Report (`/incidents/new`), Reports (`/incidents`: to
triage, under investigation, your reports, recently closed) and a report (`/incidents/[id]`).

## Decided (11 October 2026)

- Its own module, **Incidents**, in the Poolside group.
- **Safeguarding concerns are not incident reports.** The form sends the reporter to the
  Designated Liaison Person (Children First); nothing about the concern is stored here.
- **The main database**, with injury details in their own table and every read logged.
- **Named reports only**, with the no-blame promise on the form.
- The pool deck gets no report button until phase 3, and Fernando is asked then.

The HSA rules and retention periods were written from Irish rules as understood, not
confirmed: the H&S adviser checks them before launch.

## Coming next

- **Phase 2:** witness statements, root cause (5 whys), corrective actions with owners, due
  dates and reminders, a reopen with a reason, photos and files.
- **Phase 3:** insights (trends by site, area, kind and hour, near misses per accident), an
  export of one report for the insurer, retention rules, `incidents.action.raised` for Tasks,
  a section in HR's personal file for staff injuries, links to the site's emergency action
  plan in Docs, and the pool deck button if approved.
