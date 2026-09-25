import { Ban, Check, CircleHelp, Clock3, FilePenLine, Inbox, ScanSearch, X, type LucideIcon } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { refundStatuses, type RefundStatus } from "@/lib/refunds/types";

/** Each status has its own icon shape, so colour is never the only signal. */
const statusIcons: Record<RefundStatus, LucideIcon> = {
  DRAFT: FilePenLine,
  SUBMITTED: Inbox,
  IN_REVIEW: ScanSearch,
  NEEDS_INFORMATION: CircleHelp,
  APPROVED: Clock3,
  REFUNDED: Check,
  DECLINED: X,
  WITHDRAWN: Ban,
};

export function RefundStatusTag({ status }: { status: RefundStatus }) {
  const meta = refundStatuses[status], Icon = statusIcons[status];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}
