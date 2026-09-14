import Image from "next/image";
import { Expand } from "lucide-react";
import { screenshotHref, type HelpScreenshot } from "@/lib/help/screenshots";

export function GuideScreenshot({ screenshot }: { screenshot: HelpScreenshot }) {
  const src = screenshotHref(screenshot.id);
  return <figure className="mt-4 space-y-2 break-inside-avoid">
    <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`View full-size screenshot: ${screenshot.caption} (opens in a new tab)`} className="group block w-fit max-w-full overflow-hidden rounded-ui-lg border border-ui-border">
      <Image src={src} alt={screenshot.alt} width={screenshot.width} height={screenshot.height} unoptimized loading="eager" className="h-auto max-w-full" />
      <span className="flex min-h-11 items-center justify-center gap-2 bg-ui-muted px-3 py-2 text-sm font-medium text-ui-primary group-hover:underline print:hidden"><Expand aria-hidden="true" className="size-4" />View full size</span>
    </a>
    <figcaption className="text-xs leading-relaxed text-ui-muted-foreground">{screenshot.caption} <span className="block">Example data · light appearance shown.</span></figcaption>
  </figure>;
}
