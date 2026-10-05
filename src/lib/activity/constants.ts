import {
  Archive, ArchiveRestore, ArrowRightLeft, ArrowUpDown, ArrowUpRight, Asterisk, Award, BadgeCheck, Ban, Banknote,
  CalendarClock, CalendarPlus, CalendarX, CheckCheck, Circle, CircleArrowRight, CircleCheck, CircleHelp, CirclePause,
  ClipboardCheck, ClipboardList, ClipboardPen, Eye, EyeOff, FilePenLine, FileUp, FileX, FileX2, Flag, GraduationCap, Hand,
  Hash, Inbox, KeyRound, Layers, ListPlus, LogIn, Mail, MailCheck, MailX, Megaphone, MessageSquarePlus, MonitorCheck,
  MonitorX, Paperclip, Pencil, PhoneCall, Play, Plus, RotateCcw, Send, ShieldAlert, ShieldCheck, ShieldOff, ShieldX,
  Trash2, TrendingDown, Undo2, Unlink, UserCheck, UserMinus, UserPlus, UserRoundCheck, UserRoundX, UserX, Users, XCircle,
  Clock3,
} from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Audit actions are an open set, unlike a Prisma enum: every domain verb a
 *  future action invents arrives here as a string, so this map cannot be
 *  exhaustive the way an enum can, and the compiler cannot catch a missing
 *  entry. What it can do is cover every verb the app actually writes today and
 *  let anything else read as a gray fallback until it has earned a meta of its
 *  own. Within one tone, no two verbs share an icon.
 *
 *  Keep this in step with the `action:` values passed to `logAudit` across
 *  `src/lib` and `src/modules`. */
export const ACTIONS: Record<string, StatusMeta> = {
  // Shared across every model
  create: { label: "Created", color: "green", icon: Plus },
  update: { label: "Updated", color: "blue", icon: Pencil },
  delete: { label: "Deleted", color: "red", icon: Trash2 },
  archive: { label: "Archived", color: "gray", icon: Archive },
  restore: { label: "Restored", color: "green", icon: ArchiveRestore },
  reorder: { label: "Reordered", color: "gray", icon: ArrowUpDown },
  view: { label: "Viewed", color: "gray", icon: Eye },
  cancel: { label: "Cancelled", color: "gray", icon: XCircle },
  submit: { label: "Submitted", color: "blue", icon: Inbox },
  approve: { label: "Approved", color: "green", icon: CircleCheck },
  decline: { label: "Declined", color: "red", icon: FileX2 },

  // Enrolment
  enrol: { label: "Enrolled", color: "green", icon: UserPlus },
  waitlist: { label: "Waitlisted", color: "orange", icon: Clock3 },
  withdraw: { label: "Withdrew", color: "gray", icon: UserMinus },
  complete: { label: "Finished", color: "blue", icon: Flag },
  transfer: { label: "Moved", color: "purple", icon: ArrowRightLeft },
  "transfer-out": { label: "Moved out", color: "purple", icon: ArrowUpRight },
  "legend-agreement": { label: "Legend agreement confirmed", color: "green", icon: BadgeCheck },
  "ready-to-move": { label: "Ready to move", color: "blue", icon: CircleArrowRight },
  "cancel-move-readiness": { label: "Move readiness removed", color: "gray", icon: Undo2 },
  "enrolment-follow-up": { label: "Follow-up recorded", color: "blue", icon: PhoneCall },
  "schedule-withdrawal": { label: "Withdrawal scheduled", color: "orange", icon: CalendarClock },
  "cancel-withdrawal": { label: "Withdrawal cancelled", color: "gray", icon: RotateCcw },

  // The pool deck
  attendance: { label: "Attendance", color: "blue", icon: ClipboardList },
  "attendance-corrected": { label: "Attendance corrected", color: "orange", icon: ClipboardPen },
  "start-class": { label: "Started class", color: "green", icon: Play },
  "cancel-session": { label: "Session cancelled", color: "red", icon: CalendarX },
  "billing-notified": { label: "Billing notified", color: "green", icon: Send },
  cover: { label: "Took over", color: "purple", icon: Users },
  assess: { label: "Assessed", color: "orange", icon: ClipboardCheck },
  "complete-level": { label: "Level passed", color: "green", icon: Award },
  "revoke-level": { label: "Level revoked", color: "orange", icon: TrendingDown },
  "convert-to-levels": { label: "Converted to levels", color: "blue", icon: Layers },

  // Assessment sessions and parents
  book: { label: "Booked", color: "green", icon: CalendarPlus },
  "cancel-booking": { label: "Booking cancelled", color: "gray", icon: CalendarX },
  "no-show": { label: "Did not come", color: "orange", icon: UserX },
  placed: { label: "Placed", color: "purple", icon: GraduationCap },
  publish: { label: "Shared with parents", color: "green", icon: Megaphone },
  unpublish: { label: "Hidden from parents", color: "gray", icon: EyeOff },
  "request-code": { label: "Sign-in code requested", color: "gray", icon: Hash },
  "verify-code": { label: "Signed in", color: "green", icon: LogIn },
  "invalid-code": { label: "Wrong sign-in code", color: "red", icon: ShieldAlert },
  "delivery-failed": { label: "Email not delivered", color: "red", icon: MailX },
  grant: { label: "Access given", color: "green", icon: KeyRound },
  revoke: { label: "Access removed", color: "red", icon: Unlink },
  activate: { label: "Reactivated", color: "green", icon: UserCheck },
  suspend: { label: "Suspended", color: "gray", icon: CirclePause },
  "apply-parent-change": { label: "Parent change applied", color: "green", icon: CheckCheck },
  "decline-parent-change": { label: "Parent change declined", color: "red", icon: FileX },

  // People, roles and devices
  deactivate: { label: "Deactivated", color: "gray", icon: UserRoundX },
  "set-pin": { label: "PIN set", color: "blue", icon: Asterisk },
  "remove-pin": { label: "PIN removed", color: "gray", icon: Asterisk },
  "register-device": { label: "Device registered", color: "green", icon: MonitorCheck },
  "revoke-device": { label: "Device revoked", color: "red", icon: MonitorX },
  "grant-superadmin": { label: "Made superadmin", color: "purple", icon: ShieldCheck },
  "revoke-superadmin": { label: "Superadmin removed", color: "red", icon: ShieldOff },
  "request-details-change": { label: "Details change requested", color: "blue", icon: MessageSquarePlus },
  "apply-details-change": { label: "Details change applied", color: "green", icon: UserRoundCheck },
  "decline-details-change": { label: "Details change declined", color: "red", icon: UserRoundX },

  // Training and qualifications
  assign: { label: "Assigned", color: "blue", icon: ListPlus },
  "sign-off": { label: "Signed off", color: "green", icon: ShieldCheck },
  return: { label: "Sent back", color: "orange", icon: Undo2 },
  "upload-certificate": { label: "Certificate added", color: "blue", icon: FileUp },
  "decline-certificate": { label: "Certificate declined", color: "red", icon: ShieldX },
  "record-qualification": { label: "Qualification recorded", color: "green", icon: GraduationCap },
  "revoke-qualification": { label: "Qualification withdrawn", color: "red", icon: Ban },

  // Refunds
  save: { label: "Draft saved", color: "gray", icon: FilePenLine },
  claim: { label: "Handler changed", color: "blue", icon: Hand },
  information: { label: "Information requested", color: "orange", icon: CircleHelp },
  pay: { label: "Payment recorded", color: "green", icon: Banknote },
  upload: { label: "Receipt added", color: "blue", icon: Paperclip },
  remove: { label: "Receipt removed", color: "gray", icon: Paperclip },
  email_attempt: { label: "Email attempted", color: "gray", icon: Mail },
  email_recipients: { label: "Email recipients found", color: "gray", icon: Users },
  email_result: { label: "Email result", color: "blue", icon: MailCheck },
};

/** The meta for an audit verb; unknown verbs read as a sentence-cased gray fallback. */
export function actionMeta(action: string): StatusMeta {
  const known = ACTIONS[action];
  if (known) return known;
  // Last resort, and it should look like one: sentence-case the raw verb.
  const words = action.replace(/[-_]+/g, " ").trim();
  return {
    label: words.charAt(0).toUpperCase() + words.slice(1),
    color: "gray",
    icon: Circle,
  };
}
