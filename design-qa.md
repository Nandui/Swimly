# Swimmer profile — option 3

Date: 12 September 2026

**Findings**

No actionable P0/P1/P2 findings remain. The implementation retains the selected
journey structure: identity and actions, profile sections, dated enrolment
chapters, recent class activity and a current-state rail. Previous Today QA is
preserved in `.impeccable/review/swimmer-profile/previous-today-design-qa.md`.

**Visual evidence**

- Source visual truth: `C:/Users/ferna/.codex/generated_images/01a08d1f-f518-7111-9443-8526fb157453/exec-d93cc63d-8000-4027-aae3-00e31abecc1e.png`.
- Implementation: `D:/swimly/.impeccable/review/swimmer-profile/desktop-final.png`.
- Source and final implementation: 1488 × 1058 pixels. Browser viewport:
  1488 × 1058 CSS pixels, 1 image pixel per CSS pixel. No density resampling.
- Both artifacts were opened together in the same comparison input, including
  the final revised capture. Light theme; synthetic Jamie Example; Turtles
  chapter expanded, two past chapters collapsed, 4 of 6 achieved.
- Focused inspection covered the identity/actions, current chapter's progress
  and three activity rows, and the right rail. All text is readable at 1:1 in
  the combined input; a separate enlarged crop was unnecessary.
- Browser captures at `D:/swimly/.impeccable/review/swimmer-profile/` include
  `{375,768,1024,1280}-{light,dark}.png`, `375-medical.png` and `375-edit.png`.
  Every requested width had one H1 and no content overflowing horizontally.

**Comparison history**

1. `desktop-before.png`: [P2] verbose activity expanded the first chapter enough
   to hide most older chapters. [P2] the chronology lacked a connecting line.
   [P2] identity and the current-state rail had weaker proportions than the mock.
   Fixed with compact dated rows, a separate detailed activity expansion,
   timeline markers, a larger identity heading and a wider rail.
2. `desktop-after.png`: [P2] extra footer stacking and row height still made the
   open chapter too tall. Combined its actions into one wrapping row and reduced
   compact row spacing. On phones the progress label wrapped into a narrow
   column; the progress and its action now stack. Captured all responsive sizes.
3. `desktop-final.png`: [P2] shadcn AvatarFallback initially reduced the initials
   to its default small font. It now inherits the 24px avatar type size. The
   final capture was compared with the source again after this fix.

**Required fidelity surfaces**

- Typography: existing Figtree retained; clear identity, section, chapter and
  record hierarchy. Long names wrap; medical and contact values remain readable.
  Small record metadata follows the app's established scale.
- Spacing/layout: chapter progression, split content and rail follow option 3.
  The existing app toolbar and sidebar remain, so vertical positions differ
  from the mock's simplified chrome. This is an intentional app constraint.
  Tabs and controls wrap on phones; the rail stacks below the selected section.
- Colors/tokens: independent shadcn Neutral tokens in light and dark. Semantic
  green/blue states use the existing metadata/token system. Neutral primary
  actions and links follow the established workspace instead of the mock's blue
  link treatment. Medical alerts remain conspicuous in both modes.
- Image quality/assets: the design requires no raster imagery. Actual shadcn
  Avatar/Fallback and Progress, plus existing Lucide icons, implement the UI.
  No real swimmer data was used in exported screenshots.
- Copy/content: the chosen chapter narrative is retained. Added Assessments to
  preserve existing functionality. Exact enrolment dates, current record labels
  and historical-gap wording avoid implying details that were never recorded.

**Interaction and data verification**

- Opened individual competency history with before/after, actor and timestamp;
  no recursively repeated History control inside that dialog.
- Switched tabs with a dirty competency mark; the draft remained. A simulated
  save refreshed the displayed count and cleared the dirty state.
- Opened Manage enrolment, searched a destination at the other site, entered a
  placement reason, and reached the server-confirmation UI using simulated
  actions. No real record mutations were performed.
- Loaded 37 synthetic events through the 30-event boundary. Checked empty
  search, error/retry affordance and an unplaced swimmer with no next lesson.
- Checked a long name, a prominent synthetic medical note, an emergency phone
  without a name, and the scrolling phone edit dialog with visible save/cancel.
- Real dev directory and a real profile loaded successfully; history loaded and
  browser error count was zero. Only structural checks were returned, with no
  real names, contacts, medical information or screenshots exported.
- Server tests run against explicit doubles and isolated PGlite. They cover
  shared aliases, audit permissions, record scoping, structured evidence,
  corrections, no-op saves, transaction rollback, stable cursors, historical
  programmes and next weekly lessons.

**Checks run**

- `npm run typecheck`: passed.
- `npm run lint`: passed without warnings.
- Focused tests across student history, progress data, competency actions and
  attendance actions: 27 passed.
- `npx next build`: passed (compilation, TypeScript and page generation). An
  initial mixed-encoding source failure was corrected before the successful run.
- `git -c core.safecrlf=false diff --check`: passed.
- Dev server restarted at `http://127.0.0.1:3000` with the regenerated Prisma
  client. Synthetic interactive review is served at `http://127.0.0.1:3031`.
- The additive nullable AuditLog.details migration was applied. Historical
  summaries were retained; new attendance/competency changes retain evidence.

**Limitations and follow-up polish**

- Older data cannot reconstruct changes that were never captured. Those entries
  remain marked as saved snapshots or historical summaries.
- Next lesson follows the weekly timetable and enrolment start/end dates.
- The mock's simplified sidebar, green avatar and blue links are deliberately
  adapted to the application's existing shadcn Neutral workspace.
- No deployment or push was requested in this turn.

**Implementation checklist**

- [x] Selected layout implemented with actual shadcn controls.
- [x] Current and historical enrolments, marks and audit boundaries preserved.
- [x] Responsive and dark-mode evidence captured and inspected.
- [x] Existing Instructor workspace remains isolated.
- [x] Relevant validation passed; dev preview available.

final result: passed
