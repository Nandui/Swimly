import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
/** Profile and remove links are siblings, so each has one unambiguous action. */
export function SelectedSwimmer({
  id,
  name,
  levelName,
  removeHref,
}: {
  id: string;
  name: string;
  levelName: string | null;
  removeHref: string;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-1 rounded-ui-lg border border-ui-border bg-ui-muted pl-3">
      <Link
        href={`/students/${id}`}
        className="inline-flex min-h-11 min-w-0 items-center text-sm hover:underline"
      >
        {name} · {levelName ?? "no level"}
      </Link>
      <Button asChild variant="ghost" size="icon">
        <Link href={removeHref} aria-label={`Remove ${name} from this group`}>
          <X aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
