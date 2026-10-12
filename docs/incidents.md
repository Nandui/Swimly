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

`reported` → `investigating` → `closed`, with a fast close from triage and a reopen back to
`investigating`.

1. **Report** (`/incidents/new`, anyone with Report at the site). What kind, what it was about,
   where and when, who told the reporter (when they didn't see it themselves), what happened
   (facts, in their words), what was done straight away, the people involved (injury and
   treatment only if hurt) and witnesses. Sending locks the words;
   later corrections are **addenda** with a name and time, open to the reporter and to anyone
   who triages it, even after closing.
2. **Serious alert.** A report is serious when anyone involved went by ambulance or to
   hospital or a doctor, or its category always is (rescue from the water, chemical, lost
   child). The email goes at once to everyone whose role has Incidents **Investigate** or
   **Manage** at the site (no sites ticked means every site): the centre manager and the
   operations manager, names nobody and carries no injury details. Each email
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
   An investigated report also needs every action done or cancelled, and a serious or
   moderate one needs its root cause recorded. Closing locks the report.

## Investigating (phase 2)

Everything below is on the report's page while it is under investigation, for anyone with
Investigate at the site except its reporter.

- **Witness statements.** Who gave it, as what (witness, staff member, the person hurt),
  the day it was taken and their words. Kept as written, with who recorded it.
- **Why it happened.** Up to five "why?" answers, one appearing as each is answered, then
  the root cause in a line. The cause, not who to blame. Serious and moderate reports cannot
  close without it.
- **Actions.** What will change, who does it (anyone active at the report's site) and by
  when (from today, within a year). The owner gets an email when it is given to them, the day
  before it is due and the day after it was due, once each (Vercel cron
  `/api/cron/incidents`, 06:00 UTC, `CRON_SECRET`). Emails carry the action's words and the
  report number, never who was hurt; a failed email shows on the action. The owner sees open
  actions under **Your actions** on Reports and on Home, and can mark one done there, with a
  note, without opening the report. Investigators can mark done or cancel any action. An
  owner who has no Incidents level still gets the emails, but must tell the investigator
  when it is done.
- **Photos and files.** JPEG, PNG, WebP or PDF, up to 4 MB each and 10 per report, checked
  by their contents, stored in the database like refund receipts (`incidents_files`). The
  reporter and investigators add them while the report is open; whoever added one, or an
  investigator, can remove it (it is hidden, never erased). Closed reports keep theirs.
  Opening someone else's file is logged like opening their report.
- **Reopen.** A Manage holder who did not file it can reopen a closed report with a reason,
  for example new evidence or an action that did not work. It goes back to investigation,
  the closing note and HSA reference are cleared for the new close, and the reason shows
  in the history to everyone who sees the report.

The reporter sees their report, addenda, files and the closing note, never the statements,
the whys or the actions.

## Who reports

Only **duty managers, shift supervisors, department supervisors, centre managers and
operations managers** file reports (owner decision, 12 October 2026). Lifeguards,
instructors, desk staff and everyone else tell the supervisor or duty manager on shift, who
files it and names them under "Who told you about it".

The **centre manager** and the **operations manager** triage: every report at their sites waits
for either of them, and whoever gets to it first does it. The **operations manager** is the
health and safety lead, who signs off serious and moderate reports.

Turnfin checks permissions, never role names, so this is set in Admin:

| Role | Incidents level |
| --- | --- |
| Duty manager, shift supervisor, department supervisor | Report |
| Centre manager | Investigate |
| Operations manager | Manage |
| Everyone else | none |

Nobody triages or closes their own report, so a report the centre manager files goes to the
operations manager and the other way round. A serious report the operations manager files
needs another Manage holder at the site to close it.

## Who sees what

| Level | Permission | Sees |
| --- | --- | --- |
| Report | `incidents.reports.create` | Their own reports, in full, and how they were closed |
| Investigate | `incidents.reports.review` | Every report at the sites they cover, injury details included; the serious alerts; triage and closing low-risk ones; statements, the root cause and actions |
| Manage | `incidents.reports.signoff` | Also closing serious and moderate reports, reopening closed ones, and who opened each report's injury details |

Reach is the sites a person works at. Opening someone else's report that names people writes
an `incidents_access_events` row. Every change writes one audit row under Incidents.

## Pages

Overview (`/incidents/overview`, the starter page: reports to triage, serious ones to sign off,
investigations, Report an incident), Report (`/incidents/new`), Reports (`/incidents`: your
actions, to triage, under investigation, your reports, recently closed) and a report
(`/incidents/[id]`). Files are served by `/api/incidents/files/[id]` and added through
`/api/incidents/files`.

## Decided (11 October 2026)

- Its own module, **Incidents**, in the Poolside group.
- **Safeguarding concerns are not incident reports.** The form sends the reporter to the
  Designated Liaison Person (Children First); nothing about the concern is stored here.
- **The main database**, with injury details in their own table and every read logged.
- **Named reports only**, with the no-blame promise on the form.
- The pool deck gets no report button until phase 3, and Fernando is asked then. Since only
  supervisors and managers report (12 October 2026), it would serve only them.

The HSA rules and retention periods were written from Irish rules as understood, not
confirmed: the H&S adviser checks them before launch.

## Coming next

- **Phase 2** (above, 1.7.0): witness statements, root cause (5 whys), corrective actions
  with owners, due dates and reminders, a reopen with a reason, photos and files.
- **Phase 3:** insights (trends by site, area, kind and hour, near misses per accident), an
  export of one report for the insurer, retention rules, `incidents.action.raised` for Tasks,
  a section in HR's personal file for staff injuries, links to the site's emergency action
  plan in Docs, and the pool deck button if approved.
