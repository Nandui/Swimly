import type { JSONContent } from '@tiptap/react';
import { expandPermissions } from '@/lib/staff/permissions';
import { visibleScreens } from '@/lib/staff/screens';
export const documentTypes = ['SOP', 'NOP', 'EAP', 'Risk assessment', 'Policy', 'Custom'] as const;
export type DocumentType = (typeof documentTypes)[number];
export type Role = string;
export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  screens: string[];
  active: boolean;
  facilityIds: string[];
  teamIds: string[];
};
export type Group = { id: string; name: string };
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
export type Workspace = {
  now: string;
  member: Member;
  members: Member[];
  facilities: Group[];
  teams: Group[];
  templates: Template[];
  matrix: RiskMatrix;
  documents: LibraryDocument[];
  requirements: Requirement[];
  localMode: boolean;
};
export const canRead = (m: Member) => m.active && visibleScreens(m.screens, expandPermissions(m.permissions)).has('docs');
export const canWrite = (m: Member) => canRead(m) && expandPermissions(m.permissions).has('docs.write');
export const canApprove = (m: Member) => canRead(m) && expandPermissions(m.permissions).has('docs.approve');
export const canManage = (m: Member) => canRead(m) && expandPermissions(m.permissions).has('docs.manage');
export const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value))
    : 'Not set';
export const overdue = (value?: string | null) =>
  !!value && value.slice(0, 10) < new Date().toISOString().slice(0, 10);
