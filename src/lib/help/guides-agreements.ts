import type { HelpArticle } from "./types";

export const AGREEMENT_GUIDES: HelpArticle[] = [{
  slug: "legend-agreements", title: "Check outstanding Legend agreements", category: "enrolment", scopes: ["desk"],
  summary: "Check each class place’s billing agreement in Legend and record completion in Swimly.",
  keywords: ["Legend", "agreement", "billing", "enrolment", "outstanding", "needs checking", "confirm"],
  before: ["You need the Legend agreements screen. Confirming requires permission to enrol and move swimmers. Update the agreement in Legend itself; Swimly does not do this for you."],
  steps: [
    { title: "Open Legend agreements", text: "Choose the working site, then Legend agreements in the sidebar. Outstanding shows active places at that site. Search by name or member number." },
    { title: "Check the swimmer and class", text: "Needs checking means no confirmation has been recorded, including existing enrolments. Still to do means staff recorded the agreement as outstanding. A swimmer with two class places has two separate checks." },
    { title: "Update Legend and confirm", text: "Check or update the billing agreement in Legend. Return to the matching class place, choose Confirm updated and confirm the swimmer and class in the dialog." },
    { title: "Review confirmed agreements", text: "The place leaves Outstanding and appears in Confirmed with the staff name and time. Moves carry this status to the new class, including at another site. Waitlists and ended places are not shown." },
  ],
  result: "Staff can see which active places still need a Legend check and who confirmed the completed ones.",
  troubleshooting: [
    { question: "Can I enrol before finishing the agreement?", answer: "Yes. Choose Still to do during enrolment. Finish it in Legend, then confirm it here." },
    { question: "Why is a swimmer missing?", answer: "Check the working site and search, and look in Confirmed. Only active enrolments appear. A move sends the task to the destination site; waitlist places are checked when enrolled." },
  ],
  related: ["enrol-swimmer", "waitlist", "move-swimmer"], action: "legend-agreements",
}];
