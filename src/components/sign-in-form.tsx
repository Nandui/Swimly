"use client";
import { Notice } from "@/components/ui-kit/notice";
import { Button } from "@/components/shadcn/button";
import { Separator } from "@/components/shadcn/separator";
import { Card } from "@/components/shadcn/card";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Waves } from "lucide-react";

import { Input } from "@/components/ui/input";
import { APP_NAME } from "@/lib/app";

/** The front door: one shadcn card, centred
 *  on the page ground.
 *
 *  `devAdminName` arrives already decided by the server: the page only passes
 *  a name when the deployment is allowed a passwordless sign-in, so the client
 *  never carries the rule and cannot be talked into showing the button. */
export function SignInForm({ devAdminName }: { devAdminName: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function land() {
    setError(null);
    // `/start` reads the role and lands them where their day begins.
    router.push("/start");
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
    <div className="min-w-0 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="min-w-0 flex flex-col gap-5">
          <div className="min-w-0 flex flex-col gap-1">
            <div className="min-w-0 flex gap-1 items-center">
              <Waves aria-hidden={true} className="size-4 shrink-0" />
              <span className="text-sm text-ui-foreground font-semibold">
                {APP_NAME}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="min-w-0 flex flex-col gap-4">
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

              <Button
                type="submit"
                variant="default"
                size="lg"
                disabled={pending}
                aria-busy={pending}
                className="w-full"
              >
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </div>
          </form>

          {devAdminName ? (
            <>
              <Separator />
              <div className="min-w-0 flex flex-col gap-2">
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
        </div>
      </Card>
    </div>
  );
}
