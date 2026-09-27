"use client";

import Link from "next/link";
import { BadgeCheck, Bell, ChevronRight, HeartHandshake, UserRound } from "lucide-react";
import { Frame } from "@/components/frame";

const LINKS = [
  { href: "/qualifications", label: "Qualifications", hint: "Your certificates, and upload a new one", icon: BadgeCheck },
  { href: "/hr", label: "Shared by HR", hint: "Reviews and notes shared with you. Asks for a fresh code.", icon: HeartHandshake },
  { href: "/details", label: "My details", hint: "Phone, address and emergency contact", icon: UserRound },
  { href: "/reminders", label: "Reminders", hint: "Which emails you get", icon: Bell },
];

export default function MorePage() {
  return (
    <Frame title="More">
      <div className="stack">
        <h1>More</h1>
        <nav className="card" aria-label="More in Turnfin Me">
          <ul className="list">{LINKS.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}><Link href={href} className="item">
              <span className="row" style={{ flexWrap: "nowrap", gap: 12 }}><Icon aria-hidden="true" width={22} height={22} /><span className="item-main"><span className="item-title">{label}</span><span className="caption">{hint}</span></span></span>
              <ChevronRight className="chevron" aria-hidden="true" />
            </Link></li>
          ))}</ul>
        </nav>
      </div>
    </Frame>
  );
}
