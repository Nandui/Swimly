"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BookOpen, CalendarDays, GraduationCap, House, LayoutGrid, LogOut } from "lucide-react";
import { api, session } from "@/lib/api";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/reading", label: "Reading", icon: BookOpen },
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/more", label: "More", icon: LayoutGrid },
];
const MORE = ["/more", "/qualifications", "/hr", "/details", "/reminders"];

/** The fin on its tile (Work's `.tf-brand`) and the name beside it. Signed-in pages link the
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
  const active = (href: string) => href === "/" ? pathname === "/" : href === "/more" ? MORE.some((p) => pathname.startsWith(p)) : pathname.startsWith(href);
  async function signOut() {
    setLeaving(true);
    try { await api("auth/logout", { method: "POST" }); } catch { /* the token is dropped anyway */ }
    session.clear();
    router.replace("/sign-in");
  }
  return (
    <div className="frame">
      <title>{`${title} · Turnfin Me`}</title>
      <header className="topbar">
        <Brand href="/" />
        <div className="tf-bar">
          <button type="button" className="tf-bar-item" onClick={signOut} disabled={leaving}><LogOut aria-hidden="true" />{leaving ? "Signing out…" : "Sign out"}</button>
        </div>
      </header>
      <main className="page" id="main" aria-label={title}>{children}</main>
      <nav className="tf-bottom" aria-label="Turnfin Me">
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
