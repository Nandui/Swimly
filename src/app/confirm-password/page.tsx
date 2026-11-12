import type { Metadata } from "next";
import { ConfirmPassword, ConfirmWithGoogle } from "@/components/devices/session-forms";
import { googleSignInAvailable } from "@/lib/google-sign-in";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Confirm it’s you" };

/** Step-up for restricted records. `next` must be a path on this site. With
 *  Google set up it is a fresh Google sign-in, except for a password session
 *  (the developer login), which confirms with its password. */
export default async function ConfirmPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await pageSession();
  const { next } = await searchParams;
  const safe = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (googleSignInAvailable() && session.user.authMethod !== "password") return <ConfirmWithGoogle name={session.user.name ?? "You"} next={safe} />;
  return <ConfirmPassword email={session.user.email ?? ""} name={session.user.name ?? "You"} next={safe} />;
}
