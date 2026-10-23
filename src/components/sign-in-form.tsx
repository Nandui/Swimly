"use client";
import { Notice } from "@/components/ui-kit/notice";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Separator } from "@/components/shadcn/separator";
import { AuthFrame } from "@/components/auth-frame";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Tablet } from "lucide-react";

import { Input } from "@/components/ui/input";

/** The front door, in the shared AuthFrame: the blue brand panel beside one white panel
 *  (AUSignIn).
 *
 *  With Google set up (`google`), Google is the only way in on the sign-in page
 *  (owner decision, 23 October 2026): one button, and a first sign-in makes the
 *  account. The email and password form stays for deployments without Google
 *  (previews, local) and, as `developer`, on the unlinked /sign-in/developer page
 *  for superadmin accounts only.
 *
 *  `devAdminName` arrives already decided by the server: the page only passes
 *  a name when the deployment is allowed a passwordless sign-in, so the client
 *  never carries the rule and cannot be talked into showing the button. */
export function SignInForm({ devAdminName, sharedDeviceName = null, google = false, developer = false, initialError = null }: { devAdminName: string | null; sharedDeviceName?: string | null; google?: boolean; developer?: boolean; initialError?: string | null }) {
  const passwordForm = developer || !google;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();

  function land() {
    setError(null);
    // The home page resolves the person's role and modules.
    router.push("/");
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      // One failure sentence for every reason. Saying which half was wrong
      // turns the form into a way of finding out who has an account.
      const wrong = "That email and password don't match an active account.";
      try {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (result?.code === "work_device") {
          setError("This account can only sign in to Turnfin Work on a work computer. For your own records, use Turnfin Me on your phone.");
          return;
        }
        if (!result || result.error) {
          setError(wrong);
          return;
        }
      } catch {
        setError("Could not sign you in. Try again.");
        return;
      }
      land();
    });
  }

  /** Off to Google and back to the home page. The server finds or makes the
   *  account, and lets them in once it has a role. */
  function handleGoogleSignIn() {
    setError(null);
    startTransition(async () => {
      try {
        await signIn("google", { redirectTo: "/" });
      } catch {
        setError("Could not sign you in with Google. Try again.");
      }
    });
  }

  function handleDevSignIn() {
    startTransition(async () => {
      try {
        const result = await signIn("dev-admin", { redirect: false });
        if (!result || result.error) {
          setError("The dev sign-in is not available on this deployment.");
          return;
        }
      } catch {
        setError("The dev sign-in is not available on this deployment.");
        return;
      }
      land();
    });
  }

  return (
    <AuthFrame welcome>
      <PageShell header={<PageHeader
        title={developer ? "Developer sign-in" : "Sign in"}
        description={developer ? "For superadmin accounts only. Everyone else signs in with Google." : passwordForm ? "Use your work email and password." : "Use your work Google account."}
      />}>

      {sharedDeviceName ? (
        <div className="pc-note flex-wrap">
          <Tablet aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ui-primary" />
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-sm font-semibold">{`${sharedDeviceName} is a work device`}</p>
            <p className="text-xs text-ui-muted-foreground">If you have set a PIN and signed in here before, switch in with it instead.</p>
          </div>
          <Button asChild variant="outline" className="ml-auto"><Link href="/switch">Switch user</Link></Button>
        </div>
      ) : null}

      {passwordForm ? (
      <form method="post" onSubmit={handleSubmit}>
        <div className="flex min-w-0 flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            name="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            name="password"
            required
            autoComplete="current-password"
          />

          {error ? <Notice title={error} tone="error" live="alert" /> : null}

          <LoadingButton
            type="submit"
            variant="default"
            pending={pending}
            pendingLabel="Signing in…"
            className="w-full"
          >
            Sign in
          </LoadingButton>
        </div>
      </form>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {error ? <Notice title={error} tone="error" live="alert" /> : null}
          <LoadingButton type="button" variant="default" onClick={handleGoogleSignIn} pending={pending} pendingLabel="Opening Google…" className="w-full">
            Sign in with Google
          </LoadingButton>
        </div>
      )}

      {developer ? null : passwordForm ? (
        <p className="text-xs text-ui-muted-foreground">No account yet? Ask a manager to add you in Admin.</p>
      ) : (
        <p className="text-xs text-ui-muted-foreground">New here? Sign in with your work Google account and your Turnfin account is made for you. Then ask your manager to give you access.</p>
      )}

      {devAdminName ? (
        <>
          <Separator />
          <div className="flex min-w-0 flex-col gap-2">
            <Notice
              title="Dev deployment"
              description="This button does not exist in production."
              tone="warning"
            ></Notice>
            <Button
              type="button"
              onClick={handleDevSignIn}
              variant="outline"
              disabled={pending}
              className="w-full"
            >{`Sign in as ${devAdminName}`}</Button>
          </div>
        </>
      ) : null}
      </PageShell>
    </AuthFrame>
  );
}
