import { CircleCheck, CircleDashed, CircleEllipsis, CopyX, FileQuestion, Flower2, House, SlidersHorizontal, Thermometer, TriangleAlert, UserX, type LucideIcon } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { ABSENCE_REASON_META, RETURN_FIT_META, ROTA_WARNING_META, type AbsenceReason, type ReturnFit, type RotaWarning } from "@/lib/rota/constants";

/** Each warning has its own icon, so colour is never the only signal. */
const ICONS: Record<RotaWarning, LucideIcon> = { absent: UserX, expired: TriangleAlert, missing: FileQuestion, overlap: CopyX, open: CircleDashed };

export function RotaWarningTag({ warning }: { warning: RotaWarning }) {
  const meta = ROTA_WARNING_META[warning], Icon = ICONS[warning];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}

const REASON_ICONS: Record<AbsenceReason, LucideIcon> = { sickness: Thermometer, family: House, bereavement: Flower2, other: CircleEllipsis };

/** Why someone is off, for rota managers only. */
export function AbsenceReasonTag({ reason }: { reason: AbsenceReason }) {
  const meta = ABSENCE_REASON_META[reason], Icon = REASON_ICONS[reason];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}

const FIT_ICONS: Record<ReturnFit, LucideIcon> = { fit: CircleCheck, adjusted: SlidersHorizontal };

/** The return-to-work answer: fit to work, or back with changes. */
export function ReturnFitTag({ fit }: { fit: ReturnFit }) {
  const meta = RETURN_FIT_META[fit], Icon = FIT_ICONS[fit];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}
