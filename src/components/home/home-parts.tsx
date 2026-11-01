import { CalendarPlus, ClipboardCheck, FilePlus, ReceiptText, UserPlus, UserX, type LucideIcon } from "lucide-react";
import type { HomeIcon } from "@/modules/contributions";

/** Quick action icons, by the name an app gives (apps import no UI), for Home's New menu and every
 *  app's starter page. */
export const ACTION_ICONS: Record<HomeIcon, LucideIcon> = {
  userPlus: UserPlus, calendarPlus: CalendarPlus, receipt: ReceiptText, userX: UserX, filePlus: FilePlus, clipboardCheck: ClipboardCheck,
};
