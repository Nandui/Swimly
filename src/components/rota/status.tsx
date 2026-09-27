import { CircleDashed, CopyX, FileQuestion, TriangleAlert, type LucideIcon } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { ROTA_WARNING_META, type RotaWarning } from "@/lib/rota/constants";

/** Each warning has its own icon, so colour is never the only signal. */
const ICONS: Record<RotaWarning, LucideIcon> = { expired: TriangleAlert, missing: FileQuestion, overlap: CopyX, open: CircleDashed };

export function RotaWarningTag({ warning }: { warning: RotaWarning }) {
  const meta = ROTA_WARNING_META[warning], Icon = ICONS[warning];
  return <Tag color={meta.color}><Icon aria-hidden="true" />{meta.label}</Tag>;
}
