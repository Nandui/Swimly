"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Frame } from "@/components/frame";
import { useLiveBanner } from "@/components/ui-kit/live-banner";
import { LoadError, Loading, Notice, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { clock, date } from "@/lib/format";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const MODES = [
  { value: "any", label: "Any time" },
  { value: "between", label: "Between two times" },
  { value: "none", label: "Can't work" },
];
type Mode = "any" | "between" | "none";
type Day = { mode: Mode; start: number | null; end: number | null };
type Week = { said: boolean; days: Day[]; updatedAt: string | null };

/** "16:30" from a time field to minutes after midnight, or null while it is empty. */
function minutesOf(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** When you can usually work (D34): for each weekday, any time, between two times, or not at all.
 *  It goes to whoever plans your shifts as a guide; they still decide. Sending again replaces it. */
export default function AvailabilityPage() {
  const { data, setData, error, reload } = useLoad<Week>("availability");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const banner = useLiveBanner();
  const set = (index: number, change: Partial<Day>) => {
    if (data) setData({ ...data, days: data.days.map((d, i) => (i === index ? { ...d, ...change } : d)) });
    setProblem(null);
  };

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const wrong = data.days.findIndex((d) => d.mode === "between" && (d.start === null || d.end === null || d.end <= d.start));
    if (wrong >= 0) { setProblem(`${WEEKDAYS[wrong]}: give a start, and an end after it.`); return; }
    setBusy(true); setProblem(null);
    try {
      setData(await api<Week>("availability", { method: "PUT", body: { days: data.days.map((d) => (d.mode === "between" ? d : { mode: d.mode, start: null, end: null })) } }));
      banner("Sent", "Whoever plans your shifts can see it now");
    } catch (caught) { setProblem(caught instanceof ApiError ? caught.message : "That didn't send. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <Frame title="When I can work">
      <PageShell spacing="roomy" header={<PageHeader back={{ href: "/more", label: "More" }} title="When I can work" description="The times you can usually work each week. It guides whoever plans your shifts; they still decide, and may ask you to work outside it." />}>
        {error?.code === "NOT_AVAILABLE" ? <Notice title="Your centre doesn't ask for this yet">Tell your manager when you can work, as you do now.</Notice>
          : error ? <LoadError error={error} retry={reload} /> : !data ? <Loading rows={7} /> : (
            <>
              {data.said && data.updatedAt ? <Notice title={`Sent ${date(data.updatedAt)}`}>Change it here whenever your week changes, such as a new timetable.</Notice>
                : <Notice title="You haven't said yet">Until you do, your planner takes it that any time suits.</Notice>}
              <form onSubmit={send} className="stack" aria-label="When I can work">
                <fieldset disabled={busy} className="stack">
                  <legend className="sr-only">Each day of the week</legend>
                  <div className="pc-panel">
                    {data.days.map((d, i) => (
                      <div key={WEEKDAYS[i]} className="stack-sm">
                        <Select id={`mode-${i}`} label={WEEKDAYS[i]} options={MODES} value={d.mode}
                          onValueChange={(mode) => set(i, { mode: mode as Mode, ...(mode === "between" ? { start: d.start ?? 9 * 60, end: d.end ?? 17 * 60 } : {}) })} />
                        {d.mode === "between" ? (
                          <div className="grid grid-cols-2 gap-4">
                            <Input id={`start-${i}`} type="time" step={300} required aria-label={`${WEEKDAYS[i]}, from`} value={d.start === null ? "" : clock(d.start)} onChange={(v) => set(i, { start: minutesOf(v) })} />
                            <Input id={`end-${i}`} type="time" step={300} required aria-label={`${WEEKDAYS[i]}, to`} value={d.end === null ? "" : clock(d.end)} onChange={(v) => set(i, { end: minutesOf(v) })} />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {problem ? <Notice title={problem} tone="error" live /> : null}
                  <Button type="submit" className="self-start max-md:self-stretch"><Send aria-hidden="true" />{data.said ? "Send changes" : "Send"}</Button>
                </fieldset>
              </form>
            </>
          )}
      </PageShell>
    </Frame>
  );
}
