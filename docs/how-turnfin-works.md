# How Turnfin works

*Owner decision, 28 September 2026; wording updated 24 October 2026 ("apps" inside Turnfin, "connected products" outside, "module" only in code). Interactive version: https://claude.ai/artifact/95xd15vj8EHsiubRk8nVYT*

## In five sentences

1. **Apps.** Turnfin is a set of apps: Swim school, Short courses, Pool deck, Tasks, Incidents, Refunds, Coinage, Docs, Training, Rota, HR, Purchasing, Stock, the CCTV log, Site Monitoring, Analytics and Admin. Each one keeps its own information to itself.
2. **Roles.** A role is a job, such as Receptionist or Instructor. For each app the role has a level, like None, Use or Manage. Each level includes the ones before it.
3. **Home.** When you sign in you see Home, named for your role (the Receptionist's is Front of House): the apps your role has, each saying how many things in it need you. Opening an app takes you to its starter page, with its day, what waits for you and every page it has.
4. **Aimed at roles.** Inside an app, things can be aimed at roles: this SOP is for Receptionists and Duty managers, that course is for Instructors.
5. **Turnfin Me.** Your own things (training, qualifications, shifts and anything HR shares with you) are in Turnfin Me, a separate product on your phone.

If a new feature needs a sixth sentence to explain it, question it first.

## The words

| Word | Means |
| --- | --- |
| **Turnfin** | The product staff use: one sign-in, Home and the apps. |
| **App** | One area of the business inside Turnfin, opened from Home, that a role gives a level in. |
| **Connected product** | Outside Turnfin, with its own users and sign-in, and only uses Turnfin's API: Turnfin Me, the parent app and the Academy booking site. |
| **Module** | A code word only: the folder in `src/modules` that provides one or more apps. `src/modules/activities` provides Swim school, Pool deck and Analytics. |

The pool deck is the swim school's poolside view: its own tablet screens, but the same sign-in and the same records, so it is an app inside Turnfin. See [architecture/platform-and-apps.md](architecture/platform-and-apps.md).

## The pillars

Every decision is judged against these. Each pillar has one rule that delivers it and one way to check it.

| Pillar | The rule | How we check |
| --- | --- | --- |
| Simplicity | The five sentences explain Turnfin. | This page still explains everything. |
| Ease of use | Everyone lands on their role's home page. Plain words, one job per screen, and it works on PC, tablet and phone. | A new starter finds their first task without help. |
| Modern | One current technology and one design (Poolside Clear). When something is replaced, the old version is removed. | No second design and no dead screens. |
| Scalable | A new site, role or organisation is data, not code. A new app is one new folder. | Adding a site needs no new release. |
| Clean code | Every app has the same shape: a description (name, levels, menu, home cards, log name), its data, actions, screens and tests. Apps never import each other, and lint refuses it if they try. | Lint and the description tests pass. |
| Easy to manage | A role is one row for each app and fits on one screen. | An admin can say what a role does by reading it. |
| Easy to audit | Every change writes one entry to one shared log, in one shape: who, what, which app, which record, when. | Any change can be traced with one search. |
| Easy to train | Home shows the job: the apps a role opens, each with its starter page. Every level has one plain sentence, shown where it's set. | This page is enough to train a new manager. |
| Change without breaking | Apps connect to the rest only through their description. Database changes only add. Every app has its own tests. | Tests pass with any one app switched off. |

## Levels

A role holds one level for each app (`StaffRole.levels`), plus up to two extras. Levels translate into the named permissions that pages, menus and actions check: **permissions are the only access language**. A screen is a menu entry opened by one permission; an app appears when the person holds any of its permissions. Security checks never ask for a level or a role name. The mapping lives in each app's description, its `manifest.ts`, listed in `src/app/modules.ts`.

| App | Levels | Extra |
| --- | --- | --- |
| Swim school | Desk (every swimmer, booking, move, waiting list and assessment booking), Manage (programmes, levels and classes) | Can cancel classes (the duty manager page) |
| Pool deck | Teach (the class instructor view only: own classes, attendance, competencies, assessments, covering), Lead (also any class's attendance) | |
| Refunds | Use (log and follow requests), Manage (decide requests and record payments) | |
| Coinage | Use (request coins for a till and follow it), Manage (decide requests and record the orders) | |
| Docs | Read, Write, Manage | Can approve, never their own |
| Training | Trainer (sign off practical training), Manage (courses, assigning, certificates) | |
| Rota | View, Plan, Run | |
| Tasks | Do (the day's tasks they may complete), Review (approve, reopen, follow-ups, reports, activity), Manage (templates, sites' settings, export) | |
| Short courses | View (see courses, book people on, record payment, keep the waiting list), Instructor (take registers), Manage (the course list, put courses on) | |
| Stock | View (see counts, the product list and comparisons), Count (start a count, count and submit it), Manage (the product list and categories, delete a count) | |
| CCTV log | Record (record each time they check CCTV, read their own entries), Review (read everyone's at their sites and add notes) | |
| Incidents | Report (report accidents, incidents and near misses, follow your own), Investigate (every report at your sites, triage, close low-risk ones), Manage (serious alerts, close serious reports). Never your own | |
| Site Monitoring | View (see the actions raised at your sites), Act (close an action by saying what was done, or open it again) | |
| Analytics | View (the swim school's Business, Reception and Pool deck dashboards for your sites). For managers only | |
| HR | Their team, Everyone (staff details, employment, notes, reviews). Only a superadmin gives HR | |
| Admin | Manage (sign-in and access: people's accounts, roles, sites, the activity log) | Staff details are HR's |

**Where a level applies:**
- Swim school, Short courses, Pool deck, Tasks, Incidents, Stock, CCTV log, Site Monitoring, Analytics, Training and Rota levels apply at the sites the person works at (Staff › a person › Role and sites). No sites ticked means every site.
- HR "Their team" applies to the people the person manages.
- Everything else applies everywhere.

**Admin: Manage** is the administrator: Manage in every app except HR. **Can work away from the centre's computers** is one tick on the role.

**Aimed at roles:** in Docs every role is a team ("Receptionist (role)"), so a document or its required reading can be aimed at a role. In Training, "Add everyone on a role" (in the Assign training dialog) adds a whole role's people to an assignment. In Tasks, a template is for the roles it names: only they complete its tasks ([tasks.md](tasks.md)).

**Departments** are presentation only. Each app names the part of the centre it serves in one `group` field (`MODULE_GROUPS` in `src/modules/registry.ts`): Front of house (Swim school, Short courses with the Academy, Refunds, Coinage), Poolside (Pool deck, Tasks, Incidents), Team (Rota, Training, Docs, HR), Managers (the CCTV log, Site Monitoring, Analytics) and Back office (Purchasing, Stock, Admin). The group orders and heads the role editor, the app bar and the home page, and never gives or checks access: that stays role, then level, then permission. The workspace is still the role's home page, named on the role ("Front of House"). In code, say *group*, not "department" (Rota departments are Admin data) or "area" (a site's pools and rooms).

**Home and the starter pages.** Home lists the person's apps; each opens on its starter page (the manifest's `href`), the same shape in every app (`ModuleStart`). An app's items (`registerHomeCard` in `src/modules/contributions.ts`) fill its starter page, and Home counts the ones that need the person. An app lists only its everyday jobs there, and only what the person can already open. Each app keeps one list of its pages, which builds both its page bar and its starter page.

**The activity log** names each entry's app and filters by it.

**The superadmin flag** (`User.isSuperadmin`) still holds everything.

## Turnfin and Turnfin Me

- **Turnfin** is the job, on the centre's computers and tablets.
- **Turnfin Me** (`apps/me`) is a connected product: each person's own records, on their phone. It talks only to `/api/staff/v1` (see [staff-app.md](staff-app.md)).
