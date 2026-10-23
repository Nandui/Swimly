import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { getDevAdmin } from "@/lib/dev-sign-in";
import { currentSharedDevice } from "@/lib/devices/shared-device";
import { googleRefusalText, googleSignInAvailable } from "@/lib/google-sign-in";
import { IDLE_SIGNED_OUT_REASON, IDLE_SIGNED_OUT_TEXT } from "@/lib/idle";

export const metadata: Metadata = { title: "Sign in" };

/** The gate is asked here, on the server, and only a name crosses to the
 *  client. On production `getDevAdmin` returns null, the button is never
 *  rendered, and the provider behind it was never registered either. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; reason?: string }> }) {
  const [devAdmin, device, { error, reason }] = await Promise.all([getDevAdmin(), currentSharedDevice(), searchParams]);
  // A Google sign-in that was refused comes back here with its reason; any
  // other Auth.js error (cancelled at Google, a stale link) gets one sentence.
  const googleError = googleRefusalText(error) ?? (error ? "Could not sign you in with Google. Try again." : null);

  return (
    <SignInForm
      devAdminName={devAdmin?.name ?? null}
      sharedDeviceName={device?.name ?? null}
      google={googleSignInAvailable()}
      initialError={googleError}
      notice={reason === IDLE_SIGNED_OUT_REASON ? IDLE_SIGNED_OUT_TEXT : null}
    />
  );
}
