import "server-only";
import { formatDate } from "@/lib/format";
import { clock, ROTA_WARNING_META } from "@/lib/rota/constants";
import { myShifts } from "@/lib/rota/mine";
import type { MyProvider } from "@/modules/my/types";

/** Rota's My surface: the person's shifts for the next week. A shift that
 *  needs a qualification they no longer hold is flagged, so they can sort it
 *  out before they arrive. */
export const rotaMine: MyProvider = {
  id: "rota.mine",
  moduleId: "rota",
  title: "My shifts",
  empty: "No shifts in the next week.",
  more: { href: "/me/shifts", label: "All my shifts" },
  async load({ userId }) {
    return (await myShifts(userId, 7)).map((s) => ({
      id: s.id,
      title: `${formatDate(s.date)} · ${clock(s.startMinutes)}–${clock(s.endMinutes)}`,
      detail: `${s.role} at ${s.site.name}`,
      status: s.warnings[0] ? ROTA_WARNING_META[s.warnings[0]] : undefined,
      href: "/me/shifts",
      needsAction: s.warnings.length > 0,
    }));
  },
};
