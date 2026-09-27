# Turnfin Rota

Who is on shift, where and when, with a warning when someone's qualification
won't cover the shift. It lives in the main database and uses the platform
access model (docs/platform-access.md).

## Surfaces

- **Rota workspace** (`/rota`, Poolside Clear on the shared `ModuleShell`). This
  is a week view, Monday to Sunday, for one site at a time. It opens for anyone
  with the Rota screen and `rota.view` at any scope. It shows only the sites that
  capability covers; any other site is a 404.
- **My shifts** in Turnfin Me (the staff app). Each
  person sees their own shifts for the coming weeks. No permission is needed.

## Capabilities

| Key | Lets you |
| --- | --- |
| `rota.view` | See the rota at the sites the role covers |
| `rota.manage` | Add, change, fill and cancel shifts at those sites. Includes seeing it |

Shifts belong to a site, so scope resolves with `sitesFor` and `requireCapFor`
with a `siteId`. A duty manager's role scoped to one site plans that site only.
A department scope reaches its department's site. Moving a shift between sites
needs the permission at both. Every change is audited with the shift's own site.

## Warnings, never blocks

Owner decision, September 2026: the rota **warns** and never refuses. Warnings
come from `ROTA_WARNING_META` and `RotaWarningTag`, each with its own icon:

- **Qualification expired**: the shift needs a qualification type, and every one
  the person holds had expired by the shift's day. Withdrawn ones don't count.
- **Qualification not recorded**: the shift needs one they have never held.
- **Double-booked**: the person has an overlapping shift that day, at any site.
- **Unfilled**: an open shift with nobody on it.

The rules live in one pure function, `shiftWarnings` (`src/lib/rota/constants.ts`),
tested on its own. A person's own qualification warning also shows in Turnfin Me,
so they can sort it out before the shift. Renewing is Training's job (the
expiring-qualifications view, docs/training.md).

## Files

- Schema: `RotaShift` (`prisma/migrations/20261001120000_rota`)
- `src/lib/rota/`: `access.ts`, `data.ts` (the week), `mine.ts` (own shifts), `actions.ts`, `constants.ts`
- Self-service: `src/lib/rota/mine.ts` (staff API); UI: `src/app/rota/`, `src/components/rota/`; shift-change emails from `src/lib/staff-api/reminders.ts`
- Tests: `src/lib/rota/rota.test.ts`
