import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { googleSignInAvailable } from "@/lib/google-sign-in";
import { IDLE_SIGNED_OUT_REASON, IDLE_SIGNED_OUT_TEXT } from "@/lib/idle";

export const metadata: Metadata = { title: "Developer sign-in" };

/** Email and password for superadmin (developer) accounts, once Google is the way
 *  in (owner decision, 23 October 2026). Nothing links here; the password check
 *  in src/auth.ts refuses every other account, with the same one sentence as a
 *  wrong password. Without Google set up the ordinary sign-in page has the form. */
export default async function DeveloperSignInPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <SignInForm devAdminName={null} google={googleSignInAvailable()} developer notice={reason === IDLE_SIGNED_OUT_REASON ? IDLE_SIGNED_OUT_TEXT : null} />;
}
