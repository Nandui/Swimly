import { Tag } from "@/components/ui-kit/tag";
import { BATCH_STATE_META, VOUCHER_STATE_META, type BatchState, type VoucherState } from "@/modules/vouchers/shared/rules";

/** A voucher's or a batch's state: the meta gives its words, tone and icon. */
export function VoucherStateTag({ state }: { state: VoucherState }) {
  return <Tag meta={VOUCHER_STATE_META[state]} />;
}
export function BatchStateTag({ state }: { state: BatchState }) {
  return <Tag meta={BATCH_STATE_META[state]} />;
}
