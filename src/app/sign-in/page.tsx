import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { getDevAdmin } from "@/lib/dev-sign-in";
import { currentSharedDevice } from "@/lib/devices/shared-device";

export const metadata: Metadata = { title: "Sign in" };

/** The gate is asked here, on the server, and only a name crosses to the
 *  client. On production `getDevAdmin` returns null, the button is never
 *  rendered, and the provider behind it was never registered either. */
export default async function SignInPage() {
  const [devAdmin, device] = await Promise.all([getDevAdmin(), currentSharedDevice()]);

  return <SignInForm devAdminName={devAdmin?.name ?? null} sharedDeviceName={device?.name ?? null} />;
}
