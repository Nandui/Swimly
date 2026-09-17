"use client";

import { useId, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/ui/textarea";
import { DAY_META, DAYS_IN_ORDER, courseName, formatTime, formatTimeRange, placesLeft } from "@/lib/courses/constants";
import { ALL_CLASSES, filterClassChoices, type ClassPickerFilters } from "@/lib/enrolment/class-picker";
import type { StudentEnrolment, TransferTarget } from "@/lib/enrolment/data/enrolments";
import type { ActionResult, ConfirmationReply } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { ProfileActionDialog } from "./profile-action-dialog";
import { LegendAgreementField } from "@/components/enrolment/legend-agreement-field";

function ClassFilter({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: React.ReactNode;
}) {
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={label} className="min-h-11 w-full min-w-0">
      <span className="min-w-0 truncate">{label}: <SelectValue /></span>
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>;
}

const rowLayout = "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 md:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] md:items-center";

function ClassPicker({ courses, name, selectedId, onSelect, currentEnrolment }: {
  courses: TransferTarget[]; name: string; selectedId: string; onSelect: (id: string) => void;
  currentEnrolment?: StudentEnrolment;
}) {
  const id = useId();
  const initialLevel = currentEnrolment?.level.id ?? "all";
  const [filters, setFilters] = useState<ClassPickerFilters>({ ...ALL_CLASSES, level: initialLevel });
  const sites = Array.from(new Map([
    ...(currentEnrolment ? [[currentEnrolment.course.club.id, currentEnrolment.course.club] as const] : []),
    ...courses.map(course => [course.club.id, course.club] as const),
  ]).values()).sort((a, b) => a.name.localeCompare(b.name));
  const levels = Array.from(new Map([
    ...(currentEnrolment ? [[currentEnrolment.level.id, currentEnrolment.level] as const] : []),
    ...courses.map(course => [course.level.id, course.level] as const),
  ]).values()).sort((a, b) => a.name.localeCompare(b.name));
  const times = Array.from(new Set(courses.map(course => course.startMinutes))).sort((a, b) => a - b);
  const matches = filterClassChoices(courses, filters);
  const selectionOutsideFilters = !!selectedId && !matches.some(course => course.id === selectedId);
  function setFilter<K extends keyof ClassPickerFilters>(key: K, value: ClassPickerFilters[K]) {
    setFilters(previous => ({ ...previous, [key]: value }));
  }
  const hasFilters = filters.site !== "all" || filters.level !== "all" || filters.day !== "all" ||
    filters.time !== "all" || !!filters.search || filters.availableOnly;

  return <div className="space-y-4">
    {currentEnrolment ? <div className="space-y-1 rounded-ui-md bg-ui-muted p-3 text-sm">
      <p className="text-xs font-medium text-ui-muted-foreground">{currentEnrolment.status === "WAITLISTED" ? "Current waitlist class" : "Current class"}</p>
      <p className="leading-relaxed"><strong className="font-semibold">{courseName(currentEnrolment.course)}</strong>
        {` · ${DAY_META[currentEnrolment.course.dayOfWeek].label} ${formatTimeRange(currentEnrolment.course)} · ${currentEnrolment.course.club.name}`}</p>
    </div> : null}

    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-sm font-medium">Site</legend>
      <div className="flex flex-wrap gap-1 rounded-ui-md bg-ui-muted p-1">
        {[{ id: "all", name: "All sites" }, ...sites].map(site => <Button key={site.id} type="button" variant="ghost"
          aria-pressed={filters.site === site.id} onClick={() => setFilter("site", site.id)}
          className={cn("h-auto min-h-11 min-w-0 flex-1 whitespace-normal px-3 py-2 md:flex-none", filters.site === site.id && "bg-ui-background text-ui-foreground shadow-xs hover:bg-ui-background")}>
          {site.name}
        </Button>)}
      </div>
    </fieldset>

    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
      <div className="relative sm:col-span-3 lg:col-span-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ui-muted-foreground" aria-hidden="true" />
        <Input type="search" aria-label="Search classes" placeholder="Search classes…" value={filters.search}
          onChange={event => setFilter("search", event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} className="min-h-11 pl-9" />
      </div>
      <ClassFilter label="Level" value={filters.level} onChange={value => setFilter("level", value)}>
        <SelectItem value="all" className="min-h-11">All levels</SelectItem>
        {levels.map(level => <SelectItem key={level.id} value={level.id} className="min-h-11">{level.name}</SelectItem>)}
      </ClassFilter>
      <ClassFilter label="Day" value={filters.day} onChange={value => setFilter("day", value)}>
        <SelectItem value="all" className="min-h-11">Any day</SelectItem>
        {DAYS_IN_ORDER.map(day => <SelectItem key={day} value={day} className="min-h-11">{DAY_META[day].label}</SelectItem>)}
      </ClassFilter>
      <ClassFilter label="Time" value={filters.time} onChange={value => setFilter("time", value)}>
        <SelectItem value="all" className="min-h-11">Any time</SelectItem>
        {times.map(time => <SelectItem key={time} value={String(time)} className="min-h-11">{formatTime(time)}</SelectItem>)}
      </ClassFilter>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
      <p role="status" aria-live="polite">{matches.length} {matches.length === 1 ? "class" : "classes"}{filters.availableOnly ? " with available places" : " found"}</p>
      <Label htmlFor={`${id}-available`} className="min-h-11 cursor-pointer font-normal">
        <Checkbox id={`${id}-available`} checked={filters.availableOnly} onCheckedChange={value => setFilter("availableOnly", value === true)} />
        Available places only
      </Label>
    </div>
    {selectionOutsideFilters ? <p className="text-sm text-ui-muted-foreground">Your selected class is outside these filters. It is still shown below.</p> : null}

    <div className="overflow-hidden rounded-ui-md border border-ui-border">
      <div aria-hidden="true" className={cn(rowLayout, "hidden bg-ui-muted px-3 py-3 text-xs font-medium text-ui-muted-foreground md:grid")}>
        <span className="size-4" /><span>Class</span><span>Site</span><span>Day</span><span>Time</span><span>Places</span>
      </div>
      {matches.length ? <RadioGroup value={selectedId} onValueChange={onSelect} aria-label="Choose a class" aria-required="true" className="gap-0 divide-y divide-ui-border">
        {matches.map(course => {
          const places = placesLeft(course._count.enrolments, course.capacity);
          const full = places === 0;
          const disabled = full && !!currentEnrolment;
          const selected = selectedId === course.id;
          return <Label key={course.id} htmlFor={`${id}-${course.id}`} className={cn(rowLayout,
            "min-h-16 px-3 py-3 text-sm font-normal leading-normal has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ui-ring",
            selected ? "bg-ui-brand-soft" : "hover:bg-ui-muted/50", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
            <RadioGroupItem id={`${id}-${course.id}`} value={course.id} disabled={disabled} className="row-span-5 my-1 md:row-span-1" />
            <span className="min-w-0 break-words">
              <span className="block font-semibold">{courseName(course)}</span>
              <span className="block text-xs text-ui-muted-foreground">{course.name && course.name !== course.level.name ? `${course.level.name} · ` : ""}{course.durationMinutes}-minute lesson</span>
              {course.location || course.instructor?.name ? <span className="block text-xs text-ui-muted-foreground">{[course.location, course.instructor?.name].filter(Boolean).join(" · ")}</span> : null}
            </span>
            <span className="col-start-2 min-w-0 break-words md:col-start-auto"><span className="sr-only">Site: </span>{course.club.name}</span>
            <span className="col-start-2 md:col-start-auto"><span className="sr-only">Day: </span>{DAY_META[course.dayOfWeek].label}</span>
            <span className="col-start-2 tabular-nums md:col-start-auto"><span className="sr-only">Time: </span>{formatTimeRange(course)}</span>
            <span className="col-start-2 md:col-start-auto">
              {full ? <><span className="font-medium">Full</span><span className="block text-xs text-ui-muted-foreground">{currentEnrolment ? "No places to move into" : "Waitlist available"}</span></>
                : places === null ? "No limit" : <><strong className="font-semibold tabular-nums">{places}</strong> available</>}
            </span>
          </Label>;
        })}
      </RadioGroup> : <div className="space-y-2 px-4 py-8 text-center">
        <p className="font-medium">{courses.length ? "No classes match these filters" : "No classes available"}</p>
        <p className="text-sm text-ui-muted-foreground">{courses.length ? "Try another site, level or time, or show full classes." : "There are no other active classes to choose from."}</p>
        {courses.length && hasFilters ? <Button type="button" variant="outline" className="min-h-11" onClick={() => setFilters({ ...ALL_CLASSES, availableOnly: false })}>Clear filters</Button> : null}
      </div>}
    </div>
    {/* Keep the selected ID in FormData even when filters hide its radio row. */}
    <input type="hidden" name={name} value={selectedId} />
  </div>;
}

export function ClassEnrolmentDialog({ trigger, courses, currentEnrolment, submit }: {
  trigger: React.ReactNode; courses: TransferTarget[]; currentEnrolment?: StudentEnrolment;
  submit: (data: FormData, confirmation?: ConfirmationReply) => Promise<ActionResult>;
}) {
  const id = useId();
  const [selectedId, setSelectedId] = useState("");
  const [allowWaitlist, setAllowWaitlist] = useState(false);
  const selected = courses.find(course => course.id === selectedId);
  const full = !!selected && placesLeft(selected._count.enrolments, selected.capacity) === 0;
  const moving = !!currentEnrolment;
  const differentSite = selected && currentEnrolment && selected.club.id !== currentEnrolment.course.club.id;
  return <ProfileActionDialog trigger={trigger} wide
    title={moving ? "Move to another class" : "Enrol in a class"}
    description={moving ? "Find a suitable class, then review the move." : "Find a class at either site. Existing places are reviewed before changes."}
    submitLabel={moving ? "Review move" : "Review enrolment"} success={moving ? "Swimmer moved" : "Enrolment saved"}
    submit={submit} submitDisabled={!selected || (full && (moving || !allowWaitlist))}
    onOpenChange={() => { setSelectedId(""); setAllowWaitlist(false); }}
    footer={selected ? <div className="space-y-1" aria-live="polite">
      <p className="text-xs text-ui-muted-foreground">Selected class</p>
      <p className="font-semibold">{courseName(selected)} · {DAY_META[selected.dayOfWeek].label} {formatTimeRange(selected)}</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><MapPin className="size-4 shrink-0" aria-hidden="true" />{selected.club.name}
        {differentSite ? <span className="rounded-ui-sm border border-ui-brand-border bg-ui-brand-soft px-2 py-0.5 text-xs text-ui-brand-ink">Different site</span> : null}</p>
      {differentSite ? <p className="text-xs text-ui-muted-foreground">Moving from {currentEnrolment.course.club.name}.</p> : null}
      {full ? <p className="text-xs text-ui-muted-foreground">This class is full. Enrolment will join its waitlist.</p> : null}
    </div> : <p className="text-ui-muted-foreground">Select a class to continue.</p>}>
    <ClassPicker courses={courses} name={moving ? "toCourseId" : "courseId"} selectedId={selectedId} onSelect={value => { setSelectedId(value); setAllowWaitlist(false); }} currentEnrolment={currentEnrolment} />
    {selected ? <details open={selected.level.id !== currentEnrolment?.course.level.id} className="text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">Placement reason, if needed</summary>
      <Textarea name="placementReason" label="Placement reason" description="Needed only if the swimmer has not earned this level." rows={2} maxLength={300} />
    </details> : null}
    {!moving && selected ? <Label htmlFor={`${id}-waitlist`} className="min-h-11 cursor-pointer leading-normal">
      <Checkbox name="allowWaitlist" id={`${id}-waitlist`} checked={allowWaitlist} onCheckedChange={value => setAllowWaitlist(value === true)} />
      Join the waitlist if full
    </Label> : null}
    {!moving && selected ? <LegendAgreementField key={selectedId} required={!full} /> : null}
  </ProfileActionDialog>;
}
