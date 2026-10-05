import type { JSONContent } from '@tiptap/react';
import {
  Archive, BadgeCheck, BookOpen, CalendarClock, CheckCheck, CircleAlert, CircleCheck, CircleHelp, CirclePause,
  ClipboardCheck, Eye, FileCheck2, FilePenLine, History, Inbox, OctagonAlert, Pencil, ScanSearch, SlidersHorizontal,
  TriangleAlert, UserCheck, XCircle,
} from 'lucide-react';
import { expandPermissions } from '@/lib/staff/permissions';
import { formatDate as formatDateOnly } from '@/lib/format';
import type { StatusMeta } from '@/lib/status';
export const documentTypes = ['SOP', 'NOP', 'EAP', 'Risk assessment', 'Policy', 'Custom'] as const;
export type DocumentType = (typeof documentTypes)[number];
export type Role = string;
export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  active: boolean;
  facilityIds: string[];
  teamIds: string[];
};
/** A Docs group. `platform` groups mirror Turnfin sites (facility) and
 *  departments (team) and are managed in Staff; `docs` groups are Docs-only. */
export type Group = { id: string; name: string; source?: 'docs' | 'platform' };
export type RiskMatrix = {
  configured: boolean;
  likelihood: { label: string; description: string }[];
  severity: { label: string; description: string }[];
  bands: { label: string; min: number; max: number; color: string }[];
};
export type RiskRow = {
  id: string;
  hazard: string;
  people: string;
  controls: string;
  initialLikelihood: number;
  initialSeverity: number;
  residualLikelihood: number;
  residualSeverity: number;
  actions: string;
  ownerId: string;
  dueDate: string;
};
export type Attachment = { id: string; name: string; mime: string; size: number };
export type DocumentContent = {
  schemaVersion: 1;
  title: string;
  reference: string;
  type: DocumentType;
  summary: string;
  ownerId: string;
  facilityIds: string[];
  teamIds: string[];
  reviewDate: string;
  body: JSONContent;
  riskRows: RiskRow[];
  riskMatrix: RiskMatrix | null;
  relatedIds: string[];
  attachments: Attachment[];
};
export type Draft = {
  documentId: string;
  revision: number;
  status: 'draft' | 'changes_requested' | 'in_review';
  content: DocumentContent;
  contributors: string[];
  changeSummary: string;
  approverId: string | null;
  submissionId: string | null;
  feedback: string;
  leaseOwner: string | null;
  leaseSession: string | null;
  leaseUntil: string | null;
  updatedAt: string;
};
export type Snapshot = {
  id: string;
  documentId: string;
  version: number | null;
  kind: 'submission' | 'publication';
  content: DocumentContent;
  contributors: string[];
  changeSummary: string;
  authorId: string;
  approverId: string | null;
  submissionId: string | null;
  createdAt: string;
};
export type DocumentRecord = {
  id: string;
  createdAt: string;
  createdBy: string;
  archivedAt: string | null;
  archiveReason: string | null;
  currentVersionId: string | null;
};
export type LibraryDocument = DocumentRecord & {
  content: DocumentContent;
  version: number | null;
  publishedAt: string | null;
  draftStatus?: Draft['status'];
  draftUpdatedAt?: string;
};
export type Requirement = {
  id: string;
  documentId: string;
  versionId: string;
  memberId: string;
  status: 'outstanding' | 'completed' | 'cancelled';
  dueDate: string | null;
  acknowledgedAt: string | null;
  title: string;
  reference: string;
  version: number;
  facilityIds: string[];
  teamIds: string[];
};
export type AssignmentRule = {
  documentId: string;
  memberIds: string[];
  teamIds: string[];
  dueDate: string | null;
};
export type AuditEvent = {
  id: string;
  actorId: string;
  documentId: string | null;
  action: string;
  detail: string;
  createdAt: string;
};
export type Template = { id: string; type: DocumentType; name: string; body: JSONContent };
/**
 * A colleague as the browser sees them. Raw permission and screen lists never leave the
 * server: pickers get resolved access flags instead, and contact details (email, role) are
 * included only for Docs administrators, who manage staff groups.
 */
export type WorkspaceMember = {
  id: string;
  name: string;
  active: boolean;
  facilityIds: string[];
  teamIds: string[];
  access: { read: boolean; write: boolean; approve: boolean };
  email?: string;
  role?: Role;
};
export type Workspace = {
  now: string;
  member: Member;
  members: WorkspaceMember[];
  facilities: Group[];
  teams: Group[];
  templates: Template[];
  matrix: RiskMatrix;
  documents: LibraryDocument[];
  requirements: Requirement[];
  localMode: boolean;
  /** Whether this person may open reading reports (everyone, or a scoped set). */
  canReport?: boolean;
};
export const canRead = (m: Member) => m.active && expandPermissions(m.permissions).has('docs.read');
export const canWrite = (m: Member) => canRead(m) && expandPermissions(m.permissions).has('docs.write');
export const canApprove = (m: Member) => canRead(m) && expandPermissions(m.permissions).has('docs.approve');
export const canManage = (m: Member) => canRead(m) && expandPermissions(m.permissions).has('docs.manage');
/** The only way a colleague reaches the browser. `viewer` decides whether contact details are included. */
export function toWorkspaceMember(m: Member, viewer: Member): WorkspaceMember {
  return {
    id: m.id,
    name: m.name,
    active: m.active,
    facilityIds: m.facilityIds,
    teamIds: m.teamIds,
    access: { read: canRead(m), write: canWrite(m), approve: canApprove(m) },
    ...(canManage(viewer) ? { email: m.email, role: m.role } : {}),
  };
}
export const formatDate = (value?: string | null) =>
  value ? formatDateOnly(new Date(value)) : 'Not set';
export const overdue = (value?: string | null) =>
  !!value && value.slice(0, 10) < new Date().toISOString().slice(0, 10);

/** Every status Docs shows, with its words, tone and icon. Render one with
 *  `<Tag meta={DOC_STATUS_META[key]} />`; pass keys, never metas, across a
 *  server-to-client boundary. Within one tone no two entries share an icon. */
export const DOC_STATUS_META = {
  draft: { label: 'Draft', color: 'gray', icon: Pencil },
  draftPreview: { label: 'Draft preview', color: 'gray', icon: Eye },
  changesRequested: { label: 'Changes requested', color: 'orange', icon: FilePenLine },
  inReview: { label: 'In review', color: 'blue', icon: ScanSearch },
  forYourReview: { label: 'For your review', color: 'blue', icon: ClipboardCheck },
  submitted: { label: 'Submitted', color: 'blue', icon: Inbox },
  approved: { label: 'Approved', color: 'green', icon: CircleCheck },
  published: { label: 'Published', color: 'green', icon: BadgeCheck },
  current: { label: 'Current approved version', color: 'green', icon: FileCheck2 },
  historical: { label: 'Historical version', color: 'gray', icon: History },
  archived: { label: 'Archived', color: 'gray', icon: Archive },
  reviewDue: { label: 'Review due', color: 'orange', icon: CalendarClock },
  overdue: { label: 'Overdue', color: 'red', icon: TriangleAlert },
  toRead: { label: 'To read', color: 'orange', icon: BookOpen },
  acknowledged: { label: 'Acknowledged', color: 'green', icon: CheckCheck },
  cancelled: { label: 'Cancelled', color: 'gray', icon: XCircle },
  configured: { label: 'Configured', color: 'green', icon: SlidersHorizontal },
  setupRequired: { label: 'Setup required', color: 'orange', icon: TriangleAlert },
  active: { label: 'Active', color: 'green', icon: UserCheck },
  inactive: { label: 'Inactive', color: 'gray', icon: CirclePause },
} as const satisfies Record<string, StatusMeta>;
export type DocStatus = keyof typeof DOC_STATUS_META;

/** Risk bands keep their stored colour names ('amber' included, see content.ts);
 *  this maps each to a tone and an icon of its own. */
export const RISK_BAND_TONE_META = {
  green: { label: 'Low', color: 'green', icon: CircleCheck },
  amber: { label: 'Medium', color: 'orange', icon: CircleAlert },
  orange: { label: 'High', color: 'orange', icon: TriangleAlert },
  red: { label: 'Very high', color: 'red', icon: OctagonAlert },
} as const satisfies Record<'green' | 'amber' | 'orange' | 'red', StatusMeta>;
export const UNCLASSIFIED_RISK_META = { label: 'Unclassified', color: 'gray', icon: CircleHelp } as const satisfies StatusMeta;

/** The tag meta for a band (by its stored colour); a missing or unknown band reads as unclassified. */
export function riskBandMeta(band: { color: string } | null | undefined): StatusMeta {
  return (band && (RISK_BAND_TONE_META as Record<string, StatusMeta>)[band.color]) || UNCLASSIFIED_RISK_META;
}
