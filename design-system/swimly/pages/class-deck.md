# The class, from the deck — `/courses/[id]/class`

Overrides MASTER.md for this page. Everything not mentioned follows the master
file and the conventions in `DESIGN.md`. Mode: Operate, on a phone, with wet
hands, in glare.

## Shape

Two steps behind a two-item tab strip, both in the URL (`?step=`):

1. **Attendance.** The register form as it is, with one change: its Save
   says "Save and continue" and lands on step two.
2. **Competencies.** One competency at a time across the whole class, not
   one swimmer at a time. A lesson runs a drill and then marks who got it,
   so the competency is the unit of the moment and the swimmers are the
   list.

The per-swimmer checklist, completing a level with gaps and moving a
swimmer up stay on `/courses/[id]/assess` for the desk; step two links to it
as "One swimmer at a time".

## Step two, in detail

- **Navigator.** One numbered chip per competency, 40px tall, in a row that
  bleeds to the screen edge and scrolls. The current one is `bg-primary`
  (a selection, so blue); one the whole class has achieved is the green tag
  pair with a check. Previous / Next are `icon-lg` outline buttons (44px on
  a phone) beside the competency's name.
- **The competency card** sits on `bg-sidebar`: "Competency 3 of 8", the
  name as an H2, its description, and "5 of 8 achieved" for the class.
  "Everyone achieved" is a ghost button under it — the "Everyone in" of
  this step.
- **Swimmer rows.** Name (with "Completed" or "Placed at another level"
  tags), "n of N achieved" beneath, and two buttons: *Working on it*
  (yellow pair when active) and *Achieved* (green pair when active). 44px
  tall and half-width each on a phone, 36px and fixed-width from `sm`.
  Tapping the active button takes the mark back to "not yet"; there is no
  third button for it.
- **One save for everything.** Every change across every competency is
  held locally, mirrored to `localStorage` under
  `swimly:assess:<course>:<date>`, and written by `saveClassAssessment` in
  one action with one audit line per swimmer touched. The sticky bottom bar
  shows "3 marks not saved yet" and a Save button while there is something
  to save, and "Done, back to Today" once there is not.
- **Ready to complete.** Swimmers eligible for the level and not yet
  confirmed are listed above the checklist with the existing Complete
  dialog, so the deck can confirm a level on the day it is earned.

## Not on this page

Week-by-week navigation, the class note read-only view for the desk,
moving a swimmer up. Those are desk tasks and live on the register and
assessment pages.
