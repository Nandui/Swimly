"use client";
import type { ComponentProps } from "react";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";

export function RefundInput({ label, hint, ...props }: ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={props.id}>{label}{props.required && <span className="text-xs font-normal text-ui-muted-foreground">(required)</span>}</Label><Input {...props} className="min-h-11" aria-describedby={hint ? `${props.id}-hint` : undefined} />{hint && <p id={`${props.id}-hint`} className="text-xs leading-relaxed text-ui-muted-foreground">{hint}</p>}</div>;
}
export function RefundText({ label, ...props }: ComponentProps<typeof Textarea> & { label: string }) {
  return <div className="space-y-2"><Label htmlFor={props.id}>{label}{props.required && <span className="text-xs font-normal text-ui-muted-foreground">(required)</span>}</Label><Textarea {...props} className="min-h-24" /></div>;
}
export function RefundSelect({ id, label, value, options, onChange, name }: { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; name?: string }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label><Select value={value || "all"} onValueChange={onChange} name={name}><SelectTrigger id={id} className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent className="turnfin-docs turnfin-refunds">{options.map(option => <SelectItem key={option.value} value={option.value || "all"} className="min-h-11">{option.label}</SelectItem>)}</SelectContent></Select></div>;
}
