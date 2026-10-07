# Admin: the shared setup

Owner decision, 7 October 2026: what more than one module uses is set up once, in Admin, and
every module picks from it. Setup that only one module uses stays in that module (its
programmes, courses, suppliers, document templates), and Admin's overview links to each.

## Admin, by topic (`src/components/core/pages.ts`)

| Group | Pages |
| --- | --- |
| People | Staff, Roles, Departments (`/departments`) |
| Places | Sites (`/clubs`, with each site's short code), Areas (`/areas`) |
| Work | Activities (`/activity-list`), Qualifications (`/qualifications`) |
| Log | Activity log |
| Modules (overview only) | Swim school programmes, Training courses, Purchasing suppliers, Docs settings, for those who can open them |

The page bar and the overview are built from the one list, so neither can leave a page out.
`/staff/organisation` and `/rota/activities` redirect to the new pages.

## Who keeps what

Admin has two levels and four ticks (`src/modules/registry.ts`):

- **Setup** (`setup.view`): sees every setup list. Its ticks choose which lists the role keeps:
  departments (`setup.departments`), qualifications (`setup.qualifications`), the activity
  list (`setup.activities`) and sites' areas (`setup.areas`).
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
  (`registerAreaRename` in `src/modules/contributions.ts`): Rota (`src/lib/rota/areas.ts`) and
  the swim school (`src/modules/activities/contributions.ts`) each update their own records,
  inside Admin's transaction. Core never touches a module's tables. Archiving an area stops it
  being offered; records keep the name.

## Not done yet

Break rules as an Admin setting (they are the house rule in `src/lib/rota/constants.ts` today),
and opening hours per site.

Tests: `src/lib/setup/setup.test.ts`.
