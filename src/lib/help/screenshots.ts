import dimensions from "../../../assets/help/manifest.json";
import type { HelpScope } from "./types";

export type HelpScreenshot = { id: string; width: number; height: number; alt: string; caption: string };
type Placement = { image: string; step: string; caption: string; alt: string; scope?: HelpScope };

// Screenshots are attached by step title so a reordered guide does not silently move an illustration.
export const GUIDE_SCREENSHOTS: Record<string, Placement[]> = {
  "home-page": [
    { image: "home", step: "Check what is waiting for you", caption: "Home opens on the day at your site, with what is waiting for you and your quick actions.", alt: "Duty desk home page in the frame: the fin, the swim school page bar, the site picker and account in the tools bar, then Classes today, Waiting for you rows with counts, Today at the site figures and Quick actions." },
  ],
  "log-refund": [
    { image: "refund-new", step: "Fill in the customer and the payment", caption: "The request has two panels: the customer and service, then the original payment and refund.", alt: "New refund request form in the frame with Customer and service fields, Original payment and refund fields, and Save draft and Submit to finance in the bar at the bottom." },
  ],
  "decide-refund": [
    { image: "refund-decision", step: "Approve, decline or ask", caption: "Finance reads the request and chooses what happens next from the actions beside it.", alt: "A fictional refund request for Sam Example, waiting for review, with its details and the finance actions to take responsibility, approve, ask for information or decline." },
  ],
  "find-document": [
    { image: "docs-home", step: "Search from the Docs overview", caption: "Search from the Docs overview, or open emergency plans and the library.", alt: "Docs overview in the frame with the Find a document search, Emergency plans, Your work rows, Collections and Recently published documents." },
  ],
  "write-document": [
    { image: "docs-new", step: "Start a new document", caption: "Choose a template; the panel beside it shows the structure you start with.", alt: "Create a document page at the Choose a template step, with document types as choice rows and the selected template’s starting sections." },
  ],
  "assign-training": [
    { image: "training-assign", step: "Choose the course and the people", caption: "Pick the course and due date, then tick the people or add everyone on a role.", alt: "Assign training dialog with Course, optional Due by date, Add everyone on a role, a name filter and fictional people as checkbox rows." },
  ],
  "sign-off-training": [
    { image: "training-signoff", step: "Sign it off or send it back", caption: "Each row shows who is ready, the course and their note, with Not yet and Sign off beside it.", alt: "Training Sign-off page with a fictional lifeguard ready for the pool rescue refresher, and Not yet and Sign off buttons." },
  ],
  "plan-week": [
    { image: "rota-week", step: "Open the week plan", caption: "One row per person, To fill at the top, and a tag on any shift that needs a look.", alt: "Rota week plan at a fictional site with day tiles, a To fill row, a person’s shifts marked Absent, Off days and Add a shift." },
  ],
  "report-absence": [
    { image: "rota-absence", step: "Fill in who and when", caption: "Choose who is off, from when and why; the last day can wait until you know it.", alt: "Report an absence dialog with Who is off, First day off, Reason, an optional Last day off and Note." },
  ],
  "hr-note": [
    { image: "hr-note", step: "Choose who can read it", caption: "Each note says who can read it: only you, anyone with their HR record, or the person too.", alt: "Add a note dialog for a fictional colleague with the note field and Who can read it choices: Only me, On their record and Shared with them." },
  ],
  "hr-review": [
    { image: "hr-review", step: "Share it with them", caption: "A shared review waits for the person to acknowledge it in Turnfin Me.", alt: "A fictional probation review shared with the person, Awaiting acknowledgement, showing its summary, strengths, goals and overall." },
  ],
  "legend-agreements": [{ image: "legend-agreements", step: "Open Legend agreements", caption: "Outstanding lists each active class place that needs checking or still needs its Legend agreement updated.", alt: "Legend agreements page in the frame with fictional swimmers as rows, their class times, Needs checking tags and Confirm updated actions." }],
  "assessment-enrolment-follow-up": [{ image: "assessment-awaiting-enrolment", step: "Open Awaiting enrolment", caption: "Awaiting enrolment lists assessed swimmers and class waitlists to follow up.", alt: "Awaiting enrolment page in the frame with Enrolments and waitlists and Awaiting moves, and fictional swimmers waiting for a place." }],
  "parent-link-requests": [{ image: "parent-link-request", step: "Confirm the decision and reply", caption: "Match the existing swimmer, write the parent’s reply and record an internal reason before approving.", alt: "Approve access to a swimmer dialog for fictional parent Pat Example, with the existing-swimmer search, the reply to the parent and the reason." }],
  "parent-access": [{ image: "parent-profile", step: "Approve the guardian’s email", caption: "Approval names the swimmer, the guardian’s email and your reason for granting access.", alt: "Approve parent email dialog for a fictional swimmer with the guardian’s email and a reason field." }],
  "parent-accounts": [{ image: "parent-accounts", step: "Confirm the account change", caption: "Suspending ends the parent’s current sessions and affects all their linked swimmers.", alt: "Suspend parent account dialog naming sample.parent@example.test, with a reason field and Suspend account." }],
  "publish-parent-assessment": [{ image: "parent-publication", step: "Choose Publish to the parent app", caption: "Check the session, then set a booking deadline in Ireland time or leave it blank to close at the start.", alt: "Publish assessment to the parent app dialog with a fictional session, an optional booking deadline and a reason." }],
  "get-started": [{ image: "workspace", step: "Plan today’s work", caption: "The fin and the module’s page bar run along the top, the tools bar with the site picker sits on the right, and your modules are down the left.", alt: "Swim school Schedule in the frame: the fin, the page bar with Schedule selected, the tools bar with swimmer search, the Hillview site picker and the account menu, and the modules bar down the left." }],
  "switch-sites": [
    { image: "site-menu", step: "Choose the site you are working at", caption: "Open the site picker in the tools bar and choose the site you are working at.", alt: "Working site menu open from the tools bar, with Hillview selected and Riverside available.", scope: "desk" },
    { image: "instructor-site", step: "Choose the site you are working at", caption: "The site picker is in the pool deck’s top bar.", alt: "Pool deck top bar with the Working site menu open and both fictional sites listed.", scope: "instructor" },
  ],
  "appearance": [
    { image: "appearance", step: "Open your account menu", caption: "Appearance is at the top of your account menu, under your name.", alt: "Account menu open from the tools bar: the person’s name, role and site, Appearance with System, Light and Dark, then Manage account and Sign out.", scope: "desk" },
    { image: "instructor-menu", step: "Open your account menu", caption: "On the pool deck, Appearance is in the menu under your initials.", alt: "Pool deck account menu open: name, role and site, Appearance with System, Light and Dark, and Sign out.", scope: "instructor" },
  ],
  "account-password": [{ image: "password", step: "Enter the password details", caption: "Enter the current password and the new password twice.", alt: "Account page in the frame with Appearance and the Change password panel: Current password, New password and New password again." }],
  "missing-access": [
    { image: "roles", step: "Ask for the access needed for your task", caption: "An administrator checks the level your role has in each module.", alt: "Edit role dialog with the name, home page name and description, then a row of levels for each module, such as None, Desk and Manage for Swim school.", scope: "desk" },
    { image: "instructor-home", step: "Check the workspace", caption: "The pool deck has its own frame with Classes and Swimmers, and no desk pages.", alt: "Pool deck classes page with the fin, Classes and Swimmers in the page bar, the site picker, Help and the account menu.", scope: "instructor" },
  ],
  "saving-and-connection": [{ image: "save-conflict", step: "Resolve changes made by someone else", caption: "Compare the saved attendance with your draft before choosing which to keep.", alt: "Attendance conflict notice showing a swimmer saved as Absent against a Late draft, with Use saved attendance and Save my version." }],
  "instructor-account": [{ image: "instructor-menu", step: "Open your account menu", caption: "Sign out from your account menu when your teaching work is saved.", alt: "Pool deck account menu open: your name, role and site, the Appearance choices and Sign out." }],
  "find-swimmer": [{ image: "directory", step: "Check the identifying details", caption: "Use the level, site and contact to identify the correct swimmer.", alt: "Swimmers page in the frame with the search, All, Active and Inactive filters, and fictional swimmers as rows with level, site and status." }],
  "add-swimmer": [{ image: "add-swimmer", step: "Enter the swimmer’s information", caption: "Start with the name, then complete the contact and other details you have.", alt: "Add a swimmer dialog with a fictional name, date of birth, member number, main contact fields and Add and open profile." }],
  "swimmer-history": [{ image: "profile", step: "Start with Journey", caption: "Journey groups the swimmer’s enrolments and progress into chapters.", alt: "Fictional swimmer profile in the frame with its tabs, the Journey chapters and the Swimmer at a glance panel." }],
  "inactive-swimmers": [{ image: "edit-swimmer", step: "Change the status in Edit details", caption: "Status is at the bottom of Edit swimmer details.", alt: "Edit swimmer details dialog with name, contact fields, the Active status selector and Save details." }],
  "enrol-swimmer": [{ image: "enrol", step: "Select a class and check its details", caption: "Filter the class list, then check the selected class before you continue.", alt: "Enrol in a class dialog with site, level, day and time filters and class rows with available places." }],
  "move-swimmer": [{ image: "move", step: "Check the selected-class summary", caption: "The current class is above the filters; the selected class and Different site show at the bottom.", alt: "Move to another class dialog with the current class, the site and level filters, a fictional class at another site selected, and the selected-class summary marked Different site." }],
  "waitlist": [{ image: "waitlist", step: "Activate the place when space is available", caption: "An active place and a waitlist place appear separately. Use Enrol from waitlist when there is room.", alt: "Manage enrolment dialog with an Active Otters place and a Waitlisted Seals place, with Move class, Enrol from waitlist and Unenrol." }],
  "end-enrolment": [{ image: "end-enrolment", step: "Choose when it ends", caption: "Check When before confirming the end of a place.", alt: "End this enrolment dialog with When, They finished the class, a reason or note, and Confirm change." }],
  "sibling-times": [{ image: "together", step: "Compare the options", caption: "Together finds class times that suit every swimmer in a family.", alt: "Together page in the frame where staff add the swimmers in a family to compare class times." }],
  "find-class": [
    { image: "classes", step: "Search Classes", caption: "Use the site, level and day filters to narrow the weekly class list.", alt: "Classes page in the frame with search and filters, and classes as rows with time, pool, instructor and places." },
    { image: "class-detail", step: "Inspect the roster and waitlist", caption: "Open a class to see its schedule, places and enrolled swimmers.", alt: "Otters class page with figure tiles for schedule, pool area, instructor and places, and the enrolled swimmers with Move swimmer and Unenrol." },
  ],
  "daily-schedule": [{ image: "schedule", step: "Read the booking sheet", caption: "Levels run down the left; start times run across the top.", alt: "Schedule booking sheet with the week as day tiles, Booking sheet and Agenda, and classes arranged by level and time." }],
  "manage-class": [{ image: "add-class", step: "Add the weekly class", caption: "Check the site, level, weekly time and capacity before saving.", alt: "Add class dialog with level, day, start time, duration, capacity, instructor and pool-area fields." }],
  "start-class": [{ image: "start-class", step: "Choose Start class", caption: "Confirm that you are teaching this dated class. Other authorised instructors can also help.", alt: "Start Seals? confirmation with the class time and scheduled instructor, an explanation that the start is recorded and other instructors can also help, and Confirm and start." }],
  "take-attendance": [{ image: "attendance", step: "Check each swimmer’s attendance", caption: "Choose each swimmer’s attendance status and review the roster before saving.", alt: "Pool deck attendance step for Otters with fictional swimmers, Present, Late and Absent choices, Everyone in and Save and continue in the bar at the bottom." }],
  "record-competencies": [
    { image: "competencies", step: "Mark what was demonstrated", caption: "Work through one competency at a time and mark the swimmers who were in today.", alt: "Desk competencies step for Otters, with a swimmer ready to complete the level and a competency picker to mark the class.", scope: "desk" },
    { image: "instructor-swimmer-competencies", step: "Mark one swimmer’s competencies", caption: "Expand a swimmer to mark their competencies individually or mark all achieved, then save the class’s changes.", alt: "Pool deck competencies step By swimmer, with a fictional swimmer expanded to show each competency’s mark and Mark all achieved.", scope: "instructor" },
    { image: "instructor-by-competency", step: "Work through one competency", caption: "Switch to By competency to mark one skill across the class. Both views share the same pending marks.", alt: "Instructor By competency view with previous and next controls, fictional swimmers, achieved choices and a bulk action for swimmers in today.", scope: "instructor" },
    { image: "instructor-class-overview", step: "Plan teaching from the class overview", caption: "Each competency card shows how many swimmers have achieved it.", alt: "Class overview with a tile for each competency and fictional achievement totals.", scope: "instructor" },
    { image: "instructor-class-overview-mobile", step: "Plan teaching from the class overview", caption: "The same totals appear in two columns on phones.", alt: "The class overview on a phone, with competency names and achieved totals as tiles.", scope: "instructor" },
  ],
  "complete-class-level": [
    { image: "complete-class", step: "Confirm completion", caption: "Level completion has its own confirmation and optional note.", alt: "Complete Otters for a fictional swimmer: every competency is signed off, with a note field and Confirm completion.", scope: "desk" },
    { image: "instructor-swimmer-competencies", step: "Open the class’s Competencies step", caption: "Review and save every competency before confirming a swimmer is ready to move.", alt: "Pool deck competencies step with a fictional swimmer expanded, each competency’s mark and Mark all achieved.", scope: "instructor" },
  ],
  "profile-competencies": [{ image: "profile-competencies", step: "Inspect the current evidence", caption: "Expand a level to read its marks, assessor and dates.", alt: "Swimmer profile Competencies tab for Otters with the achieved count, each competency’s mark, who assessed it and History." }],
  "complete-level": [{ image: "complete-level", step: "Confirm an eligible completion", caption: "Review the achieved competencies and add a completion note if needed.", alt: "Complete Otters dialog showing four of four competencies achieved, a completion note and Confirm completion." }],
  "assessment-sessions": [{ image: "assessment-session", step: "Complete the practical details", caption: "An assessment is a dated session with its own assessor and capacity.", alt: "Add an assessment session dialog with programme, kind, date, start, minutes, places, pool, assessor and notes." }],
  "book-assessment": [{ image: "assessment-booking", step: "Choose Book a swimmer", caption: "Check the session in the heading, then search for the swimmer.", alt: "Book onto the assessment dialog naming the session date and time, the places taken and a swimmer search." }],
  "assessment-outcome": [
    { image: "instructor-assessments", step: "Open today’s assessment", caption: "Today’s assessments appear above the weekly class filters for every instructor at this site.", alt: "Pool deck classes page with today’s fictional assessment session, its time, pool and bookings, above the classes.", scope: "instructor" },
    { image: "assessment-outcome", step: "Place a swimmer who was assessed", caption: "Choose the outcome level and record what you observed.", alt: "Where does this swimmer belong? dialog for a fictional swimmer, with a level picker, a note and Place." },
  ],
  "cancel-class-session": [{ image: "cancel-session", step: "Record the reason", caption: "This confirmation cancels one session and records why it cannot run.", alt: "Cancel this session? dialog with the class, date and time, a fictional reason for cancellation, Keep session and Confirm cancellation." }],
  "billing-follow-up": [{ image: "billing", step: "Record the handoff", caption: "After contacting billing, save a handoff note against the affected swimmers.", alt: "Cancelled Otters session awaiting billing, with the reason, the affected fictional swimmers, a billing handoff note and Mark billing notified." }],
  "analytics": [
    { image: "analytics", step: "Compare swimmers and places", caption: "Current swimmer totals sit alongside this Monday–Sunday week’s recorded activity.", alt: "Analytics page in the frame with fictional swimmer totals, this week’s enrolment activity, places by level and cancellations." },
    { image: "analytics-reception", step: "Compare reception activity", caption: "Reception activity groups recorded actions by person, with a daily breakdown for each.", alt: "Reception activity report with fictional staff, weekly enrolment and unenrolment totals, and daily breakdown controls." },
    { image: "analytics-instructors", step: "Check instructor attendance", caption: "Find missing or partial attendance, then inspect the class and the staff who saved marks.", alt: "Instructor attendance report with fictional instructors, saved and missing registers, and dated class details." },
  ],
  "manage-curriculum": [
    { image: "programme", step: "Open or add a programme", caption: "A programme contains the ordered levels used at every site.", alt: "Add a programme dialog with a fictional name, a description and an optional image." },
    { image: "curriculum", step: "Describe the competencies", caption: "State the skill clearly and add instructor guidance when needed.", alt: "Add a competency to Otters dialog with What the swimmer has to do and Notes for the instructor." },
  ],
  "manage-staff": [{ image: "staff", step: "Add the person", caption: "Create an individual account and choose its role.", alt: "Add a person dialog with a fictional name and email, the role picker and a temporary password field." }],
  "manage-roles": [{ image: "roles", step: "Choose a level in each module", caption: "Pick a level for each module; the line under each row says what it allows.", alt: "Edit role dialog with the name, home page name and description, then a row of levels for each module, such as None, Desk and Manage for Swim school." }],
  "manage-clubs": [{ image: "clubs", step: "Add or rename a site", caption: "A new site starts with an empty timetable and uses the shared records.", alt: "Add a site dialog explaining that swimmers, programmes and progress are shared, with a fictional site name." }],
  "activity-log": [{ image: "activity", step: "Read the entry", caption: "Each entry identifies the change, the person and the time.", alt: "Activity page in the frame listing fictional changes with what happened, who and when." }],
};

export const HELP_IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = dimensions;
export function screenshotHref(id: string) { return `/help/images/${encodeURIComponent(id)}`; }
export function screenshotsForStep(slug: string, step: string, scope: HelpScope): HelpScreenshot[] {
  return (GUIDE_SCREENSHOTS[slug] ?? []).filter(item => item.step === step && (!item.scope || item.scope === scope)).map(item => ({
    id: item.image, ...HELP_IMAGE_DIMENSIONS[item.image], caption: item.caption, alt: item.alt,
  }));
}
