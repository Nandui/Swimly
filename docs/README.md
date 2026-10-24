# Turnfin's docs

Every doc, once, by topic. Each fact lives in one place; the others link to it. Add a new doc here in the same change.

## Start here

| Doc | What it holds |
| --- | --- |
| [how-turnfin-works.md](how-turnfin-works.md) | Turnfin in five sentences, the words, the pillars, every app's levels |
| [../CLAUDE.md](../CLAUDE.md) | how the code is built: the words in code, layers, dependency rules, the app contract, data ownership, how apps talk, the UI rules |
| [../AGENTS.md](../AGENTS.md) | how to work in this repository: checks, What's new, product and database rules |
| [architecture/platform-and-apps.md](architecture/platform-and-apps.md) | the direction: Turnfin as a platform of apps, and the order of work |
| [architecture/README.md](architecture/README.md) | the app map today: layers and folders, each app's module, tables and plugs, databases, the diagram |
| [../PRODUCT.md](../PRODUCT.md) and [../DESIGN.md](../DESIGN.md) | who each screen is for, and the one design (Poolside Clear v2) |

## Plans and decisions

| Doc | What it holds |
| --- | --- |
| [architecture/jobs-and-work-layer.md](architecture/jobs-and-work-layer.md) | the plan for jobs at places and the shared work layer (not built yet) |
| [architecture/events.md](architecture/events.md) | every event: who emits it, its payload, who listens |
| [architecture/decisions/](architecture/decisions/) | the decision records (ADRs), numbered and dated |

## The platform

| Doc | What it holds |
| --- | --- |
| [platform-access.md](platform-access.md) | access: roles and levels, where they apply, the policy engine, superadmins, sign-in, shared devices |
| [admin-setup.md](admin-setup.md) | Admin: people, roles, sites and the setup lists every app picks from |
| [help-centre.md](help-centre.md) | the staff help centre at `/help` |
| [interaction-system.md](interaction-system.md) | the motion and feedback contract every screen follows |
| [database-operations.md](database-operations.md) | databases, previews, the sandbox and the secured record-management workflow |

## Apps

| App | Docs |
| --- | --- |
| Swim school | [swimmers.md](swimmers.md), [classes.md](classes.md), [schedule.md](schedule.md), [today.md](today.md), [assessments.md](assessments.md), [duty-manager.md](duty-manager.md), [scheduled-unenrolment.md](scheduled-unenrolment.md), [legend-agreements.md](legend-agreements.md), [curriculum-images.md](curriculum-images.md), [shared-sites.md](shared-sites.md) |
| Pool deck | [instructor.md](instructor.md) |
| Analytics | [analytics.md](analytics.md) |
| Short courses and the Academy | [short-courses.md](short-courses.md), [academy.md](academy.md) |
| Refunds | [refunds.md](refunds.md) |
| Coinage | [coinage.md](coinage.md) |
| Tasks | [tasks.md](tasks.md) |
| Incidents | [incidents.md](incidents.md) |
| Rota | [rota.md](rota.md) |
| Training | [training.md](training.md) |
| Docs | [turnfin-docs.md](turnfin-docs.md) |
| HR | [hr.md](hr.md) |
| CCTV log | [cctv.md](cctv.md) |
| Site Monitoring | [site-monitoring.md](site-monitoring.md) |
| Purchasing | [purchasing.md](purchasing.md) |
| Stock | [stock.md](stock.md) |

Each module's own README (`src/modules/<id>/README.md`) lists its features, front door, tables, events and permissions for coders.

## Connected products

| Product | Docs |
| --- | --- |
| Turnfin Me | [staff-app.md](staff-app.md) |
| Parent app | [parent-app.md](parent-app.md), [parent-staff-controls.md](parent-staff-controls.md), [parent-google-email.md](parent-google-email.md) |
| Academy booking site | [academy.md](academy.md) |
