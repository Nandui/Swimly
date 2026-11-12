"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarX2, Eye, Merge, RefreshCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shadcn/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/shadcn/dialog";
import { Tag } from "@/components/ui-kit/tag";
import { LoadingButton } from "@/components/ui/loading-button";
import { HOME_SESSION_META } from "@/lib/home-meta";
import { formatDate, formatDay, formatTime, formatTimeRange, minutesNow, parseDateOnly, plural, today } from "@/lib/format";
import { classPhase, sessionState } from "@/modules/activities/shared/today/calendar";
import type { DutyClass } from "@/modules/activities/features/duty/server/data";
import { CancelSession } from "@/modules/activities/features/duty/components/cancel-session";
import { MergeSession, UndoMerge } from "@/modules/activities/features/duty/components/merge-session";
import { MERGE_META } from "@/modules/activities/shared/merges/constants";

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
  // A class merged into another today runs as part of that one, so it is "off" like a cancelled one.
  const off = (c: DutyClass) => !!c.cancellation || !!c.mergedInto;
  const running = courses.filter(c => !off(c) && classPhase(c, now) === "running").length;
  const upcoming = courses.filter(c => !off(c) && classPhase(c, now) === "later").length;
  const cancelled = courses.filter(c => c.cancellation).length;
  const merged = courses.filter(c => c.mergedInto).length;
  const shown = courses.filter(c => {
    const search = [c.name, c.level, c.programme, c.location, c.instructor, formatTime(c.startMinutes)].join(" ").toLowerCase();
    return search.includes(query.trim().toLowerCase()) && (tab === "all" || (tab === "cancelled" ? !!c.cancellation : tab === "merged" ? !!c.mergedInto : !off(c) && classPhase(c, now) === tab));
  });
  return <PageShell spacing="roomy" header={<PageHeader title="Duty manager" description={`${formatDay(iso)} · ${clubName} · Today’s classes, at a glance`} actions={<>
      <LoadingButton variant="outline" pending={refreshing} pendingLabel="Refreshing…" onClick={() => startRefresh(() => router.refresh())}><RefreshCw aria-hidden="true" />Refresh</LoadingButton>
      {canCancel ? <Button asChild variant="outline"><Link href="/duty/merged"><Merge aria-hidden="true" />Merged classes</Link></Button> : null}
      {canBilling ? <Button asChild variant="outline"><Link href="/cancellations" aria-label={pendingBilling > 0 ? `Cancelled classes, ${pendingBilling} awaiting billing` : undefined}><CalendarX2 aria-hidden="true" />Cancelled classes{pendingBilling > 0 ? ` (${pendingBilling})` : ""}</Link></Button> : null}
    </>} />}>
    {staleDate ? <Notice tone="warning" title="A new day has started. Refresh before cancelling or merging a session." /> : null}
    <section className="flex min-w-0 flex-col" aria-label="Today’s classes">
      <Tabs value={tab} onValueChange={setTab} className="gap-(--space-5)">
        <div className="flex flex-wrap items-end gap-3">
          <TabsList aria-label="Filter today’s classes">
            <TabsTrigger value="all">All <span className="font-normal tabular-nums">{courses.length}</span></TabsTrigger>
            <TabsTrigger value="running">{HOME_SESSION_META.now.label} <span className="font-normal tabular-nums">{running}</span></TabsTrigger>
            <TabsTrigger value="later">{HOME_SESSION_META.next.label} <span className="font-normal tabular-nums">{upcoming}</span></TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled <span className="font-normal tabular-nums">{cancelled}</span></TabsTrigger>
            <TabsTrigger value="merged">Merged <span className="font-normal tabular-nums">{merged}</span></TabsTrigger>
          </TabsList>
          <SearchField label="Find a class" value={query} onValueChange={setQuery} placeholder="Class, instructor, pool or time" className="grow basis-72 sm:max-w-md" />
        </div>
        <TabsContent value={tab} className="m-0 flex flex-col"><div className="pc-section-head"><h2>{tab === "all" ? "Today" : tab === "cancelled" ? "Cancelled" : tab === "merged" ? "Merged" : tab === "running" ? HOME_SESSION_META.now.label : HOME_SESSION_META.next.label}</h2><p role="status">{plural(shown.length, "class", "classes")}</p></div>
          {shown.length ? <ul className="pc-list">{shown.map(course => {
            const state = sessionState(course, now), meta = HOME_SESSION_META[state], time = formatTime(course.startMinutes);
            const count = course.capacity === null ? plural(course.swimmers.length, "swimmer") : `${course.swimmers.length}/${course.capacity} swimmers`;
            const joined = course.joined.reduce((n, j) => n + j.swimmers, 0);
            const hint = [`${course.programme}${course.name !== course.level ? ` · ${course.level}` : ""}`, course.instructor ?? "No instructor assigned", course.location || "Pool area not set",
              course.cancellation ? course.cancellation.reason : course.mergedInto ? `Merged into ${course.mergedInto.name} at ${formatTime(course.mergedInto.startMinutes)}: ${course.mergedInto.reason}` : count,
              course.joined.length ? `+${plural(joined, "swimmer")} from ${course.joined.map(j => `${j.name} ${formatTime(j.startMinutes)}`).join(", ")}` : null].filter(Boolean);
            return <li key={course.id} className="pc-row">
              <span className="w-14 shrink-0 font-semibold tabular-nums">{time}<span className="block text-xs font-normal text-ui-muted-foreground">to {formatTime(course.startMinutes + course.durationMinutes)}</span></span>
              <div className="pc-row-body"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="font-semibold">{course.name}</h3><Tag meta={course.mergedInto ? MERGE_META.away : meta} />{course.joined.length ? <Tag meta={MERGE_META.host} /> : null}</div><p className="pc-row-hint break-words">{hint.join(" · ")}</p></div>
              <div className="pc-row-trail"><QuickView course={course} iso={iso} />{canCancel && course.mergedInto ? <UndoMerge course={course} disabled={staleDate} /> : null}{canCancel && !course.cancellation && !course.mergedInto ? <><MergeSession course={course} courses={courses} date={iso} disabled={staleDate} /><CancelSession course={course} date={iso} disabled={staleDate || course.joined.length > 0} /></> : null}</div>
            </li>;
          })}</ul> : <EmptyState title={courses.length ? "No classes match" : "No classes scheduled today"} hint={courses.length ? "Try another search or show the full day." : "The next day’s classes will appear when the day starts."} action={courses.length ? <Button variant="outline" onClick={() => { setQuery(""); setTab("all"); }}>Show all classes</Button> : undefined} />}
        </TabsContent>
      </Tabs>
    </section>
  </PageShell>;
}

function QuickView({ course, iso }: { course: DutyClass; iso: string }) {
  return <Dialog><DialogTrigger asChild><Button variant="outline" aria-label={`Quick view: ${course.name}, ${formatTime(course.startMinutes)}`}><Eye aria-hidden="true" /><span className="pc-only-wide">Quick view</span></Button></DialogTrigger><DialogContent className="max-h-(--overlay-max-height) overflow-y-auto" showCloseButton={false}>
    <DialogHeader><DialogTitle>{course.name}</DialogTitle><DialogDescription>{formatDate(parseDateOnly(iso))} · {formatTimeRange(course.startMinutes, course.startMinutes + course.durationMinutes)} · {course.location || "Pool area not set"}</DialogDescription></DialogHeader>
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-ui-muted-foreground">Instructor</dt><dd>{course.instructor || "Not assigned"}</dd></div><div><dt className="text-ui-muted-foreground">Attendance</dt><dd>{course.attendanceRecorded ? `${course.attendanceRecorded} recorded` : "Not recorded"}</dd></div></dl>
    {course.cancellation ? <div className="space-y-2"><Tag meta={HOME_SESSION_META.off} /><p className="text-sm whitespace-pre-wrap break-words">{course.cancellation.reason}</p></div> : null}
    {course.mergedInto ? <div className="space-y-2"><Tag meta={MERGE_META.away} /><p className="text-sm break-words">Joined {course.mergedInto.name} at {formatTime(course.mergedInto.startMinutes)} today: {course.mergedInto.reason}</p></div> : null}
    {course.joined.length ? <div className="space-y-2"><Tag meta={MERGE_META.host} /><p className="text-sm break-words">Also teaching today: {course.joined.map(j => `${j.name} at ${formatTime(j.startMinutes)} (${plural(j.swimmers, "swimmer")})`).join(", ")}.</p></div> : null}
    <section><h3 className="mb-2 text-sm font-semibold">{course.cancellation ? "Affected swimmers" : "Swimmers"} · {course.swimmers.length}</h3><ul className="pc-rows">{course.swimmers.map(swimmer => <li key={swimmer.id} className="pc-row"><div className="pc-row-body"><span className="pc-row-title">{swimmer.name}</span>{swimmer.memberNumber ? <span className="pc-row-hint">#{swimmer.memberNumber}</span> : null}</div></li>)}</ul>{!course.swimmers.length ? <p className="text-sm text-ui-muted-foreground">No swimmers enrolled for this session.</p> : null}</section>
    <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
  </DialogContent></Dialog>;
}
