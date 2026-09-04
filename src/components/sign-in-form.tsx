"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The front door. One bordered panel, no shadow, no card grid — the same
 *  grammar as every other surface, just centred.
 *
 *  `devAdminName` arrives already decided by the server: the page only passes
 *  a name when the deployment is allowed a passwordless sign-in, so the client
 *  never carries the rule and cannot be talked into showing the button. */
export function SignInForm({ devAdminName }: { devAdminName: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    startTransition(async () => {
      // One failure sentence for every reason. Saying which half was wrong
      // turns the form into a way of finding out who has an account.
      const wrong = "That email and password don't match an active account.";
      try {
        const result = await signIn("credentials", {
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? ""),
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
      setError(null);
      // `/start` reads the role and lands them where their day begins.
      router.push("/start");
      router.refresh();
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
      setError(null);
      // `/start` reads the role and lands them where their day begins.
      router.push("/start");
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-sm space-y-5 rounded-md border bg-background p-6">
        <div className="space-y-1">
          <span className="flex items-baseline gap-0.5 select-none">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">Swimly</span>
            <span className="size-1.5 translate-y-px rounded-full bg-primary" aria-hidden />
          </span>
          <h1 className="text-[26px] leading-tight font-bold tracking-tight text-foreground">
            Sign in
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[13px] font-medium text-foreground">
              Email
            </label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[13px] font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded bg-(--tag-red-bg) px-2.5 py-1.5 text-[13px] text-(--tag-red-fg)"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {devAdminName ? (
          <div className="space-y-2 border-t pt-4">
            <p className="rounded bg-(--tag-yellow-bg) px-2.5 py-1.5 text-[13px] text-(--tag-yellow-fg)">
              Dev deployment. This button does not exist in production.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={handleDevSignIn}
            >
              Sign in as {devAdminName}
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
