# Turnfin 2.0: decisions

The decisions Turnfin 2.0 stands on, newest first. Each says what was decided, why, and what follows. Only the owner (Fernando) takes them. Anything not listed here or in [../AGENTS.md](../AGENTS.md) is open to change.

**Adding one.** Add an entry at the top in the same change that needs it: a new app, splitting or merging apps, moving something into the platform, an exception to a rule in AGENTS.md, or anything that changes the five sentences. Give the date, the owner's decision in one or two sentences, why, and what follows. When a decision is replaced, change its entry rather than adding a contradicting one.

---

### D12 · 24 October 2026 · Turnfin 2.0 begins

Turnfin 2.0 is the platform of apps (D11), jobs at places (D10) and a new look and feel (D9). It **evolves the live app**: same repository, data and deploy, moved forward in steps. Every pre-2.0 doc, plan and design rule was removed; these docs replace them.
**Why:** many more apps are coming, some as large as products sold on their own, and the old rules and design would hold them back.
**Follows:** [roadmap.md](roadmap.md). Version 2.0.0 is the first release staff notice.

### D11 · 24 October 2026 · A platform of apps, in one deploy

Turnfin stays one codebase, one deploy and one sign-in: a platform with apps on top. Each app has the six-part contract (description, plug, front door, events, own data, own tests), talks to others only through it, and can be switched on per organisation and site. No splitting into separately deployed services.
**Why:** a broken change must stay inside one app. Separate services move breakage into the network and were tried on 28 September 2026 and reversed.
**Follows:** [architecture.md](architecture.md); the safety net comes first.

### D10 · 24 October 2026 · Jobs at places

A person holds one or more jobs; a job is a role at the sites it covers. At the working site, each app's level is the highest among the jobs covering it. Combined roles are retired.
**Why:** some staff hold two different jobs (reception at one site, duty manager at another), and combined roles gave too much access at both.
**Follows:** roadmap step 3.

### D9 · 24 October 2026 · A new design for 2.0, decided before it is built

2.0 gets a new look and feel. The direction is approved from screenshot-checked mockups before anything is built, then written into DESIGN.md as the one design; the old look is removed as it is replaced.
**Follows:** [../DESIGN.md](../DESIGN.md), roadmap step 5.

### D8 · 24 October 2026 · The words

**App** inside Turnfin; **connected product** outside it (Turnfin Me, the parent app, the Academy booking site); **module** and **workspace** are code words only. "Turnfin Work", "surfaces", "My hub" and "the Reception portal" are retired. The pool deck is an app's screens, not a connected product.
**Why:** two words for one idea confuse people.

### D7 · 24 October 2026 · Shared services in the platform, not a work-item table

"Waiting for you" is built from each app's home items, completed rather than copied into a stored table. One email outbox and one file check move into the platform. Comments are not unified.
**Why:** a stored copy would drift; three email queues and six file checks were copies of each other; comments have different rules per app.
**Follows:** roadmap step 4.

### D6 · 8 October 2026 · Previews, not a development branch

Changes ship as a pull request with its own preview, then merge to `main`. Previews use their own development database, a copy of production including personal data (29 September 2026), and never migrate production.
**Follows:** [operations.md](operations.md).

### D5 · 28 September 2026 · Access by levels and permissions

A role holds one level per app; levels become named permissions; code asks only for permissions, and for other people's records, the policy engine. Administrators get Manage everywhere except HR; only a superadmin gives HR. Home, menus and hiding are never security.
**Why:** one access language, readable by an admin, and HR kept apart.

### D4 · 27 September 2026 · Turnfin and Turnfin Me are separate

Turnfin is the job, on work computers, with no personal pages. A person's own training, reading, qualifications, shifts, HR and details are in Turnfin Me, which reaches Turnfin only through `/api/staff/v1`.
**Why:** work devices are shared, and what is yours should not be on them.

### D3 · Apps own their data

Every table has one owner, named by its schema file. Existing tables keep their names; new ones take the app's prefix. Docs and HR keep their own databases. Database changes only add.
**Why:** an app that owns its data can be changed, switched off or lifted out without touching the others; renaming live tables risks the running app.

### D2 · The platform is `src/lib` and the module wiring; the UI kit stays in `src/components`

The platform (sign-in, people, sites, access, audit, events, email, the API toolkit, the app catalogue) never names an app. The UI kit holds presentational components and the theme, with no business rules.
**Why:** apps stand on both; neither may depend on an app.

### D1 · Apps in the catalogue

The apps are those in [apps.md](apps.md): Swim school, Pool deck and Analytics (one module); Short courses with the Academy; Refunds; Coinage; Tasks; Incidents; Rota; Training; Docs; HR; CCTV log; Site Monitoring; Purchasing; Stock; Admin. Short courses book people from the swim school's member records rather than keeping their own.
**Follows:** a new app is a new entry here.
