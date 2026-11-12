"use client";

import { useEffect, useState } from "react";

/** The minute of the day on this device, kept current, when `today` (else null): where the Plan
 *  draws its now line and what "Who's where" starts on. Read after mounting, because the server's
 *  clock and time zone are not the viewer's. */
export function useNowMinute(today: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!today) return;
    const tick = () => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()); };
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(every); setNow(null); };
  }, [today]);
  return today ? now : null;
}
