# How Turnfin works

*Owner decision, 28 September 2026. Interactive version: https://claude.ai/artifact/95xd15vj8EHsiubRk8nVYT*

## In five sentences

1. **Modules.** Turnfin is a set of modules: Swim school, Pool deck, Tasks, Refunds, Docs, Training, Rota, HR and Admin. Each one keeps its own information to itself.
2. **Roles.** A role is a job, such as Receptionist or Instructor. For each module the role has a level, like None, Use or Manage. Each level includes the ones before it.
3. **Home page.** When you sign in you see your role's home page: the modules your role has and what needs you today. The Receptionist's home is Front of House. Modules open inside it.
4. **Aimed at roles.** Inside a module, things can be aimed at roles: this SOP is for Receptionists and Duty managers, that course is for Instructors.
5. **Turnfin Me.** Your own things (training, qualifications, shifts and anything HR shares with you) are in Turnfin Me, a separate app on your phone.

If a new feature needs a sixth sentence to explain it, question it first.

## The pillars

Every decision is judged against these. Each pillar has one rule that delivers it and one way to check it.

| Pillar | The rule | How we check |
| --- | --- | --- |
| Simplicity | The five sentences explain Turnfin. | This page still explains everything. |
| Ease of use | Everyone lands on their role's home page. Plain words, one job per screen, and it works on PC, tablet and phone. | A new starter finds their first task without help. |
| Modern | One current technology and one design (Poolside Clear). When something is replaced, the old version is removed. | No second design and no dead screens. |
| Scalable | A new site, role or organisation is data, not code. A new module is one new folder. | Adding a site needs no new release. |
| Clean code | Every module has the same shape: a module description (name, levels, menu, home cards, log name), its data, actions, screens and tests. Modules never import each other, and lint refuses it if they try. | Lint and the module-description tests pass. |
| Easy to manage | A role is one row for each module and fits on one screen. | An admin can say what a role does by reading it. |
| Easy to audit | Every change writes one entry to one shared log, in one shape: who, what, which module, which record, when. | Any change can be traced with one search. |
| Easy to train | The home page shows the job. Every level has one plain sentence, shown where it's set. | This page is enough to train a new manager. |
| Change without breaking | Modules connect to the rest only through their description. Database changes only add. Every module has its own tests. | Tests pass with any one module switched off. |

## Levels

A role holds one level for each module (`StaffRole.levels`), plus up to two extras. Levels translate into the named permissions that pages, menus and actions check: **permissions are the only access language**. A screen is a menu entry opened by one permission; a module appears when the person holds any of its permissions. Security checks never ask for a level or a role name. The mapping lives in each module's description, its `manifest.ts`, listed in `src/app/modules.ts`.

| Module | Levels | Extra |
| --- | --- | --- |
| Swim school | Desk (every swimmer, booking, move, waiting list and assessment booking), Manage (programmes, levels, classes and reports) | Can cancel classes (the duty manager page) |
| Pool deck | Teach (the class instructor view only: own classes, attendance, competencies, assessments, covering), Lead (also any class's attendance) | |
| Refunds | Use (log and follow requests), Manage (decide requests and record payments) | |
| Docs | Read, Write, Manage | Can approve, never their own |
| Training | Trainer (sign off practical training), Manage (courses, assigning, certificates) | |
| Rota | View, Plan, Run | |
| Tasks | Do (the day's tasks they may complete), Review (approve, reopen, follow-ups, reports, activity), Manage (templates, sites' settings, export) | |
| HR | Their team, Everyone (staff details, employment, notes, reviews). Only a superadmin gives HR | |
| Admin | Manage (sign-in and access: people's accounts, roles, sites, the activity log) | Staff details are HR's |

**Where a level applies:**
- Swim school, Pool deck, Tasks, Training and Rota levels apply at the sites the person works at (Staff › a person › Role and sites). No sites ticked means every site.
- HR "Their team" applies to the people the person manages.
- Everything else applies everywhere.

**Admin: Manage** is the administrator: Manage in every module except HR. **Can work away from the centre's computers** is one tick on the role.

**Aimed at roles:** in Docs every role is a team ("Receptionist (role)"), so a document or its required reading can be aimed at a role. In Training, "Add everyone on a role" (in the Assign training dialog) adds a whole role's people to an assignment. In Tasks, a template is for the roles it names: only they complete its tasks ([tasks.md](tasks.md)).

**Departments** are presentation only. Each module names the part of the centre it serves in one `group` field (`MODULE_GROUPS` in `src/modules/registry.ts`): Front of house (Swim school, Academy, Refunds), Poolside (Pool deck, Tasks), Team (Rota, Training, Docs, HR) and Back office (Purchasing, Admin). The group orders and heads the role editor, the module bar and the home page, and never gives or checks access: that stays role, then level, then permission. The workspace is still the role's home page, named on the role ("Front of House"). In code, say *group*, not "department" (Rota departments are Admin data) or "area" (a site's pools and rooms).

**The home page** is built from each module's card (`registerHomeCard` in `src/modules/contributions.ts`). A module lists only its everyday jobs there, and only what the person can already open.

**The activity log** names each entry's module and filters by it.

**The superadmin flag** (`User.isSuperadmin`) still holds everything.

## Work and Me

- **Turnfin (Work)** is the job, on the centre's computers.
- **Turnfin Me** (`apps/me`) is each person's own records, on their phone. It talks only to `/api/staff/v1` (see [staff-app.md](staff-app.md)).
