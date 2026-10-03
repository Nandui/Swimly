import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

export function AwaitingNavigation({ active }: { active: "enrolment" | "moves" }) {
  return <SegmentedLinks label="Awaiting enrolment views" items={([{ key: "enrolment", label: "Enrolments & waitlists", href: "/awaiting-enrolment" },
    { key: "moves", label: "Awaiting moves", href: "/awaiting-enrolment?view=moves" }] as const).map(item => ({ href: item.href, label: item.label, current: active === item.key }))} />;
}
