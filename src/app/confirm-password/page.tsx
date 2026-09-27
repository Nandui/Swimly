import type { Metadata } from "next";
import { ConfirmPassword } from "@/components/devices/session-forms";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Confirm it's you" };

/** Step-up for restricted records. `next` must be a path on this site. */
export default async function ConfirmPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await pageSession();
  const { next } = await searchParams;
  const safe = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <ConfirmPassword email={session.user.email ?? ""} name={session.user.name ?? "You"} next={safe} />;
}
