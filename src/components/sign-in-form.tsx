"use client";
import { Notice } from "@/components/ui-kit/notice";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Separator } from "@/components/shadcn/separator";
import { AuthFrame } from "@/components/auth-frame";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

import { Input } from "@/components/ui/input";

/** The front door, in the shared AuthFrame: the fin above one white panel.
 *
 *  `devAdminName` arrives already decided by the server: the page only passes
 *  a name when the deployment is allowed a passwordless sign-in, so the client
 *  never carries the rule and cannot be talked into showing the button. */
export function SignInForm({ devAdminName, sharedDeviceName = null }: { devAdminName: string | null; sharedDeviceName?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
        setError("Something went wrong signing in. Try again.");
        return;
      }
      land();
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
    <AuthFrame note="No account yet? Ask a manager to add you in Admin.">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-ui-muted-foreground">Use your work email and password.</p>
      </div>

      {sharedDeviceName ? (
        <Notice
          title={`${sharedDeviceName} is a shared device`}
          description="If you have set a PIN and signed in here before, switch in with it instead."
          tone="info"
          actions={<Button asChild variant="outline"><Link href="/switch">Switch user</Link></Button>}
        ></Notice>
      ) : null}

      <form onSubmit={handleSubmit}>
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

          {error ? <Notice title={error} tone="error"></Notice> : null}

          <LoadingButton
            type="submit"
            variant="default"
            size="lg"
            pending={pending}
            pendingLabel="Signing in…"
            className="w-full"
          >
            Sign in
          </LoadingButton>
        </div>
      </form>

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
              size="lg"
              disabled={pending}
              className="w-full"
            >{`Sign in as ${devAdminName}`}</Button>
          </div>
        </>
      ) : null}
    </AuthFrame>
  );
}
