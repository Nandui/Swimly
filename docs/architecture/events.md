# Event catalogue

The bus is `src/platform/events` (typed, in-process; CLAUDE.md section 6). Every event is listed here with its emitter, payload and listeners, in the same change that adds or alters it.

| Event | Emitted by | Payload | Listeners |
| --- | --- | --- | --- |
| `tasks.reading.out_of_range` | Tasks, after a task is completed with readings outside their range (`completeTask`, sent through `announce` in `src/modules/contributions.ts`, which loads every module's listeners first) | `orgId`, `siteId`, `taskId`, `task` (title), `recordedById`, `recordedByName`, `recordedAt` (ISO), `readings[]`: `key` ("record:field"), `reading`, `value`, `unit`, `allowed`, `guidance` | Site Monitoring raises one action per reading for the site's managers (`raiseFromTaskReadings`); the same reading again raises nothing new |

## Candidates from today's seams

These cross-module side effects are calls today and are marked to become events in phase 2:

- `rota.shift.changed` — Rota, after a shift or duty changes. Today Rota calls `notifyShiftChange` (`src/lib/staff-api/notify.ts`) directly. Listener: Turnfin Me's email.
