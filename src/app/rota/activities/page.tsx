import { redirect } from "next/navigation";

/** The activity list is Admin's now (owner decision, 7 October 2026): every module uses one list. */
export default function ActivityListMoved() {
  redirect("/activity-list");
}
