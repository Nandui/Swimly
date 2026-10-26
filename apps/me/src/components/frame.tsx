"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BookOpen, CalendarDays, GraduationCap, House, LayoutGrid, LogOut } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { TextSizeEffect } from "@/components/learner";
import { OfflineBar, useOffline } from "@/components/offline";
import { api, session } from "@/lib/api";
import { clearAll } from "@/lib/offline";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/reading", label: "Reading", icon: BookOpen },
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/more", label: "More", icon: LayoutGrid },
];
const MORE = ["/more", "/qualifications", "/hr", "/details", "/reminders", "/display"];

/** The fin on its tile (Turnfin's `.tf-brand`) and the name beside it. Signed-in pages link the
 *  fin home; sign-in shows it without a link. */
export function Brand({ href }: { href?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  const fin = <img src="/icon-192.png" alt="" width={72} height={72} />;
  return (
    <div className="brand">
      {href ? <Link href={href} className="tf-brand" aria-label="Turnfin Me home">{fin}</Link> : <span className="tf-brand" aria-hidden="true">{fin}</span>}
      <span className="brand-name">Turnfin Me</span>
    </div>
  );
}

/** Every signed-in page: the top row (the fin, the name, Sign out), the page, and the bottom
 *  bar. `title` is the page's H1; it also names the browser tab. */
export function Frame({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { waiting } = useOffline();
  const active = (href: string) => href === "/" ? pathname === "/" : href === "/more" ? MORE.some((p) => pathname.startsWith(p)) : pathname.startsWith(href);
  async function signOut(sure = false) {
    // Changes not sent yet would be lost: say so first.
    if (waiting && !sure) { setConfirming(true); return; }
    setLeaving(true);
    try { await api("auth/logout", { method: "POST" }); } catch { /* the token is dropped anyway */ }
    session.clear();
    await clearAll();
    router.replace("/sign-in");
  }
  return (
    <div className="frame">
      <title>{`${title} · Turnfin Me`}</title>
      <TextSizeEffect />
      <header className="topbar">
        <Brand href="/" />
        <div className="tf-bar glass">
          <Button type="button" variant="ghost" className="tf-bar-item" onClick={() => void signOut()} disabled={leaving}><LogOut aria-hidden="true" />{leaving ? "Signing out…" : "Sign out"}</Button>
        </div>
      </header>
      <OfflineBar />
      {confirming ? (
        <div className="offline-failed" role="alert">
          <p><strong>{waiting === 1 ? "1 change hasn’t" : `${waiting} changes haven’t`} reached Turnfin yet.</strong> Signing out now deletes {waiting === 1 ? "it" : "them"} from this phone.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void signOut(true)}>Sign out anyway</Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Stay signed in</Button>
          </div>
        </div>
      ) : null}
      <main className="page" id="main" aria-label={title}>{children}</main>
      <nav className="tf-bottom glass" aria-label="Turnfin Me">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="tf-bottom-item" aria-current={active(href) ? "page" : undefined}>
            <span className="tf-bottom-icon"><Icon aria-hidden="true" /></span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
