# How Turnfin works

*Owner decision, 28 September 2026. Interactive version: https://claude.ai/artifact/95xd15vj8EHsiubRk8nVYT*

## In five sentences

1. **Modules.** Turnfin is a set of modules: Swim school, Refunds, Docs, Training, Rota, HR and Admin. Each one keeps its own information to itself.
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

A role holds one level for each module (`StaffRole.levels`), plus up to two extras. Levels translate into the named permissions that pages and actions check, so security checks never ask for a level or a role name. The mapping lives in each module's description in `src/modules/registry.ts`.

| Module | Levels | Extra |
| --- | --- | --- |
| Swim school | Teach (the pool deck), Desk (bookings, moves, waiting lists, assessments), Manage (programmes, levels, classes and reports) | Can cancel classes |
| Refunds | Use (log and follow requests), Manage (decide requests and record payments) | |
| Docs | Read, Write, Manage | Can approve, never their own |
| Training | Trainer (sign off practical training), Manage (courses, assigning, certificates) | |
| Rota | View, Manage | |
| HR | Their team, Everyone. Only a superadmin gives HR | |
| Admin | Manage (people, roles, sites, the activity log) | |

**Where a level applies:**
- Swim school, Training and Rota levels apply at the sites the person works at.
- HR "Their team" applies to the people the person manages.
- Everything else applies everywhere.

**The superadmin flag** (`User.isSuperadmin`) still holds everything.

## Work and Me

- **Turnfin (Work)** is the job, on the centre's computers.
- **Turnfin Me** (`apps/me`) is each person's own records, on their phone. It talks only to `/api/staff/v1` (see [staff-app.md](staff-app.md)).
