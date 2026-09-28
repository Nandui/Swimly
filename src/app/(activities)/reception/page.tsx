import { redirect } from "next/navigation";

/** The retired Reception view. Old links open the home page. */
export default function ReceptionPage() {
  redirect("/");
}
