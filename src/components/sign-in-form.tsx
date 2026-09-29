"use client";
import { Notice } from "@/components/ui-kit/notice";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Separator } from "@/components/shadcn/separator";
import { Card } from "@/components/shadcn/card";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";

import { Input } from "@/components/ui/input";

/** The front door, in Poolside Clear with the Turnfin fin. On a wide screen
 *  the brand has the left half, a soft pool panel with the fin and the
 *  brand line; the form sits on the canvas to the right. On a phone the fin
 *  and wordmark sit above the form. Every colour is a theme token, so the
 *  pool-night mode follows.
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
    <div className="grid min-h-svh min-w-0 bg-ui-workspace lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section
        aria-label="Turnfin"
        className="relative hidden min-w-0 flex-col justify-center overflow-hidden px-10 pb-40 pt-10 lg:flex xl:px-16"
        style={{ background: "linear-gradient(160deg, var(--pc-surface) 0%, var(--pc-primary-soft) 55%, var(--pc-aqua-soft) 100%)" }}
      >
        <div className="relative z-10 flex max-w-md flex-col gap-6">
          <span className="flex items-center gap-3">
            <FinMark className="size-14" />
            <span className="text-2xl font-bold tracking-tight text-ui-foreground">Turnfin</span>
          </span>
          <div className="flex flex-col gap-3">
            <p className="text-[length:clamp(var(--pc-text-figure),3vw,2.625rem)] font-bold leading-[1.1] tracking-tight text-ui-foreground">
              People. Places.<br />Progress.
            </p>
            <p className="max-w-sm text-base text-ui-muted-foreground">
              The swim school, the rota, training, documents and refunds for LeisureWorld&apos;s pools, in one place.
            </p>
          </div>
        </div>
        <Water />
        <p className="absolute bottom-6 left-10 z-10 text-xs font-medium text-ui-primary xl:left-16">Turnfin Work · for work computers at LeisureWorld</p>
      </section>

      <main className="flex min-w-0 items-center justify-center p-4 sm:p-8">
        <div className="flex w-full max-w-sm min-w-0 flex-col gap-6">
          <div className="lg:hidden"><Wordmark /></div>
          <Card className="gap-5 p-6 shadow-none">
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
          </Card>
          <p className="text-center text-xs text-ui-muted-foreground">No account yet? Ask a manager to add you in Admin.</p>
        </div>
      </main>
    </div>
  );
}

/** The fin and "Turnfin", for a phone, where the brand panel is hidden. */
function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <FinMark className="size-10" />
      <span className="text-xl font-bold tracking-tight text-ui-foreground">Turnfin</span>
    </span>
  );
}

/** The Turnfin fin at a given size. The artwork is centred with wide
 *  margins, so it is enlarged inside a clipping box to fill it. */
function FinMark({ className }: { className: string }) {
  return (
    <span className={`relative shrink-0 overflow-hidden ${className}`} aria-hidden="true">
      <Image src="/brand/turnfin.png" alt="" width={176} height={176} priority className="absolute left-1/2 top-1/2 size-[170%] max-w-none -translate-x-1/2 -translate-y-1/2" />
    </span>
  );
}

/** The pool's surface along the foot of the brand panel: three soft swells in
 *  the fin's teal and aqua, echoing the wave in the logo. */
function Water() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 220" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full">
      <path d="M0 90 C 180 40, 360 140, 600 90 S 1000 40, 1200 100 V 220 H 0 Z" fill="var(--pc-aqua)" opacity="0.18" />
      <path d="M0 130 C 220 80, 420 180, 660 125 S 1020 90, 1200 140 V 220 H 0 Z" fill="var(--pc-primary)" opacity="0.14" />
      <path d="M0 170 C 240 135, 460 210, 720 165 S 1060 140, 1200 175 V 220 H 0 Z" fill="var(--pc-aqua)" opacity="0.28" />
    </svg>
  );
}