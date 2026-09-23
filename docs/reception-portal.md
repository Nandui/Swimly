# Turnfin Reception Portal

The owner selected the Module directory layout on 23 September 2026. The
signed-in `/reception-portal` route sits outside the Aquatics desk and Instructor
shells. It uses the shared portal header, Neutral theme, Figtree and Turnfin logo.

Aquatics combines module entry with swimmer, class, assessment and sibling-time
shortcuts. Add a swimmer opens the existing form. Follow-up links lead to awaiting
enrolment, ready-to-move swimmers, Legend agreements and parent access requests.
Docs appears only with Docs access; Refunds appears only with its screen and
read permission. Bookings remains Coming soon. Refunds is a separate workspace
for requests across both sites, independent of the working-site preference.
See [Refunds](refunds.md) for its reception-to-finance workflow and grants.

## Access and routing

`src/lib/reception-portal.ts` filters every shortcut by visible screen and, where
needed, its named action permission. The portal grants no access. Administrator
expansion uses the existing permission helpers; Instructor-only staff cannot open
this desk portal. The working-site selector uses the existing device preference
and does not narrow shared swimmer identity.

Reception Portal is an explicit role home option. `/modules` redirects there
only for that saved preference and eligible access. Other staff retain the
general module portal. `/modules?view=all` always opens All modules.
`/start?workspace=desk` keeps Open Aquatics inside the desk workspace, including
for staff who also have Instructor access. The retired `/reception` route stays
retired.

## Publish and activate

After deploying this change, set the Receptionist role's **Where they start after
signing in** option to **Reception Portal** through Roles. Preserve its existing
permissions and screen grants. This preference is not inferred from a role name,
and this implementation does not change any live role records.

Future reception modules opt in with `reception: true` in `src/lib/modules.ts`
and must have their access filter added to the portal before becoming available.

## Local review

Run `node scripts/reception-portal-preview/serve.mjs --implementation` and open
`http://127.0.0.1:4200/reception-portal`. This renders the actual portal components
with fictional staff and isolated form/site actions. Query `access=admin`,
`access=read` or `access=docs` exercises different grants; `theme=dark` selects
dark mode. No preview action writes to a database.

The local workspace has no Aquatics database connection configured. Authenticated
database integration and the live role preference therefore need checking when
publishing; the local preview does not claim to verify them.

## Verification (23 September 2026)

- `npm run typecheck` and `npm run lint` passed.
- All 22 focused tests passed across reception access/routing, screen access and
  role updates. They cover saving the new preference with an audit while keeping
  existing grants, administrator inheritance and the Instructor boundary.
- The optimized Next build passed with a dummy database URL for build-time
  initialisation. No migrations, seeds or database writes were run.
- Browser checks of the actual components passed at 375, 768, 1024 and 1280px in
  light and dark modes: one H1, no horizontal overflow and 44px action controls.
  Verified the site selector, restricted modules, All modules, skip navigation,
  form error recovery and focus restoration, and sign-out/site error messages.
- The design detector returned no findings. The selected composition and phone
  captures were reviewed locally without delegated agents, per project rules.
