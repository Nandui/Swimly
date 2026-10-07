import { redirect } from "next/navigation";

/** Departments and qualifications have their own Admin pages now (owner decision, 7 October 2026). */
export default function OrganisationMoved() {
  redirect("/departments");
}
