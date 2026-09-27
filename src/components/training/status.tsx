import { Ban, Check, CircleDot, Hourglass, TriangleAlert, type LucideIcon } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { TRAINING_STATUS_META, type TrainingState } from "@/lib/training/constants";
import { QUALIFICATION_STATE_META } from "@/lib/people/constants";
import type { QualificationState } from "@/lib/people/data";

/** Each state has its own icon shape, so colour is never the only signal. */
const TRAINING_ICONS: Record<TrainingState, LucideIcon> = {
  assigned: CircleDot,
  overdue: TriangleAlert,
  submitted: Hourglass,
  completed: Check,
  cancelled: Ban,
};

export function TrainingStatusTag({ state }: { state: TrainingState }) {
  const meta = TRAINING_STATUS_META[state], Icon = TRAINING_ICONS[state];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}

const QUALIFICATION_ICONS: Record<QualificationState, LucideIcon> = {
  valid: Check,
  expiring: Hourglass,
  expired: TriangleAlert,
  revoked: Ban,
};

export function QualificationStateTag({ state }: { state: QualificationState }) {
  const meta = QUALIFICATION_STATE_META[state], Icon = QUALIFICATION_ICONS[state];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}
