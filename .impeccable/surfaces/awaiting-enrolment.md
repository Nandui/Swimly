---
version: 1
slug: "awaiting-enrolment"
primary_target: "src/components/enrolment/awaiting-enrolment.tsx"
related_targets: ["src/components/enrolment/awaiting-moves.tsx", "src/components/enrolment/awaiting-queue.tsx", "src/components/enrolment/follow-up-history.tsx"]
---

# Awaiting enrolment reception queue

## THESIS
Operate: reception needs to arrange the next class and leave colleagues a clear
family follow-up. The owner chose to prioritise placement and follow-up together.

## OWN-WORLD
Extend Aquatics' established DESIGN.md: Neutral surfaces, Figtree, blue actions
and selections, semantic metadata badges, shadcn controls. No new visual identity.

## STORY
Choose enrolments/waitlists or moves, find a swimmer, inspect the class need and
latest family update together, then choose a class or record contact/work.

## FIRST VIEWPORT
Compact heading and segmented route navigation, full-width search, accurate queue
count and oldest-first context. A bordered directory aligns family, placement and
follow-up. No invented totals or dashboard charts. On tablets the follow-up spans
the row; on phones all content stacks without truncating names or controls.

## FORM
Existing server-rendered queues with a shared shadcn Item layout. Record update
opens the existing Sheet at the form; History remains a separate entry point.
Show the latest note excerpt with the complete note in history, next contact date,
outcome and author. Keep placement/review guards and pagination unchanged.

## BUILD AND VERIFICATION
Code-led extension of the existing workflow; no concept seed or new-world round.
No unresolved product decisions. Use isolated synthetic fixtures for screenshots
and saves. Inspect both views and themes at 375/768/1024/1280, keyboard return focus,
drafts, save/refresh, empty/read-only states, search and placement dialogs.

Revision: the owner found the exposed three-column rows confusing. Default to
compact swimmer rows and one View action. Show placement and family follow-up
together only after selection; remove extra heading and explanatory copy.


Contact integration: show the latest outcome, contact date, method, author and
two-line note in each compact row. Expanded rows show the complete contact
timeline beside placement and family details; adding contact or internal notes
uses an inline form. Keep the profile Sheet. Fetch history on expansion and
preserve drafts across form hiding and row closing. No backend rule changes.
