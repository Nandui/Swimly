"use client";
import { useId } from "react";
import { Switch as Control } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";
export function Switch({ id, label, description, checked, defaultChecked, onCheckedChange, disabled, name, className, labelSpacing, ...rest }: { id?: string; label?: string; description?: string; checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void; disabled?: boolean; name?: string; className?: string; labelSpacing?: "hug" | "spread"; "aria-label"?: string; "aria-labelledby"?: string }) {
  const generatedId = useId(); const controlId = id ?? generatedId;
  return <div className={cn("flex min-h-11 items-center gap-3", labelSpacing === "spread" && "w-full justify-between", className)}>{label ? <label htmlFor={controlId} className="cursor-pointer text-sm font-medium">{label}{description ? <span id={`${controlId}-hint`} className="mt-1 block font-normal text-muted-foreground">{description}</span> : null}</label> : null}<Control.Root {...rest} id={controlId} name={name} value="on" checked={checked} defaultChecked={defaultChecked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={rest["aria-label"] ?? label ?? name ?? "Setting"} aria-describedby={description ? `${controlId}-hint` : undefined} className="workspace-switch"><Control.Thumb className="workspace-switch-thumb" /></Control.Root></div>;
}
