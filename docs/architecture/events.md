# Event catalogue

The bus is `src/platform/events` (typed, in-process; CLAUDE.md section 6). Every event is listed here with its emitter, payload and listeners, in the same change that adds or alters it.

| Event | Emitted by | Payload | Listeners |
| --- | --- | --- | --- |
| (none yet) | | | |

## Candidates from today's seams

These cross-module side effects are calls today and are marked to become events in phase 2:

- `rota.shift.changed` — Rota, after a shift or duty changes. Today Rota calls `notifyShiftChange` (`src/lib/staff-api/notify.ts`) directly. Listener: Turnfin Me's email.
