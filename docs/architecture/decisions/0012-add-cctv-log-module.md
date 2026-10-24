# 0012: Add the Managers group and the CCTV log module

**Status:** Accepted (20 October 2026, Fernando asked for it; final when he merges the PR).

## Context
Fernando asked (20 October 2026) for "a new group of modules for managers", the first a record of
CCTV viewings: who checked, why, the purpose and what was seen. A new group and module change the
module map, which CLAUDE.md asks the owner to approve; his request is that approval. The rules are
in [docs/cctv.md](../../cctv.md).

## Decision
- A new group `managers` ("Managers") in `MODULE_GROUPS`, between Team and Back office. Like every
  group it is presentation only. Further managers' modules (Site Monitoring is next) join it.
- A new module `cctv` ("CCTV log") in that group: `src/modules/cctv` with features `viewings` and
  `workspace`, routes in `src/app/cctv`, starter page `/cctv/overview`.
- Levels Record and Review at the sites a person works at (`cctv.record`, `cctv.review`). Not
  restricted, so administrators hold it, as with Incidents.
- Tables in the main database, prefixed `cctv_` (CLAUDE.md section 5), models prefixed `Cctv`
  (ADR 0002), with no relations to Core tables.
- Entries are locked once saved and never deleted; later facts are notes. The activity log names
  the entry and its reason, never what was seen.
- It links to an incident report by number only. It can't read Incidents' tables, so Incidents
  gained `/incidents/number/[number]`, which opens the report and leaves the access check to the
  report's own page.

## Consequences
Adding the module needed no change to `src/platform`. Core gained the usual catalogue entries (two
permissions, one screen, the audit module names, the group). No other module is imported, and the
CCTV log works with every other module switched off; with Incidents off, the incident number shows
as text.
