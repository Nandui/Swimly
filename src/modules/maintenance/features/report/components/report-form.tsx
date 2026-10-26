"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { acceptFor, sizeLimit } from "@/lib/files";
import { reportProblem } from "@/modules/maintenance/features/report/server/actions";
import { openInArea } from "@/modules/maintenance/features/report/server/nearby";
import { uploadPhoto } from "@/modules/maintenance/shared/upload";
import { MAINTENANCE_STATUS_META, MAX_PHOTO_BYTES, MAX_PHOTOS, RISK_LABEL, RISKS, TRACKPLAN_ANSWERS, TRACKPLAN_LABEL, URGENCIES, MAINTENANCE_URGENCY_META, type Risk, type TrackplanAnswer, type Urgency } from "@/modules/maintenance/shared/types";

type Site = { id: string; name: string };
type Nearby = Awaited<ReturnType<typeof openInArea>>;
const RISK_HINT: Record<Risk, string> = { none: "It still works, or it is only a nuisance.", out_of_use: "Closed, fenced off or not working at all.", could_hurt: "A danger to anyone until it is made safe. Always Urgent." };

/** The report: where it is, what is broken, how bad, and whether the maintenance team already has
 *  it in Trackplan. Before sending it lists what is already open in that area, so the same problem
 *  is not reported twice. Photos go up once the report is saved. */
export function ReportForm({ sites, areas, start }: { sites: Site[]; areas: Record<string, string[]>; start: string }) {
  const router = useRouter();
  const [pending, begin] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ids = useRef({ id: crypto.randomUUID(), operationId: crypto.randomUUID() });
  const [f, setF] = useState({ siteId: start, area: "", place: "", title: "", details: "", urgency: "normal" as Urgency, risk: "none" as Risk, trackplan: "" as TrackplanAnswer | "", trackplanRef: "" });
  const [photos, setPhotos] = useState<File[]>([]);
  const [nearby, setNearby] = useState<Nearby>([]);
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((x) => ({ ...x, [key]: value }));
  const picker = useRef<HTMLInputElement>(null);
  const urgency = f.risk === "could_hurt" ? "urgent" : f.urgency;

  const asked = useRef(0);
  /** What is already open where the person is pointing; the latest question wins. */
  function lookNearby(siteId: string, area: string) {
    const ask = ++asked.current;
    if (!siteId || !area) { setNearby([]); return; }
    openInArea(siteId, area).then((rows) => { if (ask === asked.current) setNearby(rows); }, () => { if (ask === asked.current) setNearby([]); });
  }

  function choose(list: FileList | null) {
    const chosen = [...(list ?? [])];
    const tooBig = chosen.find((file) => file.size > MAX_PHOTO_BYTES);
    if (tooBig) setError(`${tooBig.name} is larger than ${sizeLimit(MAX_PHOTO_BYTES)}. Choose a smaller photo.`);
    setPhotos((now) => [...now, ...chosen.filter((file) => file.size <= MAX_PHOTO_BYTES)].slice(0, MAX_PHOTOS));
    if (picker.current) picker.current.value = "";
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (!f.siteId) return setError("Choose a site.");
    if (f.title.trim().length < 3) return setError("Say in a few words what is broken, such as ‘Shower 3 will not turn off’.");
    if (!f.trackplan) return setError("Say whether it is already in Trackplan. Choose Not sure if you don’t know.");
    begin(async () => {
      const result = await reportProblem({ ...ids.current, ...f, urgency, trackplan: f.trackplan as TrackplanAnswer });
      if (!result.ok) { setError(result.error); return; }
      const failed: string[] = [];
      for (const photo of photos) if (!(await uploadPhoto(result.id, photo)).ok) failed.push(photo.name);
      if (failed.length) toast.error(`Report sent, but ${failed.length === 1 ? "a photo" : `${failed.length} photos`} did not go up. Add ${failed.length === 1 ? "it" : "them"} again on the request.`);
      else toast.success("Report sent");
      router.push(`/maintenance/${result.id}`);
    });
  }

  if (!sites.length) return <Notice tone="warning" title="Your role cannot report maintenance problems at any site." description="Ask a Turnfin administrator to check the sites your role covers." />;
  const siteAreas = areas[f.siteId] ?? [];

  return (
    <form onSubmit={send} className="flex flex-col gap-(--space-7)" noValidate>
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-(--space-7)">
        <legend className="sr-only">The problem</legend>
        <section aria-labelledby="mnt-where" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="mnt-where">Where</h2></div>
          <div className="pc-panel grid gap-4 sm:grid-cols-2">
            {sites.length > 1 ? (
              <Field label="Site" htmlFor="mnt-site">
                <NativeSelect id="mnt-site" value={f.siteId} onChange={(e) => { setF((x) => ({ ...x, siteId: e.target.value, area: "" })); lookNearby(e.target.value, ""); }} required className="min-h-11 w-full">
                  <NativeSelectOption value="" disabled>Choose a site</NativeSelectOption>
                  {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
            ) : null}
            <Field label="Area" htmlFor="mnt-area" optional>
              <NativeSelect id="mnt-area" value={f.area} onChange={(e) => { set("area", e.target.value); lookNearby(f.siteId, e.target.value); }} className="min-h-11 w-full">
                <NativeSelectOption value="">{siteAreas.length ? "Not in one area" : "No areas listed for this site"}</NativeSelectOption>
                {siteAreas.map((a) => <NativeSelectOption key={a} value={a}>{a}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field label="Exactly where" htmlFor="mnt-place" hint="So someone who does not know the site can find it" optional>
              <Input id="mnt-place" value={f.place} onChange={(e) => set("place", e.target.value)} maxLength={200} placeholder="For example: third locker from the left" />
            </Field>
          </div>
        </section>

        {nearby.length ? (
          <Notice title="Already reported? Check these first" description={`Open in ${f.area}. If yours is one of them, there is no need to report it again.`}>
            <ul className="pc-list">
              {nearby.map((r) => (
                <li key={r.id}>
                  <Link href={`/maintenance/${r.id}`} className="pc-row" target="_blank" rel="noreferrer">
                    <span className="pc-row-body"><span className="pc-row-title">{r.title}</span><span className="pc-row-hint tabular-nums">{[r.number, r.place].filter(Boolean).join(" · ")}<span className="sr-only"> (opens in a new tab)</span></span></span>
                    <span className="pc-row-trail"><Tag meta={MAINTENANCE_STATUS_META[r.status]} /><ChevronRight aria-hidden="true" className="pc-row-chevron" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}

        <section aria-labelledby="mnt-what" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="mnt-what">What is broken</h2></div>
          <div className="pc-panel flex flex-col gap-4">
            <Field label="In a few words" htmlFor="mnt-title">
              <Input id="mnt-title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={160} required placeholder="For example: Shower 3 will not turn off" />
            </Field>
            <Field label="Anything else maintenance should know" htmlFor="mnt-details" optional>
              <Textarea id="mnt-details" value={f.details} onChange={(e) => set("details", e.target.value)} rows={3} maxLength={4000} />
            </Field>
          </div>
        </section>

        <section aria-labelledby="mnt-bad" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="mnt-bad">How bad</h2></div>
          <div className="pc-panel flex flex-col gap-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Is it out of use, or could it hurt someone?</legend>
              <RadioGroup value={f.risk} onValueChange={(v) => set("risk", v as Risk)} className="gap-2">
                {RISKS.map((r) => <ChoiceRow key={r} type="radio" id={`mnt-risk-${r}`} value={r} title={RISK_LABEL[r]} hint={RISK_HINT[r]} />)}
              </RadioGroup>
            </fieldset>
            <div className="space-y-2">
              <p id="mnt-urgency" className="text-sm font-semibold">How urgent</p>
              <SegmentedChoice aria-labelledby="mnt-urgency" aria-describedby={f.risk === "could_hurt" ? "mnt-urgency-locked" : undefined} fill="phone" value={urgency} onValueChange={(v) => set("urgency", v as Urgency)} disabled={f.risk === "could_hurt"}
                options={URGENCIES.map((u) => ({ value: u, label: MAINTENANCE_URGENCY_META[u].label }))} />
              {f.risk === "could_hurt" ? <p id="mnt-urgency-locked" className="text-sm text-ui-muted-foreground">Anything that could hurt someone is Urgent.</p> : null}
            </div>
          </div>
        </section>

        <section aria-labelledby="mnt-trackplan" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="mnt-trackplan">Trackplan</h2></div>
          <div className="pc-panel flex flex-col gap-4">
            <div className="space-y-2">
              <p id="mnt-in-trackplan" className="text-sm font-semibold">Is it already in Trackplan?</p>
              <p id="mnt-in-trackplan-hint" className="text-sm text-ui-muted-foreground">Trackplan is the maintenance team’s own system. If you don’t know, choose Not sure: a manager will check.</p>
              <SegmentedChoice aria-labelledby="mnt-in-trackplan" aria-describedby="mnt-in-trackplan-hint" fill="phone" value={f.trackplan} onValueChange={(v) => set("trackplan", v as TrackplanAnswer)}
                options={TRACKPLAN_ANSWERS.map((a) => ({ value: a, label: TRACKPLAN_LABEL[a] }))} />
            </div>
            {f.trackplan === "yes" ? (
              <Field label="Trackplan reference" htmlFor="mnt-ref" hint="The job number in Trackplan, if you have it" optional>
                <Input id="mnt-ref" value={f.trackplanRef} onChange={(e) => set("trackplanRef", e.target.value)} maxLength={60} autoComplete="off" />
              </Field>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="mnt-photos" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="mnt-photos">Photos</h2><p>{photos.length} of {MAX_PHOTOS}</p></div>
          <div className="pc-panel flex flex-col gap-3">
            <p className="text-sm text-ui-muted-foreground">Up to {MAX_PHOTOS} photos, {sizeLimit(MAX_PHOTO_BYTES)} each. Photos are kept without their location.</p>
            {photos.length ? (
              <ul className="flex flex-col gap-2">
                {photos.map((photo, i) => (
                  <li key={`${photo.name}:${i}`} className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm">{photo.name}</span>
                    <Button type="button" variant="ghost" className="min-h-11" onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /><span className="sr-only">Remove {photo.name}</span></Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="relative min-w-0">
              <Input ref={picker} id="mnt-photo-input" type="file" accept={acceptFor(["photo"])} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => choose(e.target.files)} />
              {photos.length < MAX_PHOTOS ? <Button type="button" variant="outline" className="min-h-11" onClick={() => picker.current?.click()}><Camera aria-hidden="true" />Add a photo</Button> : null}
            </div>
          </div>
        </section>
      </fieldset>

      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="min-h-11" disabled={pending}><Send aria-hidden="true" />{pending ? "Sending…" : "Send report"}</Button>
        <p className="text-sm text-ui-muted-foreground">The site’s managers see it straight away.</p>
      </div>
    </form>
  );
}
