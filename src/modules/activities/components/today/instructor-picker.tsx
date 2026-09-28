"use client";

import { useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command";
import { Label } from "@/components/shadcn/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";

export function InstructorPicker({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="flex min-w-0 flex-col gap-2 sm:w-56"><Label htmlFor={id}>Instructor</Label>
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
      <Button id={id} variant="outline" role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-label={`Instructor: ${options.find(option => option.value === value)?.label ?? "All instructors"}`} className="w-full justify-between font-normal">
        <span className="truncate">{options.find(option => option.value === value)?.label ?? "All instructors"}</span><ChevronsUpDown aria-hidden="true" />
      </Button>
    </PopoverTrigger><PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-0">
      <Command><CommandInput placeholder="Search instructors…" aria-label="Search instructors" /><CommandList id={`${id}-options`}><CommandEmpty>No instructors found.</CommandEmpty><CommandGroup>
        {options.map(option => <CommandItem key={option.value} value={option.value} keywords={[option.label]} onSelect={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{value === option.value ? <Check className="ml-auto" aria-label="Selected" /> : null}</CommandItem>)}
      </CommandGroup></CommandList></Command>
    </PopoverContent></Popover>
  </div>;
}
