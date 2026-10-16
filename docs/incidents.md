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
   and the worst that realistically could have; the worse of the two is the level. Four HSA
   questions (a staff member unable to do their normal work for more than 3 days in a row, not
   counting the day; a member of the public taken from the scene to a hospital or doctor for
   treatment; a dangerous occurrence; a death). Any yes makes it reportable with a deadline
   10 working days after the day it happened, or 5 after a death, which must also be phoned
   through to the HSA or the Gardaí at once (weekends skipped, public holidays not, so the
   date is never later than the law's).
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

## Insights, the full record and HR (phase 3)

- **Insights** (`/incidents/insights`, Investigate and Manage, 404 for everyone else): the last
  3, 6 or 12 months at all the sites they triage, or one of them. Reports, near misses per
  accident (more is healthier: people report before someone is hurt), serious ones, HSA
  reports, overdue actions; bars by month, kind, category, area, hour of the day, severity level
  and site. Counts only, never names or injuries.
- **Full record** (`/incidents/[id]/export`, Manage at the site, never your own report): the
  whole report, people and injuries, triage, statements, whys, actions, closing, file names and
  history, laid out to print or save as a PDF for the insurer or a solicitor. Every opening is
  in the report's history ("Opened for the insurer") and the audit log. Files are sent from the
  report page if asked for.
- **Keeping period:** Manage holders see on Insights the closed reports past their keeping
  period, 10 years from the day (reg. 226) or 21 when a child was involved (a child's claim can
  come after they turn 18). Nothing is deleted, by Turnfin or from this list: removing a
  report waits for an owner decision, with the insurer.
- **HR:** when a staff member is involved, the reporter picks them from the site's team (or
  types a name if they are not listed). Their incidents, injuries and treatment then show on
  their HR personal file under "Incidents and injuries at work", and in their subject access
  export with the reports they filed. Only a person on the site's team is ever linked.
- **Emergency plans:** the report form's "Make it safe first" note links to the site's
  emergency action plans in Docs (`/docs/library?type=EAP&facility=<site>`) for people who can
  read Docs. A link, never an import.

Not built, by decision: a report button on the pool deck (Fernando, 12 October 2026: no
button; the pool deck stays apart from the desk). Incident actions are not copied into Tasks:
they already have owners, due days and reminders, and a copy would be a second list to tick.

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

Nobody closes or investigates their own report, and only a Manage holder at the site
triages their own (owner decision, 13 October 2026: the operations manager triages his own).
So a report the centre manager files goes to the operations manager for triage. A report the
operations manager files he triages himself; if it needs investigating, the centre manager
investigates it, and a serious one needs another Manage holder at the site to close it.

## Who sees what

| Level | Permission | Sees |
| --- | --- | --- |
| Report | `incidents.reports.create` | Their own reports, in full, and how they were closed |
| Investigate | `incidents.reports.review` | Every report at the sites they cover, injury details included; the serious alerts; triage and closing low-risk ones; statements, the root cause and actions |
| Manage | `incidents.reports.signoff` | Also closing serious and moderate reports (only the operations manager holds it, owner decision 12 October 2026), reopening closed ones, the full record for the insurer, reports past their keeping period, and who opened each report's injury details |

Reach is the sites a person works at. Opening someone else's report that names people writes
an `incidents_access_events` row. Every change writes one audit row under Incidents.

## Pages

Insights (`/incidents/insights`, those who triage), the full record (`/incidents/[id]/export`,
Manage), Overview (`/incidents/overview`, the starter page: reports to triage, serious ones to sign off,
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

## Irish law (checked 12 October 2026)

Fernando asked for everything to be within Irish law. Checked against the Safety, Health and
Welfare at Work (General Application) Regulations 2007, Part 14, as replaced by
[S.I. 370/2016](https://www.irishstatutebook.ie/eli/2016/si/370/made/en/print), and the HSA's
[guide to reporting](https://hsa.ie/eng/topics/accident_and_dangerous_occurrence_reporting/accident_and_dangerous_occurrences_reporting_2022.pdf):

- **What is reported (reg. 225):** an employee unable to do their normal work for more than
  3 consecutive days, not counting the day; a person not at work taken from the scene to a
  hospital or medical facility for treatment; a death; a dangerous occurrence in Schedule 15
  (item 7, an uncontrolled release of any substance that could injure someone, covers a
  chlorine release). The triage questions follow these words.
- **When:** as soon as reasonably practicable and within 10 working days; a death is told to
  the HSA or the Gardaí at once by the quickest means, with the written report within 5
  working days. Turnfin shows the earlier deadline and the phone reminder.
- **Records (reg. 226):** kept for 10 years from the date. Turnfin deletes nothing, so this
  is met; a longer period for children (who can claim after turning 18) is for the phase 3
  retention rules, with the insurer.
- **Data protection (GDPR, Data Protection Act 2018):** injury details are health data, so
  they sit in their own table, every read of someone else's report is logged, emails carry
  no names or injuries, and the reporter sees only their own reports.
- **Children First Act 2015:** safeguarding concerns go to the Designated Liaison Person, not
  this form.

Turnfin helps record and remind; the legal duty to report stays with the employer. The
H&S adviser should still look over the wording before launch.

## Coming next

- **Phase 2** (above, 1.7.0): witness statements, root cause (5 whys), corrective actions
  with owners, due dates and reminders, a reopen with a reason, photos and files.
- **Phase 3** (above, 1.8.0): insights, the full record for the insurer, the keeping period,
  staff injuries on the HR file and links to the site's emergency plans.

## The report page's look

The report page (`/incidents/[id]`) was redesigned with the high-end-visual-design taste skill
(16 October 2026, like the rota Plan and the refund request page). The case card at the top holds
the kind and category, where and when, the level it is handled at with meters for what happened
and what could have, and the four steps (reported, triaged, investigating or not needed, closed).
Beside it from 1024px, and straight after it on phones, **What happens next** says whose move it
is from the same `can` flags the page already uses, with a jump link to the triage, investigation
or close form, the investigation checklist and the HSA deadline with days left (this replaces the
HSA notice above the report). Then the account as written, the people, triage, files, the
investigation and closing, with the history as a timeline in the side column. Cards are double
bezels drawn with shadows so the existing form panels take them too; styles live in
`src/app/incidents/incidents.css`, scoped to `.inc-file`. Motion is a spring on transform and
opacity that stops for reduced motion. Visual only: the data, actions, permissions, read log and
audit are unchanged.

