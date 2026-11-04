# Staffing

**Purpose:** rosters swim teachers on their contracts, in two-week blocks.

What it does and why is in [docs/staffing.md](../../../docs/staffing.md); its levels are in [docs/apps.md](../../../docs/apps.md).

## Features
- `blocks` — rota blocks (`/staffing`, `/staffing/blocks/[id]`): starting a block from the slots and the block before, putting people on places, publishing, acknowledgements.
- `today` — the duty manager's day (`/staffing/today`): logging call-offs, late arrivals and no-shows, covering gaps.
- `requests` — swaps and exam absences (`/staffing/requests`).
- `strikes` — the strike ladder's steps and each teacher's strikes (`/staffing/strikes`).
- `setup` — slots, teachers, exam seasons and settings.
- `workspace` — the frame, its page list, the access check and the home card.

`shared/` holds the pure rules (`rules.ts`), what the reads and writes share (`server.ts`: sites, teachers, settings, recording a strike), the access check and the screen kit (the person picker with warnings).

## Front door (index.ts)
- `STAFFING_STATUS_MAPS` — the status maps, for the platform's tone check.

## Data owned
`StaffingSettings`, `StaffingTeacher`, `StaffingSlot`, `StaffingBlock`, `StaffingShift`, `StaffingAck`, `StaffingSwap`, `StaffingAttendance`, `StaffingStrike`, `StaffingExamSeason`, `StaffingExamAbsence`.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Home card: return-to-work chats due, blocks to publish, swaps to decide, teachers to phone, second conversations, referrals.

## Permissions
- `staffing.read`, `staffing.run`, `staffing.supervise`, `staffing.manage`.

## Depends on
- Platform: auth and the session, the policy engine, audit, the database client, format helpers, home cards.
- Core reads through its functions only: people, sites, contracted minutes and dates of birth (`src/lib/directory.ts`), qualifications (`src/lib/qualifications.ts`).
- Other modules: none.
