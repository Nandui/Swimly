import { Check, EyeOff, FilePenLine, FolderLock, Hourglass, Share2, type LucideIcon } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { NOTE_VISIBILITY_META, REVIEW_STATUS_META, type NoteVisibility, type ReviewStatus } from "@/lib/hr/constants";

/** Each state has its own icon, so colour is never the only signal. */
const VISIBILITY_ICONS: Record<NoteVisibility, LucideIcon> = { private: EyeOff, record: FolderLock, subject: Share2 };
const REVIEW_ICONS: Record<ReviewStatus, LucideIcon> = { draft: FilePenLine, shared: Hourglass, acknowledged: Check };

export function NoteVisibilityTag({ visibility }: { visibility: NoteVisibility }) {
  const meta = NOTE_VISIBILITY_META[visibility], Icon = VISIBILITY_ICONS[visibility];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}

export function ReviewStatusTag({ status }: { status: ReviewStatus }) {
  const meta = REVIEW_STATUS_META[status], Icon = REVIEW_ICONS[status];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}
