# Admin: the shared setup

Owner decision, 7 October 2026: what more than one module uses is set up once, in Admin, and
every module picks from it. Setup that only one module uses stays in that module (its
programmes, courses, suppliers, document templates), and Admin's overview links to each.

## Admin, by topic (`src/components/core/pages.ts`)

| Group | Pages |
| --- | --- |
| People | Staff, Roles, Departments (`/departments`), Positions (`/positions`) |
| Places | Sites (`/clubs`, with each site's short code), Areas (`/areas`) |
| Work | Activities (`/activity-list`), Qualifications (`/qualifications`) |
| Log | Activity log |
| Modules (overview only) | Swim school programmes, Training courses, Purchasing suppliers, Docs settings, for those who can open them |

The page bar and the overview are built from the one list, so neither can leave a page out.
`/staff/organisation` and `/rota/activities` redirect to the new pages.

## Who keeps what

Admin has two levels and five ticks (`src/modules/registry.ts`):

- **Setup** (`setup.view`): sees every setup list. Its ticks choose which lists the role keeps:
  departments (`setup.departments`), qualifications (`setup.qualifications`), the activity
  list (`setup.activities`), sites' areas (`setup.areas`) and positions (`setup.positions`).
- **Manage**: people, roles, sites, the log, and every tick (an administrator holds all of
  Admin's extras through `effectiveLevels`).

The lists are organisation-wide, so their actions use the flat permission check.

## The lists

- **Departments** and **qualifications**: unchanged data, now on their own pages. Recording who
  holds a qualification is still Training's (`qualifications.manage`).
- **Activities**: the organisation's one activity list (`ActivityType`, still the table
  `RotaActivityType`, so nothing moved). Each has a department, an icon
  (`src/lib/setup/meta.ts`) and the qualification it needs; one takes the swim classes.
  Rota reads it; Rota's own copy of the page and its actions are gone.
- **Areas** (`SiteArea`): each site's pools, gym and reception, in order. The rota's activities,
  repeats and bookings choose their "where" from them (`AreaSelect`, checked by
  `areaProblem` on save; a value saved before keeps working). The swim school's classes and
  assessment sessions choose an area and add a detail, saved as before ("Learner pool, lane 3",
  `LocationField`, read through `areaNamesAt` in the directory). No commas in an area's name,
  since the detail follows one. The migration (`20261020120000_site_areas`) made an area of
  every place already typed at each site.
- **Renaming an area** reaches every record that uses it through the area-rename contribution
  (`registerAreaRename` in `src/modules/contributions.ts`): Rota (`src/modules/rota/shared/areas.ts`) and
  the swim school (`src/modules/activities/module.ts`) each update their own records,
  inside Admin's transaction. Core never touches a module's tables. Archiving an area stops it
  being offered; records keep the name.

## Positions and the staff profile (owner decision, 8 October 2026)

- **Positions** (`Position`, `PositionQualification`): the organisation's job list, separate from
  the access role. Each names the qualifications it needs. A person holds one (`User.positionId`);
  their job title follows its name, so a rename reaches every holder. Archived positions stay
  with their holders but are no longer offered. The migration
  (`20261021120000_positions_and_employment`) made a position of every job title in use.
- **Requirements** (`src/lib/people/requirements.ts`, pure): each needed qualification against
  the person's best record (in date, expires within 60 days, expired, not held). The HR file
  and Training › Expiring read it.
- **Staff page** (`/staff/[id]`, `staff.manage`): access only (owner decision, 8 October 2026):
  sign-in (reset password, deactivate), superadmin, the role and the sites it applies at. Admin
  keeps nothing about the person's job.
- **HR file** (`/hr/people/[id]`): the person's details: profile (position, start date, date of
  birth, main site, manager, departments; `updateProfile`), employment (contract, weekly hours,
  payroll number, last day; `updateEmployment`) and contact (read only, kept by the person in
  Turnfin Me). Changing them needs the restricted `hr.details.write` over the person, and nobody
  changes their own. Also what their position needs, Training and Rota through the personal-file
  contribution, and the qualifications record. Recording one can attach the
  certificate (PDF, PNG or JPEG up to 5 MB, checked by its first bytes), kept as verified
  Training evidence. Recording and withdrawing still need `qualifications.manage` over the person.
- **Reminders** (`src/lib/staff-api/reminders.ts`): at 60, 30 and 7 days and on expiry, the
  person and their line manager, each once, in their daily digest.
- **Training › Expiring**: filters by site and position, and lists who has never held a
  qualification their position needs.

## Not done yet

Break rules as an Admin setting (they are the house rule in `src/modules/rota/shared/constants.ts` today),
and opening hours per site.

Tests: `src/lib/setup/setup.test.ts`, `src/lib/people/requirements.test.ts`, and the expiring and
reminder cases in `src/modules/training/__tests__/training.test.ts` and `src/lib/staff-api/reminders.test.ts`.
