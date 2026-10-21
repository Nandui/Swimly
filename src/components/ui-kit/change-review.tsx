import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowRightLeft, CalendarClock, Clock, Info, Layers, MapPin, Plus } from "lucide-react";
import { Notice } from "@/components/ui-kit/notice";
import { Tag, type TagMeta } from "@/components/ui-kit/tag";
import { cn } from "@/lib/utils";

/** The shapes ChangeReview draws. `PlannedChange` (lib/action-result.ts) has this shape; the UI
 *  kit declares its own because it may not import the platform, and the compiler keeps the two
 *  in step. */
export type ReviewPlace = { title: string; when: string; level: string; centre: string };
export type ReviewChange = {
  subject: string;
  kind: "move" | "enrol" | "waitlist";
  from: ReviewPlace[];
  to: ReviewPlace;
  notes: string[];
};

const KIND: Record<ReviewChange["kind"], TagMeta> = {
  move: { label: "Class move", color: "blue", icon: ArrowRightLeft },
  enrol: { label: "New place", color: "green", icon: Plus },
  waitlist: { label: "Waitlist", color: "orange", icon: Clock },
};

const SIDE = {
  move: { from: "Leaves", fromWhen: "ends today", to: "Joins", toWhen: "starts today" },
  enrol: { from: "Holds now", fromWhen: "your choice below decides if it ends", to: "New place", toWhen: "starts today" },
  waitlist: { from: "Holds now", fromWhen: "stays as it is", to: "Joins the waitlist", toWhen: "no place yet" },
} as const;

/** One move or enrolment, readable at a glance (owner request, 21 October 2026): who, the place
 *  they leave, the place they join, and, when the centre changes, a banner nobody can miss with
 *  both centres in large type. Every move and enrolment confirmation draws this. */
export function ChangeReview({ change, badge, subjectHidden = false }: {
  change: ReviewChange;
  /** In place of the kind's own tag, e.g. a Together card's level-change tag. */
  badge?: ReactNode;
  /** The caller already names the swimmer as a heading. */
  subjectHidden?: boolean;
}) {
  const side = SIDE[change.kind];
  const elsewhere = change.from.find((place) => place.centre !== change.to.centre);
  const transfer = !!elsewhere && change.kind === "move";
  return (
    <section aria-label={`What changes for ${change.subject}`} className="flex min-w-0 flex-col gap-4">
      <div className={cn("flex min-w-0 flex-wrap items-center gap-2", subjectHidden ? "justify-end" : "justify-between")}>
        {subjectHidden ? null : <p className="min-w-0 break-words text-2xl font-semibold">{change.subject}</p>}
        {badge ?? <Tag meta={KIND[change.kind]} />}
      </div>

      {elsewhere ? (
        <Notice
          tone="warning"
          icon={ArrowRightLeft}
          title={transfer ? "Transfer between centres" : "A different centre"}
          description={transfer
            ? `${change.subject} stops swimming at ${elsewhere.centre} and swims at ${change.to.centre} from today.`
            : `${change.subject} holds a place at ${elsewhere.centre}. This class is at ${change.to.centre}.`}
        >
          <p className="flex min-w-0 flex-col gap-1 text-xl font-semibold sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <span className="min-w-0 break-words"><span className="sr-only">From </span>{elsewhere.centre}</span>
            <ArrowDown aria-hidden="true" className="size-6 sm:hidden" />
            <ArrowRight aria-hidden="true" className="hidden size-6 sm:block" />
            <span className="min-w-0 break-words"><span className="sr-only">to </span>{change.to.centre}</span>
          </p>
        </Notice>
      ) : null}

      <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {change.from.length ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {change.from.map((place, index) => (
                <PlaceCard key={index} place={place} heading={side.from} when={side.fromWhen} bigCentre={!!elsewhere} />
              ))}
            </div>
            <ArrowDown aria-hidden="true" className="size-6 shrink-0 self-center text-ui-primary sm:hidden" />
            <ArrowRight aria-hidden="true" className="hidden size-6 shrink-0 text-ui-primary sm:block" />
          </>
        ) : null}
        <PlaceCard place={change.to} heading={side.to} when={side.toWhen} bigCentre={!!elsewhere} highlight />
      </div>

      {change.notes.length ? (
        <ul className="flex min-w-0 flex-col gap-1 text-sm">
          {change.notes.map((note) => (
            <li key={note} className="flex min-w-0 items-start gap-2">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ui-muted-foreground" />
              <span className="min-w-0 break-words">{note}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PlaceCard({ place, heading, when, bigCentre, highlight = false }: {
  place: ReviewPlace; heading: string; when: string; bigCentre: boolean; highlight?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-2 rounded-ui-lg border border-ui-border p-4", highlight && "border-2 border-ui-primary bg-ui-brand-soft")}>
      <p className="text-xs font-semibold uppercase text-ui-muted-foreground">
        {heading} <span className="font-normal normal-case">· {when}</span>
      </p>
      <p className="min-w-0 break-words text-lg font-semibold">{place.title}</p>
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
        <span className="min-w-0 break-words">{place.when}</span>
      </p>
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <Layers aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
        <span className="min-w-0 break-words">{place.level}</span>
      </p>
      <p className={cn("flex min-w-0 items-center gap-2", bigCentre ? "text-lg font-semibold" : "text-sm")}>
        <MapPin aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
        <span className="min-w-0 break-words">{place.centre}</span>
      </p>
    </div>
  );
}
