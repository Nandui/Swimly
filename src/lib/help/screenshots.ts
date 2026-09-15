import dimensions from "../../../assets/help/manifest.json";
import type { HelpScope } from "./types";

export type HelpScreenshot = { id: string; width: number; height: number; alt: string; caption: string };
type Placement = { image: string; step: string; caption: string; alt: string; scope?: HelpScope };

// Screenshots are attached by step title so a reordered guide does not silently move an illustration.
export const GUIDE_SCREENSHOTS: Record<string, Placement[]> = {
  "parent-access": [{ image: "parent-profile", step: "Approve the guardian’s email", caption: "Approval identifies the swimmer, guardian email and the reason for granting access.", alt: "Approve parent email dialog for Avery Example with a synthetic guardian email and an audit reason." }],
  "parent-accounts": [{ image: "parent-accounts", step: "Confirm the account change", caption: "Suspending ends the parent’s current sessions and affects all their linked swimmers.", alt: "Suspend parent account confirmation identifying parent@example.test and a reason field." }],
  "publish-parent-assessment": [{ image: "parent-publication", step: "Choose Publish to LeisureWorld Aquatics", caption: "Check the site and session, then set a booking deadline in Ireland time or leave it blank for the start.", alt: "Publish assessment dialog with an example Bishopstown session, optional booking deadline and audit reason." }],
  "get-started": [{ image: "workspace", step: "Plan today’s work", caption: "The desk navigation and daily Schedule sit together in the workspace.", alt: "Desk sidebar with Schedule selected and a booking sheet showing class times, pool areas and places." }],
  "switch-sites": [
    { image: "site-menu", step: "Choose the site you are working at", caption: "Open Working area and choose the site for your timetable.", alt: "Working area menu with Bishopstown selected and Churchfield available.", scope: "desk" },
    { image: "instructor-site", step: "Choose the site you are working at", caption: "The site selector stays in the Instructor header.", alt: "Pool-deck header with the Working area menu open and both sites listed.", scope: "instructor" },
  ],
  "appearance": [
    { image: "appearance", step: "Follow the device when available", caption: "Account offers System, Light and Dark appearance.", alt: "Appearance control with System, Light and Dark choices; Light is selected.", scope: "desk" },
    { image: "instructor-home", step: "Use the appearance button", caption: "Use the moon or sun button beside Help in the Instructor header.", alt: "Pool-deck header showing Help, the moon appearance button and the account menu.", scope: "instructor" },
  ],
  "account-password": [{ image: "password", step: "Enter the password details", caption: "Enter the current password and the new password twice.", alt: "Change password form with Current password, New password and New password again fields." }],
  "missing-access": [
    { image: "roles", step: "Ask for the access needed for your task", caption: "An account manager checks the screens and permissions assigned to your role.", alt: "Role editor for a demonstration teaching role, showing the available screen grants.", scope: "desk" },
    { image: "instructor-home", step: "Check the workspace", caption: "Instructor has a separate teaching header and no desk sidebar.", alt: "Instructor navigation with Classes, working site, Help, appearance and account controls.", scope: "instructor" },
  ],
  "saving-and-connection": [{ image: "save-conflict", step: "Resolve changes made by someone else", caption: "Compare the saved attendance with your draft before choosing which to keep.", alt: "Attendance conflict message showing saved absent marks versus a present draft and recovery buttons." }],
  "instructor-account": [{ image: "instructor-menu", step: "Open your account menu", caption: "Sign out from the person menu when your teaching work is saved.", alt: "Instructor account menu open with a Sign out action." }],
  "find-swimmer": [{ image: "directory", step: "Check the identifying details", caption: "Use the member number, level and contact to identify the correct swimmer.", alt: "Shared swimmer directory with four example swimmers, member numbers, current levels, contacts and Active status." }],
  "add-swimmer": [{ image: "add-swimmer", step: "Enter the swimmer’s information", caption: "Start with the name, then complete the contact and other details you have.", alt: "Add a swimmer form containing a demonstration name and member number, with contact fields below." }],
  "swimmer-history": [{ image: "profile", step: "Start with Journey", caption: "Journey groups the swimmer’s enrolments and progress into chapters.", alt: "Example swimmer profile showing Journey, enrolment chapters, competency progress and current class details." }],
  "inactive-swimmers": [{ image: "edit-swimmer", step: "Change the status in Edit details", caption: "Status is at the bottom of Edit swimmer details.", alt: "Edit swimmer details dialog with the Active status selector and Save details button." }],
  "enrol-swimmer": [{ image: "enrol", step: "Select a class and check its details", caption: "Filter the class list, then check the selected destination at the bottom.", alt: "Enrolment class picker with site, level, day and time filters, available places and a selected-class summary." }],
  "move-swimmer": [{ image: "move", step: "Check the selected-class summary", caption: "The current class and selected destination make a change of site clear.", alt: "Move to another class dialog with the source class, destination choices, selected site and Review move button." }],
  "waitlist": [{ image: "waitlist", step: "Activate the place when space is available", caption: "An active place and a waitlist place appear separately. Use Enrol from waitlist when there is room.", alt: "Manage enrolment showing an Active place and a Waitlisted place with Enrol from waitlist and Unenrol actions." }],
  "end-enrolment": [{ image: "end-enrolment", step: "Choose when it ends", caption: "Check When before confirming the end of a place.", alt: "End this enrolment dialog showing timing, the finished-class checkbox, note and Confirm change button." }],
  "sibling-times": [{ image: "together", step: "Compare the options", caption: "Together lists a class option for each swimmer in the group.", alt: "Together results for two example swimmers at different levels, showing matching class times and available places." }],
  "find-class": [
    { image: "classes", step: "Search Classes", caption: "Use Site, Level and Day to narrow the weekly class list.", alt: "Classes directory with search, site, level and day filters and rows showing time, pool, teacher and places." },
    { image: "class-detail", step: "Inspect the roster and waitlist", caption: "Open a class to inspect its timetable and enrolled swimmers.", alt: "Class detail page with weekly schedule, site, capacity and four example swimmers in the roster." },
  ],
  "daily-schedule": [{ image: "schedule", step: "Read the booking sheet", caption: "Levels run down the left; start times run across the top.", alt: "Daily Schedule booking sheet with the week navigator and classes arranged by level and time." }],
  "manage-class": [{ image: "add-class", step: "Add the weekly class", caption: "Check the site, level, weekly time and capacity before saving.", alt: "Add class dialog with level, day, start time, duration, capacity, instructor and pool-area fields." }],
  "start-class": [{ image: "start-class", step: "Choose Start class", caption: "Confirm that you are teaching this dated class.", alt: "Start Turtles confirmation with the class time, a reminder that only the claiming instructor can open it, and Confirm and start." }],
  "take-attendance": [{ image: "attendance", step: "Check each swimmer’s attendance", caption: "Choose each swimmer’s attendance status and review the roster before saving.", alt: "Attendance form showing example swimmers with Present, Absent and Late choices, Class note and Save and continue." }],
  "record-competencies": [{ image: "competencies", step: "Mark what was demonstrated", caption: "Work through one competency at a time and mark the swimmers who were in today.", alt: "Class competency checklist with a competency selector, achieved controls, a group marking action and Not in today section." }],
  "complete-class-level": [{ image: "complete-class", step: "Confirm completion", caption: "Level completion has its own confirmation and optional note.", alt: "Complete Turtles dialog stating the example swimmer achieved every competency, with Note and Confirm completion." }],
  "profile-competencies": [{ image: "profile-competencies", step: "Inspect the current evidence", caption: "Expand a level to read its marks, assessor and dates.", alt: "Profile competencies for Turtles with achieved counts, individual marks, assessor details and History controls." }],
  "complete-level": [{ image: "complete-level", step: "Confirm an eligible completion", caption: "Review the achieved competencies and add a completion note if needed.", alt: "Profile level-completion dialog showing three of three competencies achieved, Completion note and Confirm completion." }],
  "assessment-sessions": [{ image: "assessment-session", step: "Complete the practical details", caption: "An assessment is a dated session with its own assessor and capacity.", alt: "Add assessment session form with programme, kind, date, time, duration, places, pool and assessor." }],
  "book-assessment": [{ image: "assessment-booking", step: "Choose Book a swimmer", caption: "Check the session in the heading, then search for the swimmer.", alt: "Book onto assessment dialog showing the session date, programme, places taken and swimmer search field." }],
  "assessment-outcome": [{ image: "assessment-outcome", step: "Place a swimmer who was assessed", caption: "Choose the outcome level and record what you observed.", alt: "Assessment placement dialog for an example swimmer, with level selection, Note and Place button." }],
  "cancel-class-session": [{ image: "cancel-session", step: "Record the reason", caption: "This confirmation cancels one session and records why it cannot run.", alt: "Cancel this session dialog with class date and time, a demonstration cancellation reason and Confirm cancellation." }],
  "billing-follow-up": [{ image: "billing", step: "Record the handoff", caption: "After contacting billing, save a handoff note against the affected swimmers.", alt: "Cancellation review with example swimmers, the reason for cancellation, Billing handoff note and Mark billing notified." }],
  "analytics": [{ image: "analytics", step: "Compare swimmers and places", caption: "Swimmer totals and enrolled places answer different questions.", alt: "Analytics dashboard with synthetic totals, enrolment activity, level capacity and cancellation figures." }],
  "manage-curriculum": [
    { image: "programme", step: "Open or add a programme", caption: "A programme contains the ordered levels used at both sites.", alt: "Add programme form with a demonstration name, description and optional image." },
    { image: "curriculum", step: "Describe the competencies", caption: "State the skill clearly and add instructor guidance when needed.", alt: "Add competency form with What the swimmer has to do and Notes for the instructor." },
  ],
  "manage-staff": [{ image: "staff", step: "Add the person", caption: "Create an individual account and choose its role.", alt: "Add a person dialog with a synthetic name and email, role selector and temporary password field." }],
  "manage-roles": [{ image: "roles", step: "Choose screens", caption: "Choose the pages available to this role, then review its action permissions.", alt: "Teaching-team role editor with name, description and screen access choices." }],
  "manage-clubs": [{ image: "clubs", step: "Add or rename a site", caption: "A new site starts with an empty timetable and uses the shared records.", alt: "Add a club dialog explaining shared swimmers and programmes, with a demonstration site name." }],
  "activity-log": [{ image: "activity", step: "Read the entry", caption: "Each entry identifies the change, the person and the time.", alt: "Activity table with synthetic enrolment and contact-update entries, actor, action and time columns." }],
};

export const HELP_IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = dimensions;
export function screenshotHref(id: string) { return `/help/images/${encodeURIComponent(id)}`; }
export function screenshotsForStep(slug: string, step: string, scope: HelpScope): HelpScreenshot[] {
  return (GUIDE_SCREENSHOTS[slug] ?? []).filter(item => item.step === step && (!item.scope || item.scope === scope)).map(item => ({
    id: item.image, ...HELP_IMAGE_DIMENSIONS[item.image], caption: item.caption, alt: item.alt,
  }));
}
