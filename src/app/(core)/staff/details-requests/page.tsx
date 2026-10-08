import { redirect } from "next/navigation";

/** Staff details are HR's now (owner decision, 8 October 2026). */
export default function DetailsRequestsMoved() {
  redirect("/hr/details-requests");
}
