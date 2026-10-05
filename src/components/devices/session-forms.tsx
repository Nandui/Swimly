"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { Check, ChevronRight, Delete, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { AuthFrame } from "@/components/auth-frame";
import { Avatar } from "@/components/docs/ui";
import { Notice } from "@/components/ui-kit/notice";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { SHARED_IDLE_MINUTES } from "@/lib/devices/constants";
import { removeOwnPin, setOwnPin } from "@/lib/devices/actions";
import { toast } from "sonner";

/** One auth panel: the H1 and its description grouped tight, then the body (AUConfirm, AUSwitch). */
function Frame({ title, description, fin = false, children }: { title: string; description?: React.ReactNode; fin?: boolean; children: React.ReactNode }) {
  return (
    <AuthFrame fin={fin ? "start" : undefined}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-ui-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </AuthFrame>
  );
}

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
      <Frame title="Who is using this device?" description={`${device} · work device. It signs out after ${SHARED_IDLE_MINUTES} idle minutes.`}>
        {people.length === 0 ? (
          <Notice title="Nobody can quick-switch here yet" description="Sign in with your email and password once on this device, after setting a PIN on your Account page." tone="info" />
        ) : (
          <ul className="pc-rows" aria-label="People who can switch in">
            {people.map((person) => (
              <li key={person.id}>
                {/* Outline gives the row its edge and hover; .pc-row gives the shape. */}
                <Button type="button" variant="outline" className="pc-row h-auto w-full justify-start text-start whitespace-normal" onClick={() => { setChosen(person); setPin(""); setError(null); }}>
                  <Avatar member={person} />
                  <span className="pc-row-body"><span className="pc-row-title">{person.name}</span></span>
                  <span className="pc-row-trail"><ChevronRight aria-hidden="true" className="pc-row-chevron" /></span>
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
    <Frame title={`Hello, ${chosen.name.split(" ")[0]}`} description="Enter your PIN. 4 to 8 digits.">
      <form onSubmit={(e) => { e.preventDefault(); submit(pin); }} className="flex flex-col gap-4">
        <Input
          label="Your PIN"
          value={pin}
          onChange={(value) => { setError(null); setPin(value.replace(/\D/g, "").slice(0, 8)); }}
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
        />
        {/* A touch pad for the field above; keyboard users type into the field. */}
        <div className="pc-keypad grid grid-cols-3 gap-2" aria-hidden="true">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button key={d} type="button" variant="outline" tabIndex={-1} onClick={() => press(d)}>{d}</Button>
          ))}
          <Button type="button" variant="outline" tabIndex={-1} onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete"><Delete /></Button>
          <Button type="button" variant="outline" tabIndex={-1} onClick={() => press("0")}>0</Button>
          <Button type="submit" variant="outline" tabIndex={-1} disabled={pin.length < 4 || pending} aria-label="Continue"><Check /></Button>
        </div>
        {error ? <Notice title={error} tone="error" live="alert" /> : null}
        <div className="flex flex-wrap gap-3">
          <LoadingButton type="submit" pending={pending} pendingLabel="Checking…" disabled={pin.length < 4}>Continue</LoadingButton>
          <Button type="button" variant="ghost" onClick={() => { setChosen(null); setPin(""); }}>Not {chosen.name.split(" ")[0]}?</Button>
        </div>
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
    <Frame fin title="Confirm it’s you" description={`${name}, this area holds restricted records. Enter your password to open it. You will not be asked again for 15 minutes.`}>
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
        {error ? <Notice title={error} tone="error" live="alert" /> : null}
        <div className="flex flex-wrap gap-3">
          <LoadingButton type="submit" pending={pending} pendingLabel="Checking…">Confirm</LoadingButton>
          {/* The step-up redirect replaced the restricted page in history, so back is the page before it. */}
          <Button type="button" variant="ghost" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}>Go back</Button>
        </div>
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
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run(() => setOwnPin(password, pin), hasPin ? "PIN changed" : "PIN set"); }}>
      {locked ? <Notice title="Your PIN is locked" description="Too many wrong PINs. Sign in with your password on that work device to unlock it." tone="warning" /> : null}
      <Input label="Current password" type="password" value={password} onChange={setPassword} name="currentPassword" required autoComplete="current-password" />
      <Input label={hasPin ? "New PIN" : "PIN"} type="password" value={pin} onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 8))} name="pin" inputMode="numeric" autoComplete="off" description="4 to 8 digits, not a repeated digit or a simple run like 1234." />
      {error ? <Notice title={error} tone="error" live="alert" /> : null}
      <div className="flex flex-wrap gap-2">
        <LoadingButton type="submit" pending={pending} pendingLabel="Saving…" disabled={pin.length < 4 || !password}>{hasPin ? "Change PIN" : "Set PIN"}</LoadingButton>
        {hasPin ? <Button type="button" variant="outline" disabled={pending || !password} onClick={() => run(() => removeOwnPin(password), "PIN removed")}>Remove PIN</Button> : null}
      </div>
    </form>
  );
}

/** On a work device, returns to the switch screen after a few idle minutes. */
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
