import type { HelpArticle } from "./types";

export const PARENT_GUIDES: HelpArticle[] = [
  {
    slug: "parent-link-requests", title: "Review a parent’s request to link their child", category: "swimmers", scopes: ["desk"],
    summary: "Approve or decline requests sent from LeisureWorld Aquatics, without asking families to email.",
    keywords: ["parent", "request", "link child", "approval", "guardian", "pending", "decline"],
    before: ["You need the Swimmers screen and Manage parent access permission.", "A request is not proof of guardianship. Verify the parent against the existing swimmer record before approving."],
    steps: [
      { title: "Open the requests queue", text: "Choose Parent accounts from Swimmers. Parent access requests shows families from both sites, starting with Waiting for review. Refresh requests checks for new submissions." },
      { title: "Check the parent and match their child", text: "Read the parent’s verified sign-in email, name, phone and submitted child details. Choose Review and approve. Search for the existing swimmer, then open their profile in a new tab to check identity and guardianship. Never create another swimmer to resolve a link request." },
      { title: "Confirm the decision and reply", text: "To approve, check the selected swimmer and enter a reply to the parent plus your internal audit reason. Choose Approve and link swimmer. To decline, choose Decline request and explain what the parent should check or do next. Replies are visible in the parent app; the audit reason stays in Swimly." },
      { title: "Check the result", text: "Approved and Declined filters show completed requests and the reviewer. The parent sees the decision under Your requests. Approved children appear under My children. No customer email is needed, and signing in still uses an email verification code." },
    ],
    result: "Approval links the selected existing swimmer across both sites. The decision and any access change are recorded together in Activity.",
    troubleshooting: [
      { question: "The account is suspended.", answer: "Approval is disabled. Check the account using the email search below the queue and resolve the suspension before granting access." },
      { question: "The request was already reviewed or the save could not be confirmed.", answer: "Refresh the queue and check Approved or Declined before trying again. Another staff member may have completed it." },
      { question: "The parent cannot see the approved child.", answer: "Check the address used to sign in and the swimmer’s Parent access tab. A later revocation or suspension still blocks access, even when an earlier request was approved." },
    ], related: ["parent-access", "parent-accounts", "find-swimmer"], action: "students",
  },
  {
    slug: "parent-access", title: "Approve or revoke a parent’s access to a swimmer", category: "swimmers", scopes: ["desk"],
    summary: "Choose exactly which guardian emails can see a swimmer in LeisureWorld Aquatics, across both sites.",
    keywords: ["parent", "guardian", "LeisureWorld Aquatics", "approve", "revoke", "restore", "email", "child access"],
    before: ["You need the Swimmers screen and Manage parent access permission.", "Check the swimmer’s identity and confirm the guardian’s email. Contact details alone do not approve access."],
    steps: [
      { title: "Open the swimmer’s Parent access tab", text: "Find the swimmer, check the member number and contacts, then choose Parent access. Existing approvals and revoked addresses are listed here." },
      { title: "Approve the guardian’s email", text: "Choose Approve parent email. Check the swimmer named in the dialog, enter the guardian’s exact sign-in address and record your reason. Confirm the approval and wait for Approved to appear." },
      { title: "Tell the guardian how to sign in", text: "Approval does not send an email. The guardian opens LeisureWorld Aquatics and signs in with the approved address. They can see released progress and bookings, but no medical or internal notes. Competency changes appear the next day at midnight in Ireland." },
      { title: "Revoke or restore access when needed", text: "Use Revoke access beside the email to remove access to this swimmer only. Give a reason and confirm. Restore access approves the same address again. Other swimmers linked to that guardian are unaffected." },
    ],
    result: "The guardian’s approval is shared across sites. Every change records the staff member and reason in Activity.",
    troubleshooting: [
      { question: "The parent cannot see their child.", answer: "Check the exact address used to sign in against the approved address. If it matches, use Parent accounts to check whether the account is suspended. Do not create another swimmer record." },
      { question: "I entered the wrong email.", answer: "Revoke the incorrect address immediately, then approve the correct one after checking it with the guardian." },
    ], related: ["parent-link-requests", "parent-accounts", "find-swimmer", "swimmer-history"], action: "students",
  },
  {
    slug: "parent-accounts", title: "Find, suspend or reactivate a parent account", category: "swimmers", scopes: ["desk"],
    summary: "Look up a LeisureWorld Aquatics account by its full email address and manage its sign-in access.",
    keywords: ["parent account", "LeisureWorld Aquatics", "suspend", "reactivate", "blocked", "login", "sign in"],
    before: ["You need the Swimmers screen and Manage parent access permission.", "Suspension affects every linked swimmer at both sites. To remove access to one swimmer, use their Parent access tab instead."],
    steps: [
      { title: "Open Parent accounts from Swimmers", text: "Choose Parent accounts beside Add swimmer. Enter the full address used in LeisureWorld Aquatics, then choose Find account. Searches match that exact address." },
      { title: "Check the account", text: "Compare the email, name and phone when provided. The status shows whether the account is active or suspended. No account found means that address has not created a parent account by verifying a sign-in code, or the address was entered incorrectly." },
      { title: "Confirm the account change", text: "Choose Suspend account or Reactivate account. Check the email in the dialog, enter the reason and confirm. Wait for the account status to update." },
    ],
    result: "Suspension blocks sign-in and ends all current sessions. Reactivation allows a fresh sign-in; it does not restore revoked swimmer access.",
    troubleshooting: [{ question: "There is no account yet. Can I approve access?", answer: "Yes. Approve the guardian’s email on the swimmer’s profile. The parent account is created when they verify their first sign-in code." }],
    related: ["parent-access", "missing-access"], action: "students",
  },
  {
    slug: "publish-parent-assessment", title: "Publish an assessment for parents to book", category: "assessments", scopes: ["desk"],
    summary: "Make a session available in LeisureWorld Aquatics and choose when parent booking closes.",
    keywords: ["parent", "LeisureWorld Aquatics", "publish", "unpublish", "assessment", "booking deadline", "online booking"],
    before: ["You need the Assessments screen and Edit the timetable permission.", "Select the session’s site as your working area. The session must be in the future, not cancelled, and use an active site, programme and assessment type."],
    steps: [
      { title: "Open the assessment session", text: "In Assessments, choose Assessment setup, then Set up beside the session. Check its site, date, time and places. Booking in LeisureWorld Aquatics shows its parent publication status." },
      { title: "Choose Publish to LeisureWorld Aquatics", text: "Check the session named in the dialog. Set an optional future booking deadline in Ireland time, no later than the session starts. Leave it blank to close booking at the start. Add your reason and choose Publish session." },
      { title: "Check the published status", text: "Published means the session is visible to parents. A full session stays visible but cannot accept another booking. Use Edit booking deadline to change the cutoff and Refresh status to check the latest availability." },
      { title: "Unpublish when required", text: "Choose Unpublish, enter a reason and confirm. This hides the session from parent booking without cancelling it or removing existing bookings. Staff can still manage those bookings." },
    ],
    result: "Parents can find published sessions and book available places until the deadline. Their confirmations appear in My bookings; a separate booking confirmation email is not sent.",
    troubleshooting: [
      { question: "Why does it say Booking closed?", answer: "The booking deadline or session start may have passed, the session may be cancelled, or its site or curriculum may be archived. Check those details. If only the deadline has passed and the session is still eligible, edit the deadline to reopen booking." },
      { question: "Can I publish a session at the other site?", answer: "Switch the working area to that site first, then open the session. Publishing follows the selected site." },
    ], related: ["assessment-sessions", "book-assessment", "parent-access"], action: "assessments",
  },
];
