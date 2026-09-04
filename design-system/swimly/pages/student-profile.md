# Student profile — `/students/[id]`

Overrides MASTER.md for this page. Everything not mentioned follows the master
file and the conventions in `DESIGN.md`.

## Shape

Three layers, top to bottom. Not one scroll.

1. **Header.** Name and status tag, then one line of facts: age, and the
   level and slot of every active place ("7 years old · Turtles, Wed 15:10").
   Actions on the right: Enrol in a class, Edit, Mark inactive. The primary
   thing the desk does from this page is enrol, so it lives here, not in a
   tab.
2. **Never far away.** The medical strip, red, directly under the header,
   collapsed to its summary line. Then two panels side by side (stacked below
   `md`): *Personal details* (member number, date of birth with age, joined,
   photo consent, notes) and *Contacts* (contact, phone, email, in an
   emergency). Phone numbers are `tel:` links: the desk rings from a phone.
3. **What grows week on week**, behind tabs: Classes (default) · Progress ·
   Attendance · Assessments. One section on screen at a time.

## Tabs

- The tab is a URL search param (`?tab=progress`), rendered by links with
  `aria-current="page"`, never a client-side widget. A bookmark or a message
  can point at one section; the back button works; the server renders only
  the active section.
- Active: `border-b-2 border-primary text-foreground`. Inactive:
  `text-muted-foreground`, border transparent, hover `border-border`.
- A count pill beside the label where the section is a list (classes,
  registers, assessments). None on Progress: it is a standing, not a count.
- The strip may scroll horizontally inside itself below 375px; the page never
  does.

## Panels

`Panel` in `src/components/students/profile-sections.tsx`: `rounded-md
border`, a `bg-sidebar` head with the title at 12px muted, the same head the
tables use, so the pair and the lists below read as one family. Rows are a
`dl` with a 7rem label column. Empty values are an em dash in
`text-muted-foreground/70`, never blank.

## Empty states

Each tab has one, with the icon of the thing that is missing and, where the
reader can do something about it, the action: enrol from Classes, go to
Assessments from Assessments. Attendance and Progress only explain.
