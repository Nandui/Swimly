import Link from "next/link";
import { Button } from "@/components/shadcn/button";

export function AwaitingNavigation({ active }: { active: "enrolment" | "moves" }) {
  return <nav aria-label="Awaiting enrolment views" className="flex w-fit max-w-full flex-wrap gap-1 rounded-ui-lg bg-ui-muted p-1">
    {([{ key: "enrolment", label: "Enrolments & waitlists", href: "/awaiting-enrolment" },
      { key: "moves", label: "Awaiting moves", href: "/awaiting-enrolment?view=moves" }] as const).map(item =>
      <Button key={item.key} asChild variant="ghost" className={`min-h-11 ${active === item.key ? "bg-ui-background text-ui-primary shadow-xs hover:bg-ui-background" : "text-ui-muted-foreground"}`}>
        <Link href={item.href} aria-current={active === item.key ? "page" : undefined}>{item.label}</Link>
      </Button>)}
  </nav>;
}
