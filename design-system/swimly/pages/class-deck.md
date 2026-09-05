# Today — `/today`

The deck's front door. Mode: Operate, on a phone, wet hands, glare. The
thing to do next is the screen.

- **One line of header.** "Today" with the date beside it in muted 16px. No
  sentence under it; the tab counts (kept at phone width) say how many.
- **The card.** On My classes grouped by time, the class on now — or the
  next one when none is running — is one card that is itself the link:
  time at 20px, a NOW or NEXT pill, the class name at 24px, pool and
  headcount at 16px, and the verb ("Start class" / "Open class") on a
  44px line at the foot. Blue (`bg-primary`, white ink, white pill with blue
  ink) when it is yours to take; `border-input` on the page ground when
  attendance is in, someone else is covering, or you may only look. Two
  cards at most; a section with more than two classes at once is the desk
  looking, and gets the list instead.
- **Rows are the link.** Everything still to come sits under the card as
  plain rows, 56px tall minimum, the whole row tappable: name at 17px
  semibold, meta at 14px muted, and a "Start" or "Open" label at the right
  edge in primary or muted ink. No buttons in rows. The class name is text,
  never a link: nothing on Today leads off the deck. The desk's page for a
  class is a link on the class page's title instead.
- **Earlier today** folds into one line at the bottom, 44px tall, with the
  count and "attendance still to take for N" in the orange tag ink. When
  the whole day has finished there is no card and no fold, just the rows.
- **All classes** has no card, because five classes can be on at once; the
  section on now gets a tint (`bg-accent/50`) on its list instead, and the
  Now and Next tags on the section headings.
- **Level grouping** is the plain list, time at the start of each row.
- **Type floor** on this page is 14px; tap floor is 44px.

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

## Rules that hold on both steps (added 5 Sep 2026, after the critique)

- **A chosen mark has an edge and a tick.** Present, Late, Absent, Working
  on it and Achieved use the tag pair's fill with a 2px border in the pair's
  ink and a check glyph. A fill alone measured 1.1:1 against the page; in
  glare that is invisible.
- **44px and 14px on a phone, both steps.** Attendance buttons, "Everyone
  in", competency chips and mark buttons are all `h-11` and `text-sm` at
  phone width; 36px from `sm`.
- **Step two knows who was in.** Once attendance is taken, the absent
  swimmers fold under "Not in today (n)" below the list, dimmed but still
  markable; "Everyone in today achieved" applies to those present or late;
  the card's count reads "3 of 6 in today achieved". Before attendance is
  taken nobody is ruled out and the label is the plain "Everyone achieved".
- **The bar tells the truth.** Step two lands with "Nothing marked yet" and
  an outline "Back to Today"; after a save it reads "Saved" with the blue
  "Done, back to Today". The blue button is never the way out of an empty
  page. Marks that came back from the phone say so: "Kept on this phone,
  not saved yet". The status line is `aria-live="polite"` on both steps.
- **A save that cannot reach the server is caught.** Both saves race a
  15-second timeout; a throw or a timeout shows one sentence in the form,
  "Could not reach the server. Your marks are kept on this phone. Try again
  when the signal is back.", and leaves Save enabled.

## Not on this page

Week-by-week navigation, the class note read-only view for the desk,
moving a swimmer up. Those are desk tasks and live on the register and
assessment pages.
