"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { Delete, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { AuthFrame } from "@/components/auth-frame";
import { Notice } from "@/components/ui-kit/notice";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { SHARED_IDLE_MINUTES } from "@/lib/devices/constants";
import { removeOwnPin, setOwnPin } from "@/lib/devices/actions";
import { toast } from "sonner";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AuthFrame>
      <div className="min-w-0 flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </AuthFrame>
  );
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

/** Quick switch on a shared device: tap your name, enter your PIN. */
export function QuickSwitch({ device, people }: { device: string; people: { id: string; name: string }[] }) {
  const router = useRouter();
  const [chosen, setChosen] = React.useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const submit = (value: string) => start(async () => {
    if (!chosen) return;
    const result = await signIn("pin", { userId: chosen.id, pin: value, redirect: false }).catch(() => null);
    if (!result || result.error) {
      setPin("");
      setError("That PIN did not work. After five wrong tries the PIN locks until you sign in with your password.");
      return;
    }
    router.push("/");
    router.refresh();
  });
  const press = (digit: string) => {
    setError(null);
    const next = (pin + digit).slice(0, 8);
    setPin(next);
  };

  if (!chosen) {
    return (
      <Frame title="Who is using this device?">
        <p className="text-sm text-ui-muted-foreground">{device} · shared device. It signs out after {SHARED_IDLE_MINUTES} idle minutes.</p>
        {people.length === 0 ? (
          <Notice title="Nobody can quick-switch here yet" description="Sign in with your email and password once on this device, after setting a PIN on your Account page." tone="info" />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="People who can switch in">
            {people.map((person) => (
              <li key={person.id}>
                <Button type="button" variant="outline" className="w-full justify-start gap-3 min-h-12" onClick={() => { setChosen(person); setPin(""); setError(null); }}>
                  <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-ui-muted text-sm font-semibold">{initials(person.name)}</span>
                  {person.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="ghost"><Link href="/sign-in"><UserRound aria-hidden="true" />Sign in with email instead</Link></Button>
      </Frame>
    );
  }

  return (
    <Frame title={`Hello, ${chosen.name.split(" ")[0]}`}>
      <form onSubmit={(e) => { e.preventDefault(); submit(pin); }} className="flex flex-col gap-4">
        <Input
          label="Your PIN"
          description="4 to 8 digits."
          value={pin}
          onChange={(value) => { setError(null); setPin(value.replace(/\D/g, "").slice(0, 8)); }}
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
        />
        <div className="grid grid-cols-3 gap-2" aria-hidden="true">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button key={d} type="button" variant="outline" tabIndex={-1} className="min-h-12 text-lg" onClick={() => press(d)}>{d}</Button>
          ))}
          <Button type="button" variant="ghost" tabIndex={-1} className="min-h-12" onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete"><Delete /></Button>
          <Button type="button" variant="outline" tabIndex={-1} className="min-h-12 text-lg" onClick={() => press("0")}>0</Button>
          <span />
        </div>
        {error ? <Notice title={error} tone="error" /> : null}
        <LoadingButton type="submit" pending={pending} pendingLabel="Checking…" disabled={pin.length < 4} className="w-full">Continue</LoadingButton>
        <Button type="button" variant="ghost" onClick={() => { setChosen(null); setPin(""); }}>Not {chosen.name.split(" ")[0]}?</Button>
      </form>
    </Frame>
  );
}

/** Step-up: restricted records need the password confirmed recently, and a
 *  PIN switch never counts. Confirming signs in again with the password. */
export function ConfirmPassword({ email, name, next }: { email: string; name: string; next: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Frame title="Confirm it’s you">
      <p className="text-sm text-ui-muted-foreground">
        {name}, this area holds restricted records. Enter your password to open it. You will not be asked again for 15 minutes.
      </p>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await signIn("credentials", { email, password, redirect: false }).catch(() => null);
          if (!result || result.error) { setError("That password is not right."); return; }
          router.push(next);
          router.refresh();
        });
      }}>
        <Input label="Password" type="password" value={password} onChange={setPassword} name="password" required autoComplete="current-password" autoFocus />
        {error ? <Notice title={error} tone="error" /> : null}
        <LoadingButton type="submit" pending={pending} pendingLabel="Checking…" className="w-full">Confirm</LoadingButton>
        <Button asChild variant="ghost"><Link href="/">Go back</Link></Button>
      </form>
    </Frame>
  );
}

/** Account: set, change or remove the quick-switch PIN. */
export function PinSettings({ hasPin, locked }: { hasPin: boolean; locked: boolean }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => start(async () => {
    setError(null);
    const result = await action();
    if (!result.ok) { setError(result.error ?? "That did not work."); return; }
    toast.success(success);
    setPassword(""); setPin("");
    router.refresh();
  });
  return (
    <form className="flex flex-col gap-4 max-w-sm" onSubmit={(e) => { e.preventDefault(); run(() => setOwnPin(password, pin), hasPin ? "PIN changed" : "PIN set"); }}>
      {locked ? <Notice title="Your PIN is locked" description="Too many wrong PINs. Sign in with your password on the shared device to unlock it." tone="warning" /> : null}
      <Input label="Current password" type="password" value={password} onChange={setPassword} name="currentPassword" required autoComplete="current-password" />
      <Input label={hasPin ? "New PIN" : "PIN"} type="password" value={pin} onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 8))} name="pin" inputMode="numeric" autoComplete="off" description="4 to 8 digits, not a repeated digit or a simple run like 1234." />
      {error ? <Notice title={error} tone="error" /> : null}
      <div className="flex flex-wrap gap-2">
        <LoadingButton type="submit" pending={pending} pendingLabel="Saving…" disabled={pin.length < 4 || !password}>{hasPin ? "Change PIN" : "Set PIN"}</LoadingButton>
        {hasPin ? <Button type="button" variant="outline" disabled={pending || !password} onClick={() => run(() => removeOwnPin(password), "PIN removed")}>Remove PIN</Button> : null}
      </div>
    </form>
  );
}

/** On a shared device, returns to the switch screen after a few idle minutes. */
export function SharedDeviceIdle({ minutes }: { minutes: number }) {
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void signOut({ redirectTo: "/switch" }); }, minutes * 60 * 1000);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const event of events) window.addEventListener(event, reset, { passive: true });
    reset();
    return () => { clearTimeout(timer); for (const event of events) window.removeEventListener(event, reset); };
  }, [minutes]);
  return null;
}
