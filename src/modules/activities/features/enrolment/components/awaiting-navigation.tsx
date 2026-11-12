import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

/** The two queues, each with its count for the same search. The links keep the search. */
export function AwaitingNavigation({ active, q = "", counts }: { active: "enrolment" | "moves"; q?: string; counts?: { enrolment: number; moves: number } }) {
  const href = (moves: boolean) => {
    const query = new URLSearchParams({ ...(moves ? { view: "moves" } : {}), ...(q ? { q } : {}) });
    return `/awaiting-enrolment${query.size ? `?${query}` : ""}`;
  };
  return <SegmentedLinks label="Awaiting enrolment views" items={([{ key: "enrolment", label: "Enrolments and waitlists" },
    { key: "moves", label: "Awaiting moves" }] as const).map(item => ({ href: href(item.key === "moves"), label: item.label, count: counts?.[item.key], current: active === item.key }))} />;
}
