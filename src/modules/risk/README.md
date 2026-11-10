# Risk assessments

**Purpose:** keeps each site's risk assessments current, from a first draft to a signed-off record that is reviewed on time.

Its levels are in [docs/apps.md](../../../docs/apps.md); the rules live in `shared/` and its tests. Brought over from the standalone Risk Management app ([D29](../../../docs/decisions.md)).

## Features
- `assessments`: the lists (`/risk-assessments`), one assessment's page (`/risk-assessments/[id]`), starting a draft and changing its details (`/risk-assessments/new`, `/risk-assessments/[id]/edit`), and the moves on it: send for sign-off, sign off or withdraw (its owner), the executive sign-off (someone else, with that tick), archive and bring back (Manage). Also what the app holds about a person, and area renames.
- `hazards`: adding, changing and removing an assessment's hazards (on its page), the high-risk list (`/risk-assessments/high-risk`), and the site's assessed hazards for other apps (the hazard register plug).
- `reviews`: logging a review, asking for one and answering the request (on the assessment's page), the Reviews page (`/risk-assessments/reviews`), the Home items, and the review request an incident raises.
- `export`: one assessment's full record to print or save as a PDF (`/risk-assessments/[id]/export`).
- `import`: bringing assessments over from the old app, for the operator script `scripts/import-risk-assessments.ts` ([docs/operations.md](../../../docs/operations.md)).
- `workspace`: the frame and its one page list (`pages.ts`) for the sidebar and the starter page `/risk-assessments/overview`.

`shared/` holds what two or more features use: statuses, bands, scales and the history's words (`types.ts`), the pure rules (`rules.ts`, tested in `rules.test.ts`), the access check (`access.ts`), the locked, audited write (`service.ts`, `step.ts`), one assessment with everything on its page (`load.ts`) and how a hazard reads (`components/hazard-card.tsx`).

## How it works
- An assessment is about one **area** (from the site's areas), one **job** (from Admin's positions) or one **activity** (typed), at one site. One thing has one live assessment at a site.
- It is a **draft**, **waiting for sign-off**, **in force** or **archived**. Its owner signs it off; the executive sign-off sits on top and never changes the status.
- Each hazard is rated twice, likelihood times severity (1 to 25): before any controls, and with the controls in place. Low is 1 to 4, Medium 5 to 9, High 10 to 16, Very high 17 to 25. A hazard's number is never reused; a removed hazard is hidden, not deleted.
- Changing an assessment that was signed off (its details or its hazards) clears the sign-off, and it waits for sign-off again.
- Only an assessment in force is on a review schedule. An overdue review is shown on it, on Reviews and on Home; it never changes the status.
- Nothing is deleted: assessments are archived.

## Front door (index.ts)
- `RISK_STATUS_META`, `RISK_BAND_META`, `RISK_REVIEW_META`, `RISK_REQUEST_META`: each status's, band's and state's label, tone and icon. Used by the platform's status-metadata test.

Nothing else in Turnfin calls into Risk assessments. Routes use the feature entries (`features/<feature>/index.ts`).

## Data owned
Declared in `prisma/schema/risk.prisma`, migration `20261216090000_risk_assessments` (new tables only):
- `risk_assessments` (`RiskAssessment`): the assessment, what it is about, its owner, status, sign-offs, target and review days.
- `risk_hazards` (`RiskHazard`): its hazards, their ratings, controls and what is still to do.
- `risk_reviews` (`RiskReview`): the reviews carried out.
- `risk_review_requests` (`RiskReviewRequest`): who asked for another look, why, how it was answered, and the incident that raised it when one did (its id and number only).
- `risk_events` (`RiskEvent`): the history, one row per step.

## Events
- Emits: none.
- Listens to: `incidents.hazards.flagged`, raises one review request on each assessment in use that holds one of the hazards, in the name of whoever flagged them.

## Registration (module.ts)
- Starter page and Home items (`registerHomeCard`), for those who write: assessments for you to sign off; reviews overdue; review requests to answer; Start a risk assessment.
- Subject access records `risk` (`registerSubjectRecords`): the assessments a person owns, started or signed, the reviews they logged and the reviews they asked for.
- Area renames `risk.areas` (`registerAreaRename`).
- The hazard register (`registerHazardRegister`): the hazards on assessments in force or waiting for sign-off at a site, searched, for Incidents to link.
- Menu entry, levels and permissions: `manifest.ts`, listed in `src/app/modules.ts`.

## Permissions
- `risk.read`, `risk.write`, `risk.manage`, `risk.signoff`.

## Depends on
- Platform: auth and the policy engine (`src/lib/policy`), audit (`src/lib/audit`), dates (`src/lib/format`), the database client, the plugs and the event bus (`src/modules/contributions`, `src/platform/events`).
- Platform reads (never its tables): sites, areas, positions, departments and people through `src/lib/directory.ts` (`liveSitesOf`, `liveSiteById`, `sitesByIds`, `siteName`, `withSites`, `areaNamesAt`, `livePositionsOf`, `departmentsForSite`, `departmentById`, `activeStaffAtSite`, `activeStaffHolding`).
- The UI kit's workspace frame `ModuleShell` and record pieces (`ui-kit/record.tsx`).
- Other apps: none. A review request raised by an incident links to that report by URL.
