# Plan (test)

**Purpose:** plans who works when at each site, on which duties.

Its levels are in [docs/apps.md](../../../docs/apps.md#plan-test); why it exists is [D17](../../../docs/decisions.md). It runs on test beside Rota, which stays as it is.

## Features
- `week` — the Week (`/plan`): one department's people across Monday to Sunday, adding and changing shifts, copying last week (`copyLastWeek`).
- `day` — the Day (`/plan/day`): what's on area by area (each area with its lanes and parts beneath, one block per session or class filling the lanes it takes; `whatsOnRows`) with what still needs someone and who could fill it, each person's shift with duties, breaks, classes and free time, the warnings and the tasks given that day, for every department or the one picked (`?dept=`, which narrows the people only); putting people on a duty with the tasks they do and when each starts and ends, changing those and taking people off (`saveBlock`, `removeBlock`), choosing class teachers (`planClassTeacher`), changing one day of a session (`setSessionDay`), and asking staff to cover a gap ([D30](../../../docs/decisions.md)): asking a department that has a Google Chat space, seeing who answered, choosing one of the yeses (which adds or grows their shift and puts them on) and stopping (`askForCover`, `chooseCover`, `stopAsking`). Asking posts a card to the department's Google Chat space, and the card follows each step.
- `off` — Off (`/plan/off`): marking people off and taking it back (`markOff`, `withdrawOff`).
- `chat` — what Google Chat tells the Chat app at `/api/plan/chat` (`handleChatEvent`): it was added to a space, or someone pressed **I can cover** or **Can't** on a request's card. Nobody is signed in to Turnfin there: Google's signature proves it is Chat, and Chat names the person, matched by email.
- `setup` — Setup (`/plan/setup`): duties with the names of the tasks each can come with (who does which, and from when to when, is chosen on the Day), and what's on with the duties it needs (`saveDuty`, `saveSession` and their retire actions). It shows the site's areas from Admin › Areas, where they are kept, and links each department to its Google Chat space, from the spaces the Chat app has been added to (`linkChatSpace`, `unlinkChatSpace`).
- `workspace` — the frame, its one page list (`pages.ts`, for the page bar and the starter page `/plan/overview`), the site picker and the access check (`src/app/plan/layout.tsx`).

`shared/` holds the pure day model (`model.ts`: sessions on a day, needs that stack, fills and gaps, warnings, lane clashes, tasks, who could fill a gap, copying a week), the rules and form schemas (`rules.ts`), the access check (`access.ts`), where a person may plan (`scope.ts`), the reads the Week and Day share (`data.ts`), the shift writes they share (`actions.ts`), the rules for asking for cover (`cover.ts`), recording one person's answer to a request (`cover-offers.ts`: not a server action, because Google Chat names the person, not a Turnfin sign-in), the line to Google Chat (`chat.ts`: the settings, posting and changing a message, listing spaces, checking Chat's signature), the card a request is (`cover-card.ts`) and posting and refreshing it (`cover-chat.ts`) and the shift dialog and form fields.

## Front door (index.ts)
- `OFF_REASON_META`, for Core's tone check. No other app asks Plan anything while it is on test.

## Data owned
Declared in `prisma/schema/plan.prisma`:
- `plan_areas` (`PlanArea`) — retired: no longer read; areas are Admin › Areas. Waits for the owner's yes to be removed, with `plan_sessions.areaId`.
- `plan_duties`, `plan_duty_tasks` (`PlanDuty`, `PlanDutyTask`) — what people do in a shift, and the tasks each can come with (a task's `when` and `atMinutes` are retired: no longer read, waiting for the owner's yes to be removed).
- `plan_sessions`, `plan_session_needs`, `plan_session_days` (`PlanSession`, `PlanSessionNeed`, `PlanSessionDay`) — what's on (its Admin area in `siteAreaId`), the duties it needs, and single days changed or called off.
- `plan_shifts`, `plan_blocks` (`PlanShift`, `PlanBlock`) — shifts and the duty blocks in them, each with the duty's tasks chosen for it and when each starts and ends (`taskIds`, `taskMinutes`, `taskEndMinutes`).
- `plan_offs` (`PlanOff`) — people marked off.
- `plan_chat_spaces`, `plan_cover_requests`, `plan_cover_offers` (`PlanChatSpace`, `PlanCoverRequest`, `PlanCoverOffer`) — the Google Chat space each department's cover requests go to at a site, the gaps staff were asked to cover, and each person's latest answer.

No relations to Core tables: sites, departments, people and qualifications are read through Core's functions. Nothing is read from Rota's tables.

## Events
- Emits: none.
- Listens to: none.

## Registration (module.ts)
- Nothing yet: no home card, person file or Turnfin Me while it is on test.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `plan.view`, `plan.plan`, `plan.manage`.

## Depends on
- Platform: the policy engine, audit, the database client and the format helpers.
- Google Chat's API, as the Chat app's service account (`PLAN_CHAT_*`, [operations.md](../../../docs/operations.md)). Without the settings Plan works as before and nobody can be asked.
- Core reads (never Core tables): sites, areas (`areasAt`, `areaById`), departments and people through `src/lib/directory.ts`; qualifications through `src/lib/qualifications.ts`.
- Core's contributions registry (`src/modules/contributions.ts`: `commitmentsFor`, `planCommitment`) for Swim school's classes and booked assessments and Academy's sessions, and to plan a class's teacher or an assessment's assessor.
- The UI kit's workspace frame `ModuleShell`, `SiteSwitcher`, `DayTimeline` and `Inspector`.
- Other modules: none directly.
