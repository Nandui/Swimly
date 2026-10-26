"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, ChevronRight, CloudDownload, GraduationCap, MessageCircle, Type, UserRound } from "lucide-react";
import { Frame, SignOut } from "@/components/frame";
import { session } from "@/lib/api";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

const noSubscription = () => () => {};

const LINKS = [
  { href: "/reading", label: "Required reading", hint: "Documents to read, and what you have read", icon: BookOpen },
  { href: "/qualifications", label: "Qualifications", hint: "Your certificates, and upload a new one", icon: GraduationCap },
  { href: "/hr", label: "Shared by HR", hint: "Reviews and notes shared with you. Asks for a fresh code.", icon: MessageCircle },
  { href: "/details", label: "My details", hint: "Phone, address and emergency contact", icon: UserRound },
  { href: "/reminders", label: "Reminders", hint: "Which emails you get", icon: Bell },
  { href: "/offline", label: "Saved for offline", hint: "Courses you can open with no signal", icon: CloudDownload },
  { href: "/display", label: "Text size and reading aloud", hint: "Bigger text, and how fast lessons are read to you", icon: Type },
];

/** Everything that is not Home, Training or Shifts, as one grouped list, then Sign out.
 *  The menu loads nothing, so it checks the session itself, as the data pages do: signed out,
 *  it goes to sign-in and never shows the frame. Unknown until the browser reads the token. */
export default function MorePage() {
  const router = useRouter();
  const token = useSyncExternalStore(noSubscription, () => session.token(), () => undefined);
  useEffect(() => { if (token === null) router.replace(`/sign-in?next=${encodeURIComponent("/more")}`); }, [token, router]);
  if (!token) return null;
  return (
    <Frame title="More">
      <PageShell header={<PageHeader title="More" />}>
        <nav aria-label="More in Turnfin Me">
          <ul className="pc-list">{LINKS.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}><Link href={href} className="pc-row">
              <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
              <span className="pc-row-body"><span className="pc-row-title">{label}</span><span className="pc-row-hint">{hint}</span></span>
              <span className="pc-row-trail"><ChevronRight className="pc-row-chevron" aria-hidden="true" /></span>
            </Link></li>
          ))}</ul>
        </nav>
        <SignOut />
      </PageShell>
    </Frame>
  );
}
