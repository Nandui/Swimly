import { redirect } from "next/navigation";

/** Old "Open Swimly" links. The home page now shows each role its modules. */
export default function StartPage() {
  redirect("/");
}
