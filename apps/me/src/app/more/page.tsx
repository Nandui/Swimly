"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, GraduationCap, MessageCircle, UserRound } from "lucide-react";
import { Frame } from "@/components/frame";
import { session } from "@/lib/api";

const noSubscription = () => () => {};

const LINKS = [
  { href: "/qualifications", label: "Qualifications", hint: "Your certificates, and upload a new one", icon: GraduationCap },
  { href: "/hr", label: "Shared by HR", hint: "Reviews and notes shared with you. Asks for a fresh code.", icon: MessageCircle },
  { href: "/details", label: "My details", hint: "Phone, address and emergency contact", icon: UserRound },
  { href: "/reminders", label: "Reminders", hint: "Which emails you get", icon: Bell },
];

/** The menu loads nothing, so it checks the session itself, as the data pages do: signed out,
 *  it goes to sign-in and never shows the frame. Unknown until the browser reads the token. */
export default function MorePage() {
  const router = useRouter();
  const token = useSyncExternalStore(noSubscription, () => session.token(), () => undefined);
  useEffect(() => { if (token === null) router.replace(`/sign-in?next=${encodeURIComponent("/more")}`); }, [token, router]);
  if (!token) return null;
  return (
    <Frame title="More">
      <div className="stack">
        <h1>More</h1>
        <nav className="pc-panel" aria-label="More in Turnfin Me">
          <ul className="pc-rows">{LINKS.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}><Link href={href} className="pc-row">
              <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
              <span className="pc-row-body"><span className="pc-row-title">{label}</span><span className="pc-row-hint">{hint}</span></span>
              <span className="pc-row-trail"><ChevronRight className="pc-row-chevron" aria-hidden="true" /></span>
            </Link></li>
          ))}</ul>
        </nav>
      </div>
    </Frame>
  );
}
