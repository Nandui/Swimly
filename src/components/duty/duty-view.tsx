"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarX2, MapPin, RefreshCw, Search, Users } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shadcn/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/shadcn/dialog";
import { Item, ItemGroup, ItemContent } from "@/components/shadcn/item";
import { Tag } from "@/components/ui-kit/tag";
import { LoadingButton } from "@/components/ui/loading-button";
import { CANCELLATION_META } from "@/lib/cancellations/constants";
import { formatTime } from "@/lib/courses/constants";
import { formatDate, minutesNow, parseDateOnly, today } from "@/lib/format";
import { CALENDAR_PHASE_META, classPhase } from "@/lib/today/calendar";
import type { DutyClass } from "@/lib/duty/data";
import { CancelSession } from "./cancel-session";

export function DutyView({ courses, iso, clubName, initialNow, canCancel, canBilling, pendingBilling }: {
  courses: DutyClass[]; iso: string; clubName: string; initialNow: number; canCancel: boolean; canBilling: boolean; pendingBilling: number;
}) {
  const [query, setQuery] = useState(""), [tab, setTab] = useState("all"), [now, setNow] = useState(initialNow), [staleDate, setStaleDate] = useState(false);
  const [refreshing, startRefresh] = useTransition(), router = useRouter(), searchId = useId();
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== "visible") return;
      const instant = new Date(); setNow(minutesNow(instant)); setStaleDate(today(instant) !== iso);
      if (!document.querySelector('[role="dialog"]')) router.refresh();
    };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [iso, router]);
  const running = courses.filter(c => !c.cancellation && classPhase(c, now) === "running").length;
  const upcoming = courses.filter(c => !c.cancellation && classPhase(c, now) === "later").length;
  const cancelled = courses.filter(c => c.cancellation).length;
  const shown = courses.filter(c => {
    const search = [c.name, c.level, c.programme, c.location, c.instructor, formatTime(c.startMinutes)].join(" ").toLowerCase();
    return search.includes(query.trim().toLowerCase()) && (tab === "all" || (tab === "cancelled" ? !!c.cancellation : !c.cancellation && classPhase(c, now) === tab));
  });
  return <div className="flex min-w-0 flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">Duty manager</h1><p className="text-sm text-ui-muted-foreground">{formatDate(parseDateOnly(iso))} · {clubName}</p><p className="text-sm text-ui-muted-foreground">Today’s classes, at a glance.</p></div>
      <div className="flex flex-wrap gap-2"><LoadingButton variant="outline" className="min-h-11" pending={refreshing} pendingLabel="Refreshing…" onClick={() => startRefresh(() => router.refresh())}><RefreshCw aria-hidden="true" />Refresh</LoadingButton>{canBilling ? <Button asChild className="min-h-11" variant="outline"><Link href="/cancellations"><CalendarX2 aria-hidden="true" />Billing follow-up{pendingBilling > 0 ? ` (${pendingBilling})` : ""}</Link></Button> : null}</div>
    </header>
    {staleDate ? <p role="alert" className="rounded-ui-md border border-ui-border p-4">A new day has started. Refresh before cancelling a session.</p> : null}
    <Tabs value={tab} onValueChange={setTab} className="gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4"><TabsList className="grid w-full grid-cols-2 gap-1 group-data-[orientation=horizontal]/tabs:h-auto sm:inline-flex sm:w-auto sm:flex-wrap" aria-label="Filter today’s classes">
        <TabsTrigger value="all" className="min-h-11">All {courses.length}</TabsTrigger><TabsTrigger value="running" className="min-h-11">On now {running}</TabsTrigger><TabsTrigger value="later" className="min-h-11">Upcoming {upcoming}</TabsTrigger><TabsTrigger value="cancelled" className="min-h-11">Cancelled {cancelled}</TabsTrigger>
      </TabsList><div className="w-full space-y-2 sm:max-w-sm"><Label htmlFor={searchId}>Find a class</Label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-ui-muted-foreground" /><Input id={searchId} value={query} onChange={e => setQuery(e.target.value)} className="min-h-11 pl-9" placeholder="Class, instructor, pool or time" /></div></div></div>
      <TabsContent value={tab} className="m-0"><p className="mb-2 text-sm text-ui-muted-foreground" role="status">{shown.length} {shown.length === 1 ? "class" : "classes"}</p>
        {shown.length ? <ItemGroup className="divide-y divide-ui-border border-y border-ui-border">{shown.map(course => {
          const phase = classPhase(course, now), meta = course.cancellation ? CANCELLATION_META.cancelled : CALENDAR_PHASE_META[phase];
          return <Item key={course.id} role="listitem" className="flex-wrap rounded-none border-x-0 border-t-0 border-ui-border px-0 py-4 last:border-b-0 sm:gap-5"><div className="w-20 shrink-0"><p className="text-lg font-semibold tabular-nums">{formatTime(course.startMinutes)}</p><p className="text-sm tabular-nums text-ui-muted-foreground">{formatTime(course.startMinutes + course.durationMinutes)}</p></div>
            <ItemContent className="min-w-0 basis-44"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{course.name}</h2><Tag color={meta.color}>{meta.label}</Tag></div><p className="text-sm text-ui-muted-foreground">{course.programme}{course.name !== course.level ? ` · ${course.level}` : ""}</p><p className="text-sm">{course.instructor ?? "No instructor assigned"}</p><div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ui-muted-foreground"><span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{course.location || "Pool area not set"}</span><span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden="true" />{course.swimmers.length}{course.capacity === null ? "" : `/${course.capacity}`} swimmers</span></div></ItemContent>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto"><QuickView course={course} iso={iso} />{canCancel && !course.cancellation ? <CancelSession course={course} date={iso} disabled={staleDate} /> : null}</div>
          </Item>;
        })}</ItemGroup> : <div className="rounded-ui-lg border border-dashed border-ui-border p-8 text-center"><h2 className="font-semibold">{courses.length ? "No classes match" : "No classes scheduled today"}</h2><p className="mt-1 text-sm text-ui-muted-foreground">{courses.length ? "Try another search or show the full day." : "The next day’s classes will appear when the day starts."}</p>{courses.length ? <Button className="mt-4 min-h-11" variant="outline" onClick={() => { setQuery(""); setTab("all"); }}>Show all classes</Button> : null}</div>}
      </TabsContent>
    </Tabs>
  </div>;
}

function QuickView({ course, iso }: { course: DutyClass; iso: string }) {
  return <Dialog><DialogTrigger asChild><Button variant="secondary" className="min-h-11" aria-label={`Quick view: ${course.name}, ${formatTime(course.startMinutes)}`}>Quick view</Button></DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={false}>
    <DialogHeader><DialogTitle>{course.name}</DialogTitle><DialogDescription>{formatDate(parseDateOnly(iso))} · {formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)} · {course.location || "Pool area not set"}</DialogDescription></DialogHeader>
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-ui-muted-foreground">Instructor</dt><dd>{course.instructor || "Not assigned"}</dd></div><div><dt className="text-ui-muted-foreground">Attendance</dt><dd>{course.attendanceRecorded ? `${course.attendanceRecorded} recorded` : "Not recorded"}</dd></div></dl>
    {course.cancellation ? <div className="space-y-2"><Tag color={CANCELLATION_META.cancelled.color}>Cancelled</Tag><p className="text-sm whitespace-pre-wrap break-words">{course.cancellation.reason}</p></div> : null}
    <section><h3 className="mb-2 text-sm font-semibold">{course.cancellation ? "Affected swimmers" : "Swimmers"} · {course.swimmers.length}</h3><ul className="divide-y divide-ui-border">{course.swimmers.map(swimmer => <li key={swimmer.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{swimmer.name}</span><span className="text-ui-muted-foreground">{swimmer.memberNumber || "No member number"}</span></li>)}</ul>{!course.swimmers.length ? <p className="text-sm text-ui-muted-foreground">No swimmers enrolled for this session.</p> : null}</section>
    <DialogFooter><DialogClose asChild><Button variant="outline" className="min-h-11">Close</Button></DialogClose></DialogFooter>
  </DialogContent></Dialog>;
}
