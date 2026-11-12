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
 *  Every account may sign in with its email and password. With Google set up
 *  (`google`) the sign-in page also offers Sign in with Google, and a first
 *  Google sign-in makes the account (owner decision, 23 October 2026). The
 *  unlinked /sign-in/developer page (`developer`) shows the password form only.
 *
 *  `devAdminName` arrives already decided by the server: the page only passes
 *  a name when the deployment is allowed a passwordless sign-in, so the client
 *  never carries the rule and cannot be talked into showing the button. */
export function SignInForm({ devAdminName, sharedDeviceName = null, google = false, developer = false, initialError = null }: { devAdminName: string | null; sharedDeviceName?: string | null; google?: boolean; developer?: boolean; initialError?: string | null }) {
  const withGoogle = google && !developer;
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
          setError("This account can only sign in to Turnfin on a work computer. For your own records, use Turnfin Me on your phone.");
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
        description={developer ? "Email and password for the developer login." : withGoogle ? "Use your work email and password, or your work Google account." : "Use your work email and password."}
      />}>

      {sharedDeviceName ? (
        <Notice icon={Tablet} title={`${sharedDeviceName} is a work device`}
          description="If you have set a PIN and signed in here before, switch in with it instead."
          actions={<Button asChild variant="outline"><Link href="/switch">Switch user</Link></Button>} />
      ) : null}

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

      {withGoogle ? (
        <>
          <div className="flex min-w-0 items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-ui-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={pending} className="w-full">
            Sign in with Google
          </Button>
        </>
      ) : null}

      {developer ? null : withGoogle ? (
        <p className="text-xs text-ui-muted-foreground">New here? Sign in with your work Google account and your Turnfin account is made for you. Then ask your manager to give you access.</p>
      ) : (
        <p className="text-xs text-ui-muted-foreground">No account yet? Ask a manager to add you in Admin.</p>
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
