import "server-only";
import { formatDate } from "@/lib/format";
import { TRAINING_STATUS_META } from "@/lib/training/constants";
import { myTraining } from "@/lib/training/mine";
import type { MyItem, MyProvider } from "@/modules/my/types";

/** Training's My surface: the person's own open training, soonest due first.
 *  Everyone has it; completing your own training needs no capability. Finished
 *  courses stay on /me/training, not in the hub. */
export const trainingMine: MyProvider = {
  id: "training.mine",
  moduleId: "training",
  title: "My training",
  empty: "No training to do right now.",
  more: { href: "/me/training", label: "All my training" },
  async load({ userId }) {
    const rows = await myTraining(userId);
    return rows
      .filter((row) => row.state !== "completed")
      .map((row): MyItem => ({
        id: row.id,
        title: row.course.title,
        detail: row.state === "submitted"
          ? "Done. A trainer will sign it off with you."
          : row.dueOn ? `Due ${formatDate(row.dueOn)}` : "No deadline",
        status: TRAINING_STATUS_META[row.state],
        href: `/me/training/${row.id}`,
        needsAction: row.state === "assigned" || row.state === "overdue",
      }));
  },
};
