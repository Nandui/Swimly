import { Tag } from "@/components/ui-kit/tag";
import { PO_STATUS_META, type PoStatus } from "@/modules/purchasing/shared/rules";

/** An order's status: the meta gives its words, tone and icon. */
export function PoStatusTag({ status }: { status: PoStatus }) {
  return <Tag meta={PO_STATUS_META[status]} />;
}
