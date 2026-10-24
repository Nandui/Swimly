# 0015: A person holds one or more jobs, each a role at some sites

**Status:** Proposed (24 October 2026). Fernando chose this direction (Option B of the architecture review) and confirmed that some staff hold two different jobs. It becomes Accepted when phase 2 of [docs/architecture/jobs-and-work-layer.md](../jobs-and-work-layer.md) merges.

## Context
Each person holds one role (`User.staffRoleId`) and one list of sites (`User.siteIds`), so every level applies at every site they work at. A receptionist at one site who is a duty manager at another needs a combined role, which also gives duty-manager access at both sites. Roles multiply with every combination, which goes against the "easy to manage" and "scalable" pillars.

The 27 September model had several roles per person, each scoped to a site, a department or the person's reports (`RoleAssignment`). It was retired on 28 September for simplicity. This decision brings back only the part that's needed.

## Decision
- A new Core table `StaffJob` holds `userId`, `roleId` and `siteIds` (empty means every site), plus `isMain`. `(userId, roleId)` is unique.
- At the working site, the flat permissions combine every job that covers that site. Since levels are cumulative, this is the highest level per module. Policy grants come from each job's sites. Reach (sites, team, everywhere) stays as each module's description sets it.
- The main job names Home. `User.staffRoleId` mirrors the main job's role, and `User.siteIds` mirrors every site any job covers, so Works at, the site picker and the organisation chart don't change.
- Core answers "who holds this role here" (`rolesAt`, `holdersOfRole`). Modules never read jobs directly.
- No department or "reports" kinds of job, and no scope per permission.

## Consequences
- Combined roles are no longer needed. The role editor is unchanged. The person's page lists jobs instead of one role and one set of sites.
- `RoleAssignment` stays retired. Dropping it, and the mirrored columns, is a later owner decision.
- The keyholder guard, Google sign-in ("no role" means no jobs), Tasks, Purchasing, Training's chooser and Docs' role teams move to the Core helpers.
