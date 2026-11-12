"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { clockNow } from "@/lib/format";

/** How long a banner stays expanded (DESIGN.md, `duration-banner`), then how long its compact tick
 *  and time stay before it goes. */
const EXPANDED_MS = 3200;
const COMPACT_MS = 8000;

type Banner = { title: string; detail?: string; at: string };
const ShowBanner = createContext<(title: string, detail?: string) => void>(() => {});

/** Confirmations on the phone (DESIGN.md, LiveBanner): a black banner grows at the top centre with
 *  a green tick, the sentence and one line more, then settles to a compact tick and the time.
 *  Tapping it expands it again. It is `role="status"`, so the whole sentence is read once. Errors
 *  never come here: they stay where they happened. */
export function LiveBannerProvider({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [expanded, setExpanded] = useState(false);
  const timers = useRef<number[]>([]);
  const clear = useCallback(() => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; }, []);
  const settle = useCallback(() => {
    clear();
    timers.current = [
      window.setTimeout(() => setExpanded(false), EXPANDED_MS),
      window.setTimeout(() => setBanner(null), EXPANDED_MS + COMPACT_MS),
    ];
  }, [clear]);
  const show = useCallback((title: string, detail?: string) => {
    setBanner({ title, detail, at: clockNow() });
    setExpanded(true);
    settle();
  }, [settle]);
  useEffect(() => clear, [clear]);
  return (
    <ShowBanner value={show}>
      {children}
      <div className="live-banner-slot" role="status" aria-live="polite">
        {banner ? (
          <Button type="button" variant="ghost" className="live-banner" data-expanded={expanded ? "" : undefined}
            aria-label={`${banner.title}${banner.detail ? `. ${banner.detail}` : ""}, ${banner.at}`}
            onClick={() => { setExpanded(true); settle(); }}>
            <span className="live-banner-tick" aria-hidden="true"><Check /></span>
            {expanded ? (
              <span className="live-banner-text">
                <span className="live-banner-title">{banner.title}</span>
                {banner.detail ? <span className="live-banner-detail">{banner.detail}</span> : null}
              </span>
            ) : <span className="live-banner-time">{banner.at}</span>}
          </Button>
        ) : null}
      </div>
    </ShowBanner>
  );
}

/** Shows a confirmation: `banner("Sent", "The office will check it")`. */
export function useLiveBanner() {
  return useContext(ShowBanner);
}
