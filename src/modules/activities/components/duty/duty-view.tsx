"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarX2, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shadcn/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/shadcn/dialog";
import { Tag } from "@/components/ui-kit/tag";
import { LoadingButton } from "@/components/ui/loading-button";
import { HOME_SESSION_META } from "@/lib/home-meta";
import { formatDate, formatDay, formatTime, formatTimeRange, minutesNow, parseDateOnly, plural, today } from "@/lib/format";
import { classPhase, sessionState } from "@/modules/activities/lib/today/calendar";
import type { DutyClass } from "@/modules/activities/lib/duty/data";
import { CancelSession } from "./cancel-session";

export function DutyView({ courses, iso, clubName, initialNow, canCancel, canBilling, pendingBilling }: {
  courses: DutyClass[]; iso: string; clubName: string; initialNow: number; canCancel: boolean; canBilling: boolean; pendingBilling: number;
}) {
  const [query, setQuery] = useState(""), [tab, setTab] = useState("all"), [now, setNow] = useState(initialNow), [staleDate, setStaleDate] = useState(false);
  const [refreshing, startRefresh] = useTransition(), router = useRouter();
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
    <PageHeader title="Duty manager" description={`${formatDay(iso)} · ${clubName} · Today’s classes, at a glance`} actions={<>
      <LoadingButton variant="outline" pending={refreshing} pendingLabel="Refreshing…" onClick={() => startRefresh(() => router.refresh())}><RefreshCw aria-hidden="true" />Refresh</LoadingButton>
      {canBilling ? <Button asChild variant="outline"><Link href="/cancellations" aria-label={pendingBilling > 0 ? `Cancelled classes, ${pendingBilling} awaiting billing` : undefined}><CalendarX2 aria-hidden="true" />Cancelled classes{pendingBilling > 0 ? ` (${pendingBilling})` : ""}</Link></Button> : null}
    </>} />
    {staleDate ? <Notice tone="warning" title="A new day has started. Refresh before cancelling a session." /> : null}
    <section className="pc-panel" aria-label="Today’s classes">
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <TabsList aria-label="Filter today’s classes">
            <TabsTrigger value="all">All <span className="pc-seg-count tabular-nums">{courses.length}</span></TabsTrigger>
            <TabsTrigger value="running">{HOME_SESSION_META.now.label} <span className="pc-seg-count tabular-nums">{running}</span></TabsTrigger>
            <TabsTrigger value="later">{HOME_SESSION_META.next.label} <span className="pc-seg-count tabular-nums">{upcoming}</span></TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled <span className="pc-seg-count tabular-nums">{cancelled}</span></TabsTrigger>
          </TabsList>
          <SearchField label="Find a class" value={query} onValueChange={setQuery} placeholder="Class, instructor, pool or time" className="grow basis-72 sm:max-w-md" />
        </div>
        <TabsContent value={tab} className="m-0 flex flex-col gap-3"><p className="text-xs text-ui-muted-foreground" role="status">{plural(shown.length, "class", "classes")}</p>
          {shown.length ? <ul className="pc-rows">{shown.map(course => {
            const state = sessionState(course, now), meta = HOME_SESSION_META[state], time = formatTime(course.startMinutes);
            const count = course.capacity === null ? plural(course.swimmers.length, "swimmer") : `${course.swimmers.length}/${course.capacity} swimmers`;
            const hint = [`${course.programme}${course.name !== course.level ? ` · ${course.level}` : ""}`, course.instructor ?? "No instructor assigned", course.location || "Pool area not set", course.cancellation ? course.cancellation.reason : count];
            return <li key={course.id} className="pc-row">
              <span className="pc-block shrink-0" data-state={state}><span className="pc-block-time">{time}<small>to {formatTime(course.startMinutes + course.durationMinutes)}</small></span></span>
              <div className="pc-row-body"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h2 className="text-sm font-semibold">{course.name}</h2><Tag meta={meta} /></div><p className="pc-row-hint break-words">{hint.join(" · ")}</p></div>
              <div className="pc-row-trail"><QuickView course={course} iso={iso} />{canCancel && !course.cancellation ? <CancelSession course={course} date={iso} disabled={staleDate} /> : null}</div>
            </li>;
          })}</ul> : <EmptyState title={courses.length ? "No classes match" : "No classes scheduled today"} hint={courses.length ? "Try another search or show the full day." : "The next day’s classes will appear when the day starts."} action={courses.length ? <Button variant="outline" onClick={() => { setQuery(""); setTab("all"); }}>Show all classes</Button> : undefined} />}
        </TabsContent>
      </Tabs>
    </section>
  </div>;
}

function QuickView({ course, iso }: { course: DutyClass; iso: string }) {
  return <Dialog><DialogTrigger asChild><Button variant="outline" aria-label={`Quick view: ${course.name}, ${formatTime(course.startMinutes)}`}><Eye aria-hidden="true" /><span className="pc-only-wide">Quick view</span></Button></DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={false}>
    <DialogHeader><DialogTitle>{course.name}</DialogTitle><DialogDescription>{formatDate(parseDateOnly(iso))} · {formatTimeRange(course.startMinutes, course.startMinutes + course.durationMinutes)} · {course.location || "Pool area not set"}</DialogDescription></DialogHeader>
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-ui-muted-foreground">Instructor</dt><dd>{course.instructor || "Not assigned"}</dd></div><div><dt className="text-ui-muted-foreground">Attendance</dt><dd>{course.attendanceRecorded ? `${course.attendanceRecorded} recorded` : "Not recorded"}</dd></div></dl>
    {course.cancellation ? <div className="space-y-2"><Tag meta={HOME_SESSION_META.off} /><p className="text-sm whitespace-pre-wrap break-words">{course.cancellation.reason}</p></div> : null}
    <section><h3 className="mb-2 text-sm font-semibold">{course.cancellation ? "Affected swimmers" : "Swimmers"} · {course.swimmers.length}</h3><ul className="divide-y divide-ui-border">{course.swimmers.map(swimmer => <li key={swimmer.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{swimmer.name}</span><span className="text-ui-muted-foreground">{swimmer.memberNumber || "No member number"}</span></li>)}</ul>{!course.swimmers.length ? <p className="text-sm text-ui-muted-foreground">No swimmers enrolled for this session.</p> : null}</section>
    <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
  </DialogContent></Dialog>;
}
