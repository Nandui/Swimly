# 0008: Add the Incidents module

**Status:** Accepted (11 October 2026, Fernando chose "Go" on the plan; final when he merges the PR).

## Context
Fernando asked (11 October 2026) for a brand new module to report incidents, accidents and near misses, with the flows and best practices planned first. The plan (lifecycle, swimlanes, triage rules, levels, data and phases) is in the Artifact "Turnfin Incidents Plan" and [docs/incidents.md](../../incidents.md). A new module changes the module map, which CLAUDE.md asks the owner to approve.

## Decision
- A new module `incidents` in the Poolside group: `src/modules/incidents` with features `report`, `triage`, `reports` and `workspace`, routes in `src/app/incidents`, starter page `/incidents/overview`.
- Levels Report, Investigate and Manage at the sites a person works at (`incidents.reports.create`, `.review`, `.signoff`). Nobody triages or closes their own report. Only duty managers, shift and department supervisors, centre managers and operations managers report (owner decision, 12 October 2026); the centre manager (Investigate) or the operations manager (Manage, the health and safety lead) triages. That is role configuration in Admin, not code; the report records who told the reporter, and serious alerts go to everyone who triages at the site.
- Tables in the main database, prefixed `incidents_` (CLAUDE.md section 5), with model names prefixed `Incident` (ADR 0002). Injury details sit in their own table, and reads of them are logged.
- Safeguarding concerns stay out of the module; reports are named; no pool deck button until phase 3.
- Built in three phases; this one is reporting, serious alerts and triage.

## Consequences
Adding the module needed no change to `src/platform`. Core gained the usual catalogue entries (three permissions, one screen, the audit module name). No other module is called, and Incidents works with every other module switched off.
