/** Rota blocks: the list, one block, and their dialogs. */
export { blocksPage, blockPage, type BlockPage } from "@/modules/staffing/features/blocks/server/data";
export { AckButtons, AssignPlace, DeleteBlockDialog, PublishDialog, StartBlockDialog } from "@/modules/staffing/features/blocks/components/block-dialogs";

// What its pages show, from the module's shared rules and screen kit.
export { RoleTag, Warnings } from "@/modules/staffing/shared/components/kit";
export { ACK_STATE_META, BLOCK_STATE_META, HOURS_META, SHIFT_STATUS_META, blockDays, fitWarnings, formatHours } from "@/modules/staffing/shared/rules";
export type { ShiftStatus } from "@/modules/staffing/shared/rules";
