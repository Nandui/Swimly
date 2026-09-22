import Link from "next/link";
import { Button } from "@/components/shadcn/button";

export function AwaitingNavigation({ active }: { active: "enrolment" | "moves" }) {
  return <nav aria-label="Awaiting enrolment views" className="flex flex-wrap gap-2">
    {([{ key: "enrolment", label: "Enrolments & waitlists", href: "/awaiting-enrolment" },
      { key: "moves", label: "Awaiting moves", href: "/awaiting-enrolment?view=moves" }] as const).map(item =>
      <Button key={item.key} asChild variant={active === item.key ? "secondary" : "ghost"} className="min-h-11">
        <Link href={item.href} aria-current={active === item.key ? "page" : undefined}>{item.label}</Link>
      </Button>)}
  </nav>;
}
