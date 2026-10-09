"use client";

import { useId, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { SearchField } from "@/components/ui-kit/search-field";
import { Label } from "@/components/shadcn/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Tag } from "@/components/ui-kit/tag";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/ui/textarea";
import { DAY_META, DAYS_IN_ORDER, classTimes, courseName, formatTime, placesLeft } from "@/modules/activities/shared/courses/constants";
import { ALL_CLASSES, filterClassChoices, type ClassPickerFilters } from "@/modules/activities/shared/enrolment/class-picker";
import { PLACEMENT_META } from "@/modules/activities/shared/enrolment/constants";
import type { StudentEnrolment, TransferTarget } from "@/modules/activities/shared/enrolment/data/enrolments";
import type { ActionResult, ConfirmationReply } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { ProfileActionDialog } from "@/modules/activities/features/students/components/profile-action-dialog";
import { LegendAgreementField } from "@/modules/activities/shared/enrolment/components/legend-agreement-field";
import styles from "@/modules/activities/features/students/components/swimmer-profile.module.css";

function ClassFilter({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: React.ReactNode;
}) {
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={label} className="min-h-11 w-full min-w-0">
      <span className="min-w-0 truncate"><span className="hidden sm:inline">{label}: </span><SelectValue /></span>
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>;
}

const rowLayout = "grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] md:items-center";

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
    {currentEnrolment ? <div className="pc-note"><div className="min-w-0 space-y-1 text-sm">
      <p className="pc-row-hint">{currentEnrolment.status === "WAITLISTED" ? "Current waitlist class" : "Current class"}</p>
      <p><strong className="font-semibold">{courseName(currentEnrolment.course)}</strong>
        {` · ${DAY_META[currentEnrolment.course.dayOfWeek].label} ${classTimes(currentEnrolment.course)} · ${currentEnrolment.course.club.name}`}</p>
    </div></div> : null}

    <div className="min-w-0 space-y-2">
      <p id={`${id}-site`} className="text-sm font-semibold">Site</p>
      <SegmentedChoice aria-labelledby={`${id}-site`} value={filters.site} onValueChange={value => setFilter("site", value)}
        options={[{ id: "all", name: "All sites" }, ...sites].map(site => ({ value: site.id, label: site.name }))} />
    </div>

    {/* Phones keep Level, Day and Time on one row so the class list stays in reach. */}
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
      {/* Enter in the search box must not submit the dialog's form. */}
      <div className="col-span-3 lg:col-span-1" onKeyDown={event => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault(); }}>
        <SearchField label="Search classes" labelHidden placeholder="Class, level or instructor" value={filters.search} onValueChange={value => setFilter("search", value)} />
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

    <div className={`flex flex-col gap-2 ${styles.picker}`}>
      <div aria-hidden="true" className={cn(rowLayout, styles.pickerHead, "hidden md:grid")}>
        <span>Class</span><span>Site</span><span>Day</span><span>Time</span><span>Places</span>
      </div>
      {matches.length ? <RadioGroup value={selectedId} onValueChange={onSelect} aria-label="Choose a class" aria-required="true" className={`pc-rows ${styles.options}`}>
        {matches.map(course => {
          const places = placesLeft(course._count.enrolments, course.capacity);
          const full = places === 0;
          const disabled = full && !!currentEnrolment;
          return <Label key={course.id} htmlFor={`${id}-${course.id}`} className={`pc-row ${styles.option}`}>
            <RadioGroupItem id={`${id}-${course.id}`} value={course.id} disabled={disabled} />
            <span className={cn(rowLayout, "min-w-0 flex-1")}>
              <span className="min-w-0 break-words">
                <span className="block font-semibold">{courseName(course)}</span>
                <span className="pc-row-hint block">{course.name && course.name !== course.level.name ? `${course.level.name} · ` : ""}{course.durationMinutes}-minute lesson</span>
                {course.location || course.instructor?.name ? <span className="pc-row-hint block">{[course.location, course.instructor?.name].filter(Boolean).join(" · ")}</span> : null}
              </span>
              <span className="min-w-0 break-words"><span className="sr-only">Site: </span>{course.club.name}</span>
              <span><span className="sr-only">Day: </span>{DAY_META[course.dayOfWeek].label}</span>
              <span className="tabular-nums"><span className="sr-only">Time: </span>{classTimes(course)}</span>
              <span>
                {full ? <><span className="font-semibold">Full</span><span className="pc-row-hint block">{currentEnrolment ? "No places to move into" : "Waitlist available"}</span></>
                  : places === null ? "No limit" : <><strong className="font-semibold tabular-nums">{places}</strong> available</>}
              </span>
            </span>
          </Label>;
        })}
      </RadioGroup> : <EmptyState compact title={courses.length ? "No classes match these filters" : "No classes available"}
        hint={courses.length ? "Try another site, level or time, or show full classes." : "There are no other active classes to choose from."}
        action={courses.length && hasFilters ? <Button type="button" variant="outline" className="min-h-11" onClick={() => setFilters({ ...ALL_CLASSES, availableOnly: false })}>Clear filters</Button> : undefined} />}
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
  const [placementOpen, setPlacementOpen] = useState(false);
  const selected = courses.find(course => course.id === selectedId);
  const full = !!selected && placesLeft(selected._count.enrolments, selected.capacity) === 0;
  const moving = !!currentEnrolment;
  const differentSite = selected && currentEnrolment && selected.club.id !== currentEnrolment.course.club.id;
  return <ProfileActionDialog trigger={trigger} wide
    title={moving ? "Move to another class" : "Enrol in a class"}
    description={moving ? "Find a suitable class, then review the move." : "Find a class at any site. Existing places are reviewed before changes."}
    submitLabel={moving ? "Review move" : "Review enrolment"} success={moving ? "Swimmer moved" : "Enrolment saved"}
    submit={submit} submitDisabled={!selected || (full && (moving || !allowWaitlist))}
    onOpenChange={() => { setSelectedId(""); setAllowWaitlist(false); setPlacementOpen(false); }}
    footer={selected ? <div className="space-y-1" aria-live="polite">
      <p className="text-xs text-ui-muted-foreground">Selected class</p>
      <p className="font-semibold">{courseName(selected)} · {DAY_META[selected.dayOfWeek].label} {classTimes(selected)}</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><MapPin className="size-4 shrink-0" aria-hidden="true" />{selected.club.name}
        {differentSite ? <Tag meta={PLACEMENT_META.differentSite} /> : null}</p>
      {differentSite ? <p className="text-xs text-ui-muted-foreground">Moving from {currentEnrolment.course.club.name}.</p> : null}
      {full ? <p className="text-xs text-ui-muted-foreground">This class is full. Enrolment will join its waitlist.</p> : null}
    </div> : <p className="text-ui-muted-foreground">Select a class to continue.</p>}>
    <ClassPicker courses={courses} name={moving ? "toCourseId" : "courseId"} selectedId={selectedId} onSelect={value => {
      setSelectedId(value); setAllowWaitlist(false);
      setPlacementOpen(courses.find(course => course.id === value)?.level.id !== currentEnrolment?.course.level.id);
    }} currentEnrolment={currentEnrolment} />
    {selected ? <Collapsible open={placementOpen} onOpenChange={setPlacementOpen} className="text-sm">
      <CollapsibleTrigger type="button" className={`${styles.chapterTrigger} group font-semibold`}>Placement reason, if needed<ChevronDown aria-hidden="true" className="size-4 shrink-0 group-data-[state=open]:rotate-180" /></CollapsibleTrigger>
      {/* Keep the field mounted so collapsed reasons still submit and survive toggling. */}
      <CollapsibleContent forceMount className="data-[state=closed]:hidden">
        <Textarea name="placementReason" label="Placement reason" description="Needed only if the swimmer has not earned this level." rows={2} maxLength={300} />
      </CollapsibleContent>
    </Collapsible> : null}
    {!moving && selected ? <Label htmlFor={`${id}-waitlist`} className="min-h-11 cursor-pointer">
      <Checkbox name="allowWaitlist" id={`${id}-waitlist`} checked={allowWaitlist} onCheckedChange={value => setAllowWaitlist(value === true)} />
      Join the waitlist if full
    </Label> : null}
    {!moving && selected ? <LegendAgreementField key={selectedId} required={!full} /> : null}
  </ProfileActionDialog>;
}
