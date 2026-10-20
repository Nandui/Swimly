# Turnfin architecture

Turnfin is a modular monolith: one Next.js app and one main database, in layers. The rules are in [CLAUDE.md](../../CLAUDE.md); progress is in [MIGRATION.md](MIGRATION.md); the audit is in [audit.md](audit.md). The current import and data rules are also described in [../architecture.md](../architecture.md).

## Layers today

| Layer | Folder today | Target folder |
| --- | --- | --- |
| Platform (Core) | `src/lib`, `src/auth.ts`, `src/modules/{registry,contributions,context}.ts`, `src/platform/events` | `src/platform` |
| UI kit | `src/components/{shadcn,ui,ui-kit}`, `form-dialog`, `confirm-action`, `searchable-picker`, the theme in `src/app/theme` | `src/ui` (see ADR 0003) |
| Modules | `src/modules/<id>/{index.ts,manifest.ts,module.ts,events.ts,README.md,shared,features}` | same |
| Front | `src/components/{home,core,workspace}`, `src/lib/home.ts`, `src/lib/staff-api` (Turnfin Me's API) | `src/front` |
| Platform admin screens | `src/components/{people,staff,clubs,devices,setup,help}`, `src/app/(core)` | stays with the platform (ADR 0001) |
| Module list | `src/app/modules.ts`: every module's `manifest.ts` (name, menu entry, levels, permissions), read by Core's registry | same |
| Module wiring | `src/modules/server.ts` loads each `module.ts` plug; `src/modules/session-hooks.ts` | same (ADR 0006) |
| Routes | `src/app` | `src/app` |

## How a module is packaged

Each module is a self-contained package under `src/modules/<id>`: its `manifest.ts` (name, group, levels and the starter page it opens on, its `href`), its `module.ts` plug (home items, person-file sections, commitments), its features and one page list (`features/workspace/pages.ts`) that builds both its page bar and its starter page. Its routes in `src/app` stay thin: the layout checks access and renders the module's shell, and the starter page is one `ModuleStart` call with the module's page list. Home (`/`) is the hub that lists the modules a person's role opens; each opens on its starter page. See [ADR 0007](decisions/0007-home-hub-and-module-starter-pages.md).

## Module map (approved 9 October 2026)

| Module | Purpose | Tables (`prisma/schema/<file>`) | Talks to others through |
| --- | --- | --- | --- |
| activities | Runs the swim school: classes, swimmers, attendance, assessments, the parent app and the pool deck. | `activities.prisma` | reports class commitments; site summaries; home cards |
| refunds | Moves a refund request from reception to finance. Features: `queue`, `request`, `workspace` ([README](../../src/modules/refunds/README.md)). | `refunds.prisma` | home cards |
| purchasing | Raises and approves purchase orders. Features: `orders`, `suppliers`, `workspace` ([README](../../src/modules/purchasing/README.md)). | `purchasing.prisma` | home cards |
| short-courses | Runs the courses the public book a place on: six and eight week courses and the Academy's lifeguard and swim teacher courses. Features: `courses`, `course-types`, `academy-courses`, `academy-types`, `academy-calls`, `booking`, `workspace` ([README](../../src/modules/short-courses/README.md), [ADR 0009](decisions/0009-add-short-courses-module.md), [ADR 0011](decisions/0011-merge-academy-into-short-courses.md)). | `short-courses.prisma`, `short-courses.academy.prisma` | home cards; Rota commitments; the public booking site's API |
| stock | Counts the stock on the shelf at each site and compares counts. Features: `counts`, `products`, `compare`, `workspace` ([README](../../src/modules/stock/README.md), [ADR 0010](decisions/0010-add-stock-module.md)). | `stock.prisma` | home cards |
| cctv | Records every time CCTV footage is checked (Managers group). Features: `viewings`, `workspace` ([README](../../src/modules/cctv/README.md), [ADR 0012](decisions/0012-add-cctv-log-module.md)). | `cctv.prisma` | home cards |
| tasks | Runs each site's daily checks and logs. Features: `day`, `follow-ups`, `templates`, `sites`, `reports`, `schedule`, `workspace` ([README](../../src/modules/tasks/README.md)). | `tasks.prisma` | home cards |
| incidents | Records accidents, incidents and near misses from report to a closed record. Features: `report`, `triage`, `reports`, `workspace` ([README](../../src/modules/incidents/README.md), [ADR 0008](decisions/0008-add-incidents-module.md)). | `incidents.prisma` | home cards |
| training | Assigns courses and records completions. Features: `courses`, `assignments`, `sign-off`, `certificates`, `expiring`, `me`, `person-file`, `workspace` ([README](../../src/modules/training/README.md)). | `training.prisma` | personal file, subject records, Turnfin Me digest |
| docs | Publishes documents and required reading. Features: `home`, `library`, `reader`, `editor`, `history`, `work`, `reports`, `admin`, `files`, `import`, `me`, `workspace` ([README](../../src/modules/docs/README.md)). | own database (`DOCS_DATABASE_URL`) | home cards, Turnfin Me digest |
| hr | Keeps staff files, notes and reviews. Features: `team`, `person`, `reviews`, `activity`, `export`, `details-requests`, `me`, `workspace` ([README](../../src/modules/hr/README.md)). | own database (`HR_DATABASE_URL`) | reads the personal file and subject records |
| rota | Plans who works when. Features: `plan`, `today`, `bookings`, `absences`, `me`, `person-file`, `workspace` ([README](../../src/modules/rota/README.md)). | `rota.prisma` | reads commitments; shift-change emails; personal file |

Platform owns `core.prisma` and `base.prisma`: people, roles, sites, departments, qualifications, devices, the audit log.

Modules read those tables only through Core's functions, never with their own queries or relation joins (Phase 3; the boundary lint enforces it for every module):
- `src/lib/directory.ts`: people, sites, roles, departments and positions;
- `src/lib/qualifications.ts`: qualification types, what people hold, uploaded certificates, and recording or withdrawing a qualification;
- `src/lib/setup/activity-types.ts`: the activity list the rota plans;
- `src/lib/people/records.ts`: staff details, for HR;
- `src/lib/audit.ts`: writing the audit log, and a module's own audit trail;
- `src/lib/policy`: who may do what, and over whom.

```mermaid
flowchart TB
  list["src/app/modules.ts<br/>(every module's manifest.ts)"] --> registry["Core registry<br/>Home, menus, role editor"]
  subgraph Modules
    activities[Swim school and Pool deck]; refunds[Refunds]; tasks[Tasks]
    rota[Rota]; training[Training]; docs[Docs]; hr[HR]; purchasing[Purchasing]; incidents[Incidents]; shortcourses[Short courses and the Academy]; stock[Stock]; cctv[CCTV log]
  end
  Modules --> core["Core: people, roles, sites, audit, policy<br/>(src/lib, src/modules/contributions.ts)"]
  Modules --> ui["UI kit (src/components/shadcn, ui, ui-kit)"]
  activities -.->|class commitments| core
  shortcourses -.->|course sessions| core
  core -.->|commitments| rota
  training -.->|person file, subject records| core
  rota -.->|person file| core
  core -.->|person file, subject records| hr
  rota -->|shift changed email| me
  me["Turnfin Me API (src/lib/staff-api)"] -->|index.ts| training
  me -->|index.ts| docs
  me -->|index.ts| hr
  me -->|index.ts| rota
```

No module imports another; the boundary lint makes it an error. Solid arrows are direct calls through a module's `index.ts` (or Core's notifier). Dashed arrows are registrations: a module registers a home card, commitments, a person-file section or subject records in `src/modules/contributions.ts` from its `module.ts`, and another module or Core screen reads whatever is registered. Every module also registers a home card. No events are emitted yet ([events.md](events.md)).
